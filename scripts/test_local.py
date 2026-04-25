"""
Local test script — runs the full analysis pipeline against real data files.
Usage: LOCAL_DATA_DIR=./data python3 scripts/test_local.py
"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ["LOCAL_DATA_DIR"] = os.path.join(os.path.dirname(__file__), "..", "data")

from shared.data_pipeline import load_lodes_od, load_xwalk, load_warn_data, load_qcew, load_cbp, load_zcta_geojson
from shared.event_parser import parse_event
from shared.impact_calculator import calculate_direct_jobs, calculate_indirect_jobs, calculate_dollar_impact
from shared.commute_mapper import distribute_impact, get_top_zips, get_employer_coords
from shared.business_exposure import analyze_exposure
from shared.bls_comparator import build_comparison
from shared.formatters import format_headline, format_dollars


def main():
    event_text = "Intel announces 1,500 layoffs at Chandler, AZ semiconductor fab"

    print("=" * 60)
    print("Economic Blast Radius Engine — Local Test")
    print("=" * 60)
    print(f"\nInput: {event_text}\n")

    print("[1/8] Loading crosswalk...")
    xwalk_df = load_xwalk()
    print(f"  → {len(xwalk_df):,} rows loaded")

    print("[2/8] Parsing event...")
    parsed = parse_event(event_text, xwalk_df)
    print(f"  → Employer: {parsed.employer_name}")
    print(f"  → Location: {parsed.city}, {parsed.state}")
    print(f"  → Event type: {parsed.event_type}")
    print(f"  → Magnitude: {parsed.magnitude_value} ({parsed.magnitude_type})")
    print(f"  → County FIPS: {parsed.county_fips}")
    print(f"  → Work ZIP codes: {len(parsed.work_zip_codes)}")
    print(f"  → Work census blocks: {len(parsed.work_census_blocks)}")
    print(f"  → Industry: {parsed.naics_industry}")

    print("\n[3/8] Loading data sources...")
    lodes_df = load_lodes_od()
    print(f"  → LODES OD: {len(lodes_df):,} commute flows")
    warn_df = load_warn_data()
    print(f"  → WARN: {len(warn_df):,} notices")
    qcew_df = load_qcew(parsed.county_fips or "04013")
    print(f"  → QCEW: {len(qcew_df):,} rows")
    cbp_df = load_cbp()
    print(f"  → CBP: {len(cbp_df):,} rows")

    print("\n[4/8] Calculating direct impact...")
    direct = calculate_direct_jobs(parsed, qcew_df, warn_df)
    print(f"  → Direct jobs lost: {direct.direct_jobs_lost:,}")
    print(f"  → Source: {direct.source}")
    print(f"  → WARN cross-referenced: {direct.warn_cross_referenced} ({direct.warn_notices_matched} matches)")

    print("\n[5/8] Calculating indirect impact (Moretti multiplier)...")
    indirect = calculate_indirect_jobs(direct, parsed.naics_industry)
    print(f"  → Moretti multiplier: {indirect.moretti_multiplier}x ({indirect.industry_classification})")
    print(f"  → Indirect jobs lost: {indirect.indirect_jobs_lost:,}")
    if indirect.plausibility_warning:
        print(f"  ⚠ {indirect.plausibility_warning}")

    total_jobs = direct.direct_jobs_lost + indirect.indirect_jobs_lost
    print(f"\n  → TOTAL jobs at risk: {total_jobs:,}")

    print("\n[6/8] Calculating dollar impact...")
    dollar = calculate_dollar_impact(total_jobs, parsed.county_fips, parsed.naics_industry, qcew_df)
    print(f"  → Avg annual wage: {format_dollars(dollar.avg_annual_wage)}")
    print(f"  → Total wage loss: {format_dollars(dollar.total_wage_loss)}")
    print(f"  → Consumer spending loss: {format_dollars(dollar.consumer_spending_loss)}")
    print(f"  → Quarterly retail loss: {format_dollars(dollar.quarterly_retail_loss)}")

    print("\n[7/8] Distributing impact geographically...")
    employer_lat, employer_lon = get_employer_coords(parsed.city, "04", xwalk_df)
    print(f"  → Employer coords: ({employer_lat}, {employer_lon})")

    zip_impacts = distribute_impact(
        parsed.work_census_blocks, total_jobs, dollar.consumer_spending_loss,
        lodes_df, xwalk_df, employer_lat, employer_lon, radius_miles=50.0
    )
    print(f"  → {len(zip_impacts)} ZIP codes affected")
    top_zips = get_top_zips(zip_impacts, 10)
    print(f"\n  Top 10 affected ZIP codes:")
    for z in top_zips:
        dist = f"{z.distance_miles:.1f} mi" if z.distance_miles else "N/A"
        print(f"    ZIP {z.zip_code}: {z.commuter_share:.2%} share, "
              f"{z.estimated_jobs_lost:.0f} jobs, "
              f"{format_dollars(z.estimated_dollar_impact)}, "
              f"{dist}")

    print("\n[8/8] Analyzing business exposure...")
    exposure = analyze_exposure(zip_impacts, cbp_df)
    print(f"  → Total affected businesses: {exposure.total_affected_businesses:,}")
    print(f"  → ZIP codes analyzed: {exposure.zip_codes_analyzed}")
    print(f"\n  Top exposed business categories:")
    for cat in exposure.top_categories:
        print(f"    {cat.naics_label} ({cat.naics_code}): "
              f"{cat.establishment_count:,} establishments, "
              f"score={cat.exposure_score:.1f}")

    bls = build_comparison(parsed, total_jobs, dollar.total_wage_loss, qcew_df)
    print(f"\n  BLS Comparison:")
    print(f"    Baseline employment: {bls.baseline_employment:,}")
    print(f"    Predicted employment: {bls.predicted_employment:,}")
    print(f"    Projected report quarter: {bls.projected_report_quarter}")

    headline = format_headline(
        indirect.indirect_jobs_lost, exposure.total_affected_businesses,
        dollar.consumer_spending_loss, len(zip_impacts),
        parsed.employer_name, parsed.city
    )
    print(f"\n{'=' * 60}")
    print(f"HEADLINE: {headline}")
    print(f"{'=' * 60}")

    print("\nTest complete.")


if __name__ == "__main__":
    main()

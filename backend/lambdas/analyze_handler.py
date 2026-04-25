"""
Lambda worker for analysis. Invoked asynchronously by submit_handler.
Runs the full pipeline and writes the result JSON to S3 under results/{job_id}.json.
"""
import json
import os
import traceback
import boto3

from shared.models import AnalysisResponse
from shared.data_pipeline import (
    load_lodes_od, load_xwalk, load_warn_data, load_qcew, load_cbp
)
from shared.event_parser import parse_event, ParseError
from shared.impact_calculator import (
    calculate_direct_jobs, calculate_indirect_jobs, calculate_dollar_impact
)
from shared.commute_mapper import distribute_impact, get_top_zips, get_employer_coords
from shared.business_exposure import analyze_exposure
from shared.bls_comparator import build_comparison
from shared.formatters import format_headline

DATA_BUCKET = os.environ.get("DATA_BUCKET", "blast-radius-data-us-west-2")
s3_client = boto3.client("s3")


def handler(event, context):
    job_id = event["job_id"]
    event_text = event["event_text"]

    try:
        result = _run_analysis(event_text)
        result_json = json.dumps({"status": "complete", "result": result})
    except ParseError as e:
        result_json = json.dumps({
            "status": "error",
            "error": f"Parse error ({e.field}): {str(e)}"
        })
    except Exception as e:
        traceback.print_exc()
        result_json = json.dumps({
            "status": "error",
            "error": f"Analysis failed: {str(e)}"
        })

    s3_client.put_object(
        Bucket=DATA_BUCKET,
        Key=f"results/{job_id}.json",
        Body=result_json.encode("utf-8"),
        ContentType="application/json",
    )

    return {"statusCode": 200, "body": "ok"}


def _run_analysis(event_text: str) -> dict:
    xwalk_df = load_xwalk()
    parsed = parse_event(event_text, xwalk_df)

    lodes_df = load_lodes_od()
    warn_df = load_warn_data()
    qcew_df = load_qcew(parsed.county_fips or "04013")
    cbp_df = load_cbp()

    direct = calculate_direct_jobs(parsed, qcew_df, warn_df)

    county_emp = _get_county_emp(qcew_df)
    indirect = calculate_indirect_jobs(direct, parsed.naics_industry, county_emp)

    total_jobs = direct.direct_jobs_lost + indirect.indirect_jobs_lost
    dollar = calculate_dollar_impact(
        total_jobs, parsed.county_fips, parsed.naics_industry, qcew_df
    )

    employer_lat, employer_lon = get_employer_coords(parsed.city, parsed.state, xwalk_df)
    zip_impacts = distribute_impact(
        parsed.work_census_blocks,
        total_jobs,
        dollar.consumer_spending_loss,
        lodes_df,
        xwalk_df,
        employer_lat=employer_lat,
        employer_lon=employer_lon,
        radius_miles=50.0,
    )

    exposure = analyze_exposure(zip_impacts, cbp_df)
    bls_comp = build_comparison(parsed, total_jobs, dollar.total_wage_loss, qcew_df)

    headline = format_headline(
        indirect.indirect_jobs_lost,
        exposure.total_affected_businesses,
        dollar.consumer_spending_loss,
        len(zip_impacts),
        parsed.employer_name,
        parsed.city,
    )

    sources = _build_sources(direct, parsed)

    response = AnalysisResponse(
        parsed_event=parsed,
        direct_impact=direct,
        indirect_impact=indirect,
        dollar_impact=dollar,
        zip_impacts=get_top_zips(zip_impacts, 50),
        exposure_summary=exposure,
        bls_comparison=bls_comp,
        headline=headline,
        sources=sources,
    )

    return json.loads(response.model_dump_json())


def _get_county_emp(qcew_df):
    import pandas as pd
    total_row = qcew_df[
        (qcew_df["own_code"] == "0") & (qcew_df["industry_code"] == "10")
    ]
    if not total_row.empty:
        emp = total_row.iloc[0].get("month1_emplvl")
        if pd.notna(emp):
            return int(emp)
    return None


def _build_sources(direct, parsed):
    sources = [
        "Census LEHD LODES 8.0 (2023) — Origin-Destination commute flows",
        "Census LODES Geographic Crosswalk (2020) — block-to-ZIP mapping",
        "BLS QCEW (2024 Q2) — county employment and wage data",
        "Census ZIP Code Business Patterns (2022) — establishment counts by NAICS",
    ]
    if direct.warn_cross_referenced:
        sources.append(f"Arizona WARN Act notices — {direct.warn_notices_matched} matching filings")
    sources.append(
        f"Moretti local multiplier ({parsed.naics_industry or 'general'}) — indirect job estimation"
    )
    return sources

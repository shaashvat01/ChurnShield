"""
Business exposure analyzer: determines which small business categories
in affected ZIP codes are most exposed to the economic shock.

Uses Census ZIP Code Business Patterns (ZBP) data to count establishments
by NAICS category in affected ZIPs, weighted by each ZIP's impact share.
"""
import pandas as pd
from typing import Optional

from .models import ZIPImpact, BusinessExposure, ExposureSummary
from .data_pipeline import get_naics_label


def analyze_exposure(
    zip_impacts: list[ZIPImpact],
    cbp_df: pd.DataFrame,
) -> ExposureSummary:
    """Analyze business exposure across affected ZIP codes.

    For each affected ZIP, look up establishment counts by 2-digit NAICS.
    Compute exposure_score = establishment_count × zip_impact_share.
    Return top 5 categories and total affected businesses.
    """
    if not zip_impacts:
        return ExposureSummary(
            top_categories=[], total_affected_businesses=0, zip_codes_analyzed=0
        )

    affected_zips = {z.zip_code: z.commuter_share for z in zip_impacts}
    zip_list = list(affected_zips.keys())

    zip_cbp = cbp_df[cbp_df["zip"].isin(zip_list)].copy()

    if zip_cbp.empty:
        padded = [z.zfill(5) for z in zip_list]
        zip_cbp = cbp_df[cbp_df["zip"].isin(padded)].copy()

    if zip_cbp.empty:
        return ExposureSummary(
            top_categories=[], total_affected_businesses=0,
            zip_codes_analyzed=len(zip_list)
        )

    zip_cbp = zip_cbp[zip_cbp["naics"] != "------"].copy()

    zip_cbp["naics_2"] = zip_cbp["naics"].str[:2]

    zip_cbp["est_num"] = pd.to_numeric(zip_cbp["est"], errors="coerce").fillna(0)

    zip_cbp["zip_clean"] = zip_cbp["zip"].str.lstrip("0").str.strip()

    category_scores = {}
    total_affected = 0.0

    for _, row in zip_cbp.iterrows():
        zip_code = row["zip_clean"]
        if zip_code not in affected_zips:
            zip_code = row["zip"].strip()
        if zip_code not in affected_zips:
            continue

        share = affected_zips[zip_code]
        naics_2 = row["naics_2"]
        est = float(row["est_num"])

        if naics_2 not in category_scores:
            category_scores[naics_2] = {
                "count": 0, "score": 0.0, "suppressed": False
            }

        category_scores[naics_2]["count"] += int(est)
        category_scores[naics_2]["score"] += est * share

        total_affected += est * share

    sorted_cats = sorted(
        category_scores.items(), key=lambda x: x[1]["score"], reverse=True
    )

    top_categories = []
    for naics_code, info in sorted_cats[:5]:
        top_categories.append(BusinessExposure(
            naics_code=naics_code,
            naics_label=get_naics_label(naics_code),
            establishment_count=info["count"],
            exposure_score=round(info["score"], 2),
            data_suppressed=info["suppressed"],
        ))

    return ExposureSummary(
        top_categories=top_categories,
        total_affected_businesses=int(round(total_affected)),
        zip_codes_analyzed=len(zip_list),
    )

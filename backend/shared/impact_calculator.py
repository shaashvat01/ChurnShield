"""
Impact calculator: computes direct job losses, indirect losses via Moretti multiplier,
and dollar impact using QCEW wage data.
"""
import pandas as pd
from typing import Optional

from .models import (
    ParsedEvent, DirectImpact, IndirectImpact, DollarImpact, MagnitudeType
)


MORETTI_MULTIPLIERS = {
    "semiconductor": 3.0,
    "high-tech": 3.0,
    "manufacturing": 1.6,
    "retail": 0.8,
    "food-service": 0.8,
    "healthcare": 1.2,
    "finance": 1.5,
    "mining": 1.8,
    "construction": 1.4,
}
DEFAULT_MORETTI = 1.5

CONSUMER_SPENDING_RATE = 0.60


def get_moretti_multiplier(industry: Optional[str]) -> float:
    if industry is None:
        return DEFAULT_MORETTI
    return MORETTI_MULTIPLIERS.get(industry.lower(), DEFAULT_MORETTI)


def calculate_direct_jobs(
    event: ParsedEvent,
    qcew_df: Optional[pd.DataFrame] = None,
    warn_df: Optional[pd.DataFrame] = None,
) -> DirectImpact:
    """Calculate direct job losses from the event.

    If magnitude_type is HEADCOUNT, use the value directly.
    If PERCENTAGE, multiply by county employment from QCEW.
    Cross-reference WARN data when available.
    """
    if event.magnitude_type == MagnitudeType.HEADCOUNT:
        direct_jobs = int(event.magnitude_value)
    else:
        county_employment = _get_county_employment(event.county_fips, qcew_df)
        direct_jobs = int(round(event.magnitude_value / 100.0 * county_employment))

    warn_matched = 0
    warn_cross_ref = False
    if warn_df is not None:
        employer_lower = event.employer_name.lower()
        matches = warn_df[
            warn_df["employer"].str.lower().str.contains(employer_lower, na=False)
        ]
        warn_matched = len(matches)
        warn_cross_ref = warn_matched > 0

    source = "WARN Act cross-reference" if warn_cross_ref else "Event text extraction"

    return DirectImpact(
        direct_jobs_lost=direct_jobs,
        source=source,
        warn_cross_referenced=warn_cross_ref,
        warn_notices_matched=warn_matched,
    )


def calculate_indirect_jobs(
    direct: DirectImpact,
    industry: Optional[str],
    county_employment: Optional[int] = None,
) -> IndirectImpact:
    """Calculate indirect job losses using the Moretti local multiplier."""
    multiplier = get_moretti_multiplier(industry)
    indirect_jobs = int(round(direct.direct_jobs_lost * multiplier))

    classification = industry if industry else "general"

    warning = None
    if county_employment and indirect_jobs > 0.5 * county_employment:
        warning = (
            f"Indirect jobs ({indirect_jobs:,}) exceed 50% of county employment "
            f"({county_employment:,}). Estimate may be overstated."
        )

    return IndirectImpact(
        indirect_jobs_lost=indirect_jobs,
        moretti_multiplier=multiplier,
        industry_classification=classification,
        plausibility_warning=warning,
    )


def calculate_dollar_impact(
    total_jobs_lost: int,
    county_fips: Optional[str],
    naics_industry: Optional[str],
    qcew_df: Optional[pd.DataFrame] = None,
) -> DollarImpact:
    """Compute dollar impact: wage loss, consumer spending loss, quarterly retail loss."""
    avg_annual_wage = _get_avg_annual_wage(county_fips, naics_industry, qcew_df)

    total_wage_loss = total_jobs_lost * avg_annual_wage
    consumer_spending_loss = total_wage_loss * CONSUMER_SPENDING_RATE
    quarterly_retail_loss = consumer_spending_loss / 4.0

    return DollarImpact(
        total_wage_loss=total_wage_loss,
        avg_annual_wage=avg_annual_wage,
        consumer_spending_loss=consumer_spending_loss,
        quarterly_retail_loss=quarterly_retail_loss,
    )


def _get_county_employment(
    county_fips: Optional[str], qcew_df: Optional[pd.DataFrame]
) -> int:
    """Get total county employment from QCEW data."""
    if qcew_df is None or county_fips is None:
        return 100000  # conservative fallback for Maricopa County scale

    total_row = qcew_df[
        (qcew_df["area_fips"] == county_fips)
        & (qcew_df["own_code"] == "0")
        & (qcew_df["industry_code"] == "10")
    ]
    if not total_row.empty:
        emp = total_row.iloc[0]["month1_emplvl"]
        if pd.notna(emp):
            return int(emp)

    return 100000


def _get_avg_annual_wage(
    county_fips: Optional[str],
    naics_industry: Optional[str],
    qcew_df: Optional[pd.DataFrame],
) -> float:
    """Get average annual wage from QCEW data.
    avg_wkly_wage × 52 = annual wage.
    """
    if qcew_df is None:
        return _fallback_wage(naics_industry)

    industry_code = _industry_to_naics(naics_industry)

    if county_fips:
        row = qcew_df[
            (qcew_df["area_fips"] == county_fips)
            & (qcew_df["industry_code"] == industry_code)
            & (qcew_df["own_code"] == "5")  # private sector
        ]
        if not row.empty and pd.notna(row.iloc[0]["avg_wkly_wage"]):
            return float(row.iloc[0]["avg_wkly_wage"]) * 52

    total_row = qcew_df[
        (qcew_df["own_code"] == "0")
        & (qcew_df["industry_code"] == "10")
    ]
    if not total_row.empty and pd.notna(total_row.iloc[0]["avg_wkly_wage"]):
        return float(total_row.iloc[0]["avg_wkly_wage"]) * 52

    return _fallback_wage(naics_industry)


def _industry_to_naics(industry: Optional[str]) -> str:
    """Map industry keyword to NAICS code for QCEW lookup."""
    mapping = {
        "semiconductor": "3344",
        "high-tech": "51",
        "manufacturing": "31-33",
        "retail": "44-45",
        "food-service": "72",
        "healthcare": "62",
        "finance": "52",
        "mining": "21",
        "construction": "23",
    }
    if industry and industry.lower() in mapping:
        return mapping[industry.lower()]
    return "10"  # total, all industries


def _fallback_wage(industry: Optional[str]) -> float:
    """Fallback average annual wages by industry when no QCEW data available.
    Based on BLS national averages.
    """
    fallbacks = {
        "semiconductor": 115000,
        "high-tech": 110000,
        "manufacturing": 65000,
        "retail": 35000,
        "food-service": 28000,
        "healthcare": 60000,
        "finance": 95000,
        "mining": 75000,
        "construction": 58000,
    }
    if industry and industry.lower() in fallbacks:
        return float(fallbacks[industry.lower()])
    return 55000.0

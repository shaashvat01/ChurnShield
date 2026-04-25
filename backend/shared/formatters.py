"""
Formatting utilities for dollar amounts, numbers, and headline generation.
"""
from typing import Tuple, Dict


def format_dollar(amount: float) -> str:
    """Format dollar amount: $X.XB for billions, $XM for millions, $X,XXX for less."""
    if amount < 0:
        return "-" + format_dollar(abs(amount))

    if amount >= 1_000_000_000:
        return f"${amount / 1_000_000_000:.1f}B"
    elif amount >= 1_000_000:
        return f"${amount / 1_000_000:.0f}M"
    else:
        return f"${amount:,.0f}"


# Alias for compatibility
format_dollars = format_dollar


def format_number(n: int) -> str:
    """Format integer with commas."""
    return f"{n:,}"


def format_multiplier(m: float) -> str:
    """Format multiplier value."""
    return f"{m:.1f}x"


def format_percentage(p: float) -> str:
    """Format percentage value."""
    return f"{p:.1f}%"


def generate_headline_summary(
    employer: str,
    location: str,
    direct_jobs: int,
    indirect_jobs: int,
    quarterly_revenue_loss: float,
    affected_zip_count: int,
) -> str:
    """
    Generate a headline string summarizing the blast radius.
    
    Example:
    "Intel layoff in Chandler, AZ projected to put 17,700 jobs at risk 
    across 10 ZIP codes, with $252M quarterly revenue impact"
    """
    total_jobs = direct_jobs + indirect_jobs
    return (
        f"{employer} layoff in {location} projected to put "
        f"{format_number(total_jobs)} jobs at risk across "
        f"{affected_zip_count} ZIP codes, with {format_dollar(quarterly_revenue_loss)} "
        f"quarterly revenue impact"
    )


def generate_methodology_explanation() -> Dict[str, str]:
    """
    Generate methodology explanation for each step of the analysis.
    """
    return {
        "step1_direct_jobs": (
            "Direct job losses extracted from WARN Act notice or SEC filing. "
            "WARN Act requires 60-day advance notice for layoffs of 100+ workers."
        ),
        "step2_multiplier": (
            "Indirect job multiplier from Moretti (2010) 'Local Multipliers' - "
            "American Economic Review. High-tech industries generate 4.9 additional "
            "jobs in the nontradable sector (restaurants, retail, services) for each "
            "tradable sector job. Manufacturing average is 1.6x."
        ),
        "step3_geographic": (
            "Geographic distribution computed from Census LEHD LODES data, which "
            "tracks worker commute flows at the census block level. Shows where "
            "affected workers live and spend their income."
        ),
        "step4_dollar_impact": (
            "Dollar impact = Total jobs × Average wage × Consumer spending rate (60%). "
            "Based on Consumer Expenditure Survey data showing ~60% of wages are "
            "spent on local goods and services."
        ),
        "step5_business_exposure": (
            "Business exposure from Census ZIP Code Business Patterns (ZBP), which "
            "counts establishments by NAICS industry code in each ZIP. Categories "
            "ranked by discretionary spending dependency."
        ),
    }


def generate_data_sources() -> Dict[str, str]:
    """
    Generate data source citations.
    """
    return {
        "moretti_2010": (
            "Moretti, E. (2010). 'Local Multipliers.' American Economic Review, "
            "100(2), 373-377. DOI: 10.1257/aer.100.2.373"
        ),
        "lehd_lodes": (
            "Census Bureau LEHD LODES (Longitudinal Employer-Household Dynamics "
            "Origin-Destination Employment Statistics). lehd.ces.census.gov/data/lodes/"
        ),
        "cbp": (
            "Census Bureau County Business Patterns / ZIP Code Business Patterns. "
            "census.gov/programs-surveys/cbp.html"
        ),
        "qcew": (
            "Bureau of Labor Statistics Quarterly Census of Employment and Wages. "
            "bls.gov/cew/"
        ),
        "warn_act": (
            "Worker Adjustment and Retraining Notification (WARN) Act notices. "
            "State workforce agency publications."
        ),
        "consumer_expenditure": (
            "Bureau of Labor Statistics Consumer Expenditure Survey. "
            "bls.gov/cex/"
        ),
    }


def generate_confidence_interval(
    quarterly_revenue_loss: float,
    error_rate: float = 0.18,
) -> Tuple[float, float]:
    """
    Generate confidence interval for revenue loss estimate.
    
    Based on backtested error rate from historical WARN events.
    Default 18% error rate from model validation.
    
    Args:
        quarterly_revenue_loss: Point estimate
        error_rate: Error rate (default 18%)
    
    Returns:
        Tuple of (lower_bound, upper_bound)
    """
    lower = quarterly_revenue_loss * (1 - error_rate)
    upper = quarterly_revenue_loss * (1 + error_rate)
    return (lower, upper)


def format_confidence_interval(lower: float, upper: float) -> str:
    """Format confidence interval as string."""
    return f"{format_dollar(lower)} - {format_dollar(upper)}"


# Legacy function for compatibility
def format_headline(
    indirect_jobs: int,
    total_businesses: int,
    total_dollar_impact: float,
    affected_zips: int,
    employer_name: str,
    city: str,
) -> str:
    """Generate a headline string summarizing the blast radius (legacy)."""
    return (
        f"{employer_name} event in {city} projected to put "
        f"{format_number(indirect_jobs)} indirect jobs at risk across "
        f"{affected_zips} ZIP codes, threatening {format_number(total_businesses)} "
        f"local businesses with {format_dollar(total_dollar_impact)} in "
        f"annual economic impact"
    )

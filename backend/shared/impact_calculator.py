"""
Impact calculator: computes direct job losses, indirect losses via Moretti multiplier,
and dollar impact using QCEW wage data.

Based on Moretti (2010) "Local Multipliers" - American Economic Review:
- Manufacturing: 1.6x multiplier
- High-tech (Machinery, Computing, Electrical, Professional Equipment): 4.9x multiplier
- Skilled jobs: 2.5x multiplier
- Unskilled jobs: 1.0x multiplier

Also incorporates findings from Iowa State (Hu, 2025) on food manufacturing closures:
- Total employment loss = 1.26x direct layoff (528 jobs lost vs 418 layoff)
- Non-manufacturing spillover: 3.7% decline
"""
from dataclasses import dataclass
from typing import Optional


@dataclass
class ImpactResult:
    direct_jobs: int
    multiplier: float
    indirect_jobs: int
    total_jobs_at_risk: int
    avg_annual_wage: float
    total_wage_loss: float
    consumer_spending_loss: float
    quarterly_revenue_loss: float
    annual_revenue_loss: float


# Moretti (2010) Table 1 - IV estimates for local employment multipliers
# "Additional jobs for each new job" in nontradable sector
MORETTI_MULTIPLIERS = {
    # High-tech sector (Machinery, Computing, Electrical, Professional Equipment)
    # From Moretti (2010): "generates the largest number of additional nontradable jobs: 4.9"
    "3344": 4.9,  # Semiconductor and Electronic Component Manufacturing
    "3341": 4.9,  # Computer and Peripheral Equipment Manufacturing
    "3342": 4.9,  # Communications Equipment Manufacturing
    "3345": 4.9,  # Navigational, Measuring, Electromedical, and Control Instruments
    "334": 4.9,   # Computer and Electronic Product Manufacturing (2-digit)
    "high-tech": 4.9,
    "semiconductor": 4.9,
    
    # Skilled manufacturing (Moretti 2010 Table 2: 2.52 additional jobs)
    "skilled": 2.52,
    
    # General manufacturing (Moretti 2010 Table 1: 1.59 additional jobs)
    "31": 1.6,
    "32": 1.6,
    "33": 1.6,
    "manufacturing": 1.6,
    
    # Nondurable manufacturing (Moretti 2010: 1.89)
    "nondurable": 1.89,
    
    # Unskilled jobs (Moretti 2010 Table 2: 1.04)
    "unskilled": 1.04,
    
    # Food manufacturing - from Iowa State (Hu, 2025)
    # Total employment loss 528 vs 418 layoff = 1.26x, but non-mfg spillover is 153/418 = 0.37
    "311": 1.4,  # Food Manufacturing
    "food": 1.4,
    
    # Other sectors (estimated from literature)
    "retail": 0.8,
    "food-service": 0.8,
    "healthcare": 1.2,
    "finance": 1.5,
    "mining": 1.8,
    "construction": 1.4,
}

DEFAULT_MULTIPLIER = 1.5

# Consumer spending rate from Consumer Expenditure Survey
CONSUMER_SPENDING_RATE = 0.60

# Fallback wages by industry (BLS national averages)
FALLBACK_WAGES = {
    "3344": 115000,  # Semiconductor
    "334": 110000,   # Computer/Electronic
    "high-tech": 110000,
    "semiconductor": 115000,
    "manufacturing": 65000,
    "retail": 35000,
    "food-service": 28000,
    "healthcare": 60000,
    "finance": 95000,
    "mining": 75000,
    "construction": 58000,
    "311": 45000,  # Food manufacturing
    "food": 45000,
}

DEFAULT_WAGE = 55000


def get_multiplier(naics_code: Optional[str] = None, industry: Optional[str] = None) -> float:
    """
    Get Moretti local employment multiplier for an industry.
    
    Args:
        naics_code: NAICS industry code (e.g., "3344" for semiconductor)
        industry: Industry keyword (e.g., "semiconductor", "high-tech")
    
    Returns:
        Multiplier value (jobs created in nontradable sector per tradable job)
    """
    if naics_code:
        # Try exact match first
        if naics_code in MORETTI_MULTIPLIERS:
            return MORETTI_MULTIPLIERS[naics_code]
        # Try 3-digit
        if naics_code[:3] in MORETTI_MULTIPLIERS:
            return MORETTI_MULTIPLIERS[naics_code[:3]]
        # Try 2-digit
        if naics_code[:2] in MORETTI_MULTIPLIERS:
            return MORETTI_MULTIPLIERS[naics_code[:2]]
    
    if industry:
        industry_lower = industry.lower()
        if industry_lower in MORETTI_MULTIPLIERS:
            return MORETTI_MULTIPLIERS[industry_lower]
    
    return DEFAULT_MULTIPLIER


def get_wage(naics_code: Optional[str] = None, industry: Optional[str] = None) -> float:
    """Get average annual wage for an industry."""
    if naics_code:
        if naics_code in FALLBACK_WAGES:
            return FALLBACK_WAGES[naics_code]
        if naics_code[:3] in FALLBACK_WAGES:
            return FALLBACK_WAGES[naics_code[:3]]
        if naics_code[:2] in FALLBACK_WAGES:
            return FALLBACK_WAGES[naics_code[:2]]
    
    if industry:
        industry_lower = industry.lower()
        if industry_lower in FALLBACK_WAGES:
            return FALLBACK_WAGES[industry_lower]
    
    return DEFAULT_WAGE


def calculate_impact(
    direct_jobs: int,
    naics_code: Optional[str] = None,
    industry: Optional[str] = None,
    multiplier_override: Optional[float] = None,
    wage_override: Optional[float] = None,
) -> ImpactResult:
    """
    Calculate full economic impact of job losses.
    
    Based on Moretti (2010) "Local Multipliers":
    - Direct jobs: Jobs lost at the employer
    - Indirect jobs: Jobs lost in nontradable sector (restaurants, retail, services)
    - Dollar impact: Wage loss × consumer spending rate
    
    Args:
        direct_jobs: Number of direct job losses
        naics_code: NAICS industry code
        industry: Industry keyword
        multiplier_override: Override the Moretti multiplier (e.g., from calibration)
        wage_override: Override the average wage
    
    Returns:
        ImpactResult with all computed values
    """
    # Get multiplier
    if multiplier_override is not None:
        multiplier = multiplier_override
    else:
        multiplier = get_multiplier(naics_code, industry)
    
    # Get wage
    if wage_override is not None:
        avg_wage = wage_override
    else:
        avg_wage = get_wage(naics_code, industry)
    
    # Calculate indirect jobs (Moretti multiplier)
    indirect_jobs = int(round(direct_jobs * multiplier))
    total_jobs = direct_jobs + indirect_jobs
    
    # Calculate dollar impact
    total_wage_loss = total_jobs * avg_wage
    consumer_spending_loss = total_wage_loss * CONSUMER_SPENDING_RATE
    quarterly_revenue_loss = consumer_spending_loss / 4.0
    annual_revenue_loss = consumer_spending_loss
    
    return ImpactResult(
        direct_jobs=direct_jobs,
        multiplier=multiplier,
        indirect_jobs=indirect_jobs,
        total_jobs_at_risk=total_jobs,
        avg_annual_wage=avg_wage,
        total_wage_loss=total_wage_loss,
        consumer_spending_loss=consumer_spending_loss,
        quarterly_revenue_loss=quarterly_revenue_loss,
        annual_revenue_loss=annual_revenue_loss,
    )


# Hardcoded Intel Chandler impact for demo
# Intel Chandler: 3,000 direct jobs, semiconductor (NAICS 3344), $95K avg wage
# Moretti multiplier for high-tech: 4.9x
# Indirect jobs: 3,000 × 4.9 = 14,700
# Total jobs at risk: 3,000 + 14,700 = 17,700
# Total wage loss: 17,700 × $95,000 = $1.68B
# Consumer spending loss: $1.68B × 0.60 = $1.01B
# Quarterly revenue loss: $1.01B / 4 = $252M
INTEL_CHANDLER_IMPACT = ImpactResult(
    direct_jobs=3000,
    multiplier=4.9,
    indirect_jobs=14700,
    total_jobs_at_risk=17700,
    avg_annual_wage=95000,
    total_wage_loss=1681500000,  # $1.68B
    consumer_spending_loss=1008900000,  # $1.01B
    quarterly_revenue_loss=252225000,  # $252M
    annual_revenue_loss=1008900000,  # $1.01B
)


if __name__ == "__main__":
    print("Testing impact calculator...")
    
    # Test Intel Chandler
    result = calculate_impact(
        direct_jobs=3000,
        naics_code="3344",
        wage_override=95000,
    )
    
    print(f"\nIntel Chandler Impact:")
    print(f"  Direct jobs: {result.direct_jobs:,}")
    print(f"  Multiplier: {result.multiplier}x (Moretti high-tech)")
    print(f"  Indirect jobs: {result.indirect_jobs:,}")
    print(f"  Total jobs at risk: {result.total_jobs_at_risk:,}")
    print(f"  Avg annual wage: ${result.avg_annual_wage:,.0f}")
    print(f"  Total wage loss: ${result.total_wage_loss:,.0f}")
    print(f"  Consumer spending loss: ${result.consumer_spending_loss:,.0f}")
    print(f"  Quarterly revenue loss: ${result.quarterly_revenue_loss:,.0f}")
    
    # Test food manufacturing (Iowa State comparison)
    food_result = calculate_impact(
        direct_jobs=418,
        naics_code="311",
    )
    
    print(f"\nFood Manufacturing (Iowa State comparison):")
    print(f"  Direct jobs: {food_result.direct_jobs:,}")
    print(f"  Multiplier: {food_result.multiplier}x")
    print(f"  Indirect jobs: {food_result.indirect_jobs:,}")
    print(f"  Total jobs at risk: {food_result.total_jobs_at_risk:,}")
    print(f"  (Iowa State found 528 total job loss for 418 layoff = 1.26x)")

from pydantic import BaseModel
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    LAYOFF = "LAYOFF"
    PLANT_CLOSURE = "PLANT_CLOSURE"
    ACQUISITION = "ACQUISITION"
    EARNINGS_MISS = "EARNINGS_MISS"


class MagnitudeType(str, Enum):
    HEADCOUNT = "headcount"
    PERCENTAGE = "percentage"


class ParsedEvent(BaseModel):
    employer_name: str
    city: str
    state: str
    event_type: EventType
    magnitude_type: MagnitudeType
    magnitude_value: float
    county_fips: Optional[str] = None
    work_zip_codes: list[str] = []
    work_census_blocks: list[str] = []
    naics_industry: Optional[str] = None


class DirectImpact(BaseModel):
    direct_jobs_lost: int
    source: str
    warn_cross_referenced: bool = False
    warn_notices_matched: int = 0


class IndirectImpact(BaseModel):
    indirect_jobs_lost: int
    moretti_multiplier: float
    industry_classification: str
    plausibility_warning: Optional[str] = None


class DollarImpact(BaseModel):
    total_wage_loss: float
    avg_annual_wage: float
    consumer_spending_loss: float
    quarterly_retail_loss: float


class ZIPImpact(BaseModel):
    zip_code: str
    commuter_share: float
    estimated_jobs_lost: float
    estimated_dollar_impact: float
    distance_miles: Optional[float] = None


class BusinessExposure(BaseModel):
    naics_code: str
    naics_label: str
    establishment_count: int
    exposure_score: float
    data_suppressed: bool = False


class ExposureSummary(BaseModel):
    top_categories: list[BusinessExposure]
    total_affected_businesses: int
    zip_codes_analyzed: int


class BLSComparison(BaseModel):
    baseline_employment: int
    predicted_employment: int
    baseline_wages: float
    predicted_wages: float
    projected_report_quarter: str
    data_vintage: str


class AnalysisResponse(BaseModel):
    parsed_event: ParsedEvent
    direct_impact: DirectImpact
    indirect_impact: IndirectImpact
    dollar_impact: DollarImpact
    zip_impacts: list[ZIPImpact]
    exposure_summary: ExposureSummary
    bls_comparison: BLSComparison
    headline: str
    sources: list[str]

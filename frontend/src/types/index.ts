export interface ParsedEvent {
  employer_name: string;
  city: string;
  state: string;
  event_type: string;
  magnitude_type: string;
  magnitude_value: number;
  county_fips: string | null;
  work_zip_codes: string[];
  work_census_blocks: string[];
  naics_industry: string | null;
}

export interface DirectImpact {
  direct_jobs_lost: number;
  source: string;
  warn_cross_referenced: boolean;
  warn_notices_matched: number;
}

export interface IndirectImpact {
  indirect_jobs_lost: number;
  moretti_multiplier: number;
  industry_classification: string;
  plausibility_warning: string | null;
}

export interface DollarImpact {
  total_wage_loss: number;
  avg_annual_wage: number;
  consumer_spending_loss: number;
  quarterly_retail_loss: number;
}

export interface ZIPImpact {
  zip_code: string;
  commuter_share: number;
  estimated_jobs_lost: number;
  estimated_dollar_impact: number;
  distance_miles: number | null;
}

export interface BusinessExposure {
  naics_code: string;
  naics_label: string;
  establishment_count: number;
  exposure_score: number;
  data_suppressed: boolean;
}

export interface ExposureSummary {
  top_categories: BusinessExposure[];
  total_affected_businesses: number;
  zip_codes_analyzed: number;
}

export interface BLSComparison {
  baseline_employment: number;
  predicted_employment: number;
  baseline_wages: number;
  predicted_wages: number;
  projected_report_quarter: string;
  data_vintage: string;
}

export interface AnalysisResponse {
  parsed_event: ParsedEvent;
  direct_impact: DirectImpact;
  indirect_impact: IndirectImpact;
  dollar_impact: DollarImpact;
  zip_impacts: ZIPImpact[];
  exposure_summary: ExposureSummary;
  bls_comparison: BLSComparison;
  headline: string;
  sources: string[];
}

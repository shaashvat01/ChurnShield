/**
 * ChurnShield Frontend Types
 * 
 * Matches the backend AnalysisResponse from analysis_orchestrator.py
 */

export interface ParsedEvent {
  employer: string;
  location_city: string;
  location_state: string;
  location_zip: string | null;
  direct_jobs: number;
  naics_code: string | null;
  industry: string | null;
  event_type: string;
  county_fips: string | null;
  census_blocks: string[] | null;
}

export interface ZIPImpact {
  zip_code: string;
  city: string;
  state: string;
  commuter_share: number;
  direct_jobs_impact: number;
  indirect_jobs_impact: number;
  total_jobs_impact: number;
  dollar_impact: number;
  latitude: number;
  longitude: number;
}

export interface BusinessExposure {
  naics_code: string;
  naics_description: string;
  establishment_count: number;
  dollar_impact: number;
  exposure_score: number;
}

export interface Business {
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  estimated_revenue_impact_pct: number;
}

export interface Epicenter {
  employer: string;
  city: string;
  state: string;
  zip_code: string | null;
  latitude: number;
  longitude: number;
  direct_jobs: number;
}

export interface AnalysisResponse {
  // Event info
  event: ParsedEvent;
  epicenter: Epicenter | null;
  
  // Impact numbers
  direct_jobs: number;
  multiplier: number;
  multiplier_source: string;
  indirect_jobs: number;
  total_jobs_at_risk: number;
  quarterly_revenue_loss: number;
  annual_revenue_loss: number;
  
  // Geographic distribution
  affected_zips: ZIPImpact[];
  
  // Business exposure
  business_exposure: BusinessExposure[];
  businesses_by_category: Record<string, Business[]>;
  
  // Summary
  headline_summary: string;
  methodology: Record<string, string>;
  data_sources: Record<string, string>;
  confidence_interval: string;
}

// Legacy types for backward compatibility
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

// Legacy response type
export interface LegacyAnalysisResponse {
  parsed_event: {
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
  };
  direct_impact: DirectImpact;
  indirect_impact: IndirectImpact;
  dollar_impact: DollarImpact;
  zip_impacts: {
    zip_code: string;
    commuter_share: number;
    estimated_jobs_lost: number;
    estimated_dollar_impact: number;
    distance_miles: number | null;
  }[];
  exposure_summary: ExposureSummary;
  bls_comparison: BLSComparison;
  headline: string;
  sources: string[];
}

# Tasks — Economic Blast Radius Engine

## Unit 1: Data Pipeline & Pre-Processing

### Task 1.1: LODES/XWALK Data Ingestion Script
- [ ] Create `backend/scripts/ingest_lodes.py` — downloads Arizona LODES OD file (`az_od_main_JT00_2023.csv.gz`) and XWALK file from Census LEHD
- [ ] Convert downloaded CSV files to Parquet format using pandas for 5-10x faster reads
- [ ] Store output Parquet files in `data/parquet/` directory
- [ ] Validate column schema: `w_geocode`, `h_geocode`, `S000`, `SE01-SE03`, `SI01-SI03` for OD; `tabblk2020`, `zcta`, `cty`, `stname`, `ctyname`, `blklat`, `blklon` for XWALK
- [ ] Add CLI entry point: `python -m backend.scripts.ingest_lodes --state AZ`

### Task 1.2: WARN Act Data Ingestion
- [ ] Create `backend/scripts/ingest_warn.py` — uses `warn-scraper` package to download Arizona WARN notices
- [ ] Output CSV to `data/warn/az_warn.csv` with columns: `company_name`, `city`, `state`, `num_affected`, `notice_date`, `layoff_date`
- [ ] Add fallback: if scraper fails, load from pre-downloaded CSV

### Task 1.3: ZCTA GeoJSON Preparation
- [ ] Create `backend/scripts/prepare_zcta.py` — downloads Arizona ZCTA boundary GeoJSON from Census TIGER/Line 2024
- [ ] Filter to Arizona ZCTAs only, output to `data/geojson/az_zcta.geojson`
- [ ] Validate GeoJSON structure: FeatureCollection with `ZCTA5CE20` property per feature

### Task 1.4: In-Memory Cache Module
- [ ] Create `backend/app/cache.py` — TTL-based dict cache with `get()`, `set()`, `is_expired()` methods
- [ ] QCEW cache: 24-hour TTL, keyed by `{fips}_{year}_{quarter}`
- [ ] CBP cache: 7-day TTL, keyed by ZIP code
- [ ] Add staleness indicator support: return `(data, is_stale, cached_at)` tuples

---

## Unit 2: Event Parser

### Task 2.1: Event Parser Module
- [ ] Create `backend/app/event_parser.py` with `ParsedEvent` dataclass and `EventType` enum
- [ ] Implement `parse_event(text: str) -> ParsedEvent` using regex patterns for employer name, city/state, event type, magnitude
- [ ] Support 4 event types: LAYOFF, PLANT_CLOSURE, ACQUISITION, EARNINGS_MISS
- [ ] Raise `ParseError` with field-specific messages for missing magnitude, invalid location, unrecognized event type

### Task 2.2: Location Resolution
- [ ] Implement `resolve_location(city, state, xwalk_df)` — returns `(county_fips, zip_codes, census_blocks)`
- [ ] Use XWALK data to map city/state → county FIPS → encompassing ZIP codes → census blocks
- [ ] Handle case-insensitive matching and common city name variations

---

## Unit 3: Impact Calculator

### Task 3.1: Direct Job Loss Calculator
- [ ] Create `backend/app/impact_calculator.py` with `DirectImpact`, `IndirectImpact`, `DollarImpact` dataclasses
- [ ] Implement `calculate_direct_jobs(event, qcew_data)` — percentage × headcount or absolute passthrough
- [ ] Implement QCEW fallback: estimate headcount from county-level employment by NAICS
- [ ] Implement WARN cross-reference: match employer name + location against WARN data

### Task 3.2: Indirect Job Loss Calculator (Moretti Multiplier)
- [ ] Implement `calculate_indirect_jobs(direct, industry)` — applies Moretti multiplier
- [ ] `get_moretti_multiplier(industry)`: 3.0 for high-tech/semiconductor, 1.6 for manufacturing
- [ ] Plausibility warning: flag when indirect_jobs > 50% of county total non-farm employment

### Task 3.3: Dollar Impact Calculator
- [ ] Implement `calculate_dollar_impact(total_jobs, county_fips, naics, qcew_data)`
- [ ] Computation chain: total_wage_loss = jobs × avg_annual_wage; retail_revenue_loss = wage_loss × 0.60; quarterly = retail / 4
- [ ] Fetch avg_weekly_wage from QCEW API: `https://data.bls.gov/cew/data/api/{year}/{quarter}/area/{county_fips}.csv`

---

## Unit 4: Commute Mapper

### Task 4.1: Geographic Distribution Engine
- [ ] Create `backend/app/commute_mapper.py` with `ZIPImpact` dataclass
- [ ] Implement `distribute_impact(work_blocks, total_jobs, total_dollars, lodes_df, xwalk_df, radius_miles=15.0)`
- [ ] Filter LODES OD data to rows where `w_geocode` matches employer work-location census blocks
- [ ] Aggregate commute flows by home ZIP (via XWALK block-to-ZCTA mapping)
- [ ] Compute proportional shares: each ZIP's share = its commute flow / total commute flow
- [ ] Apply radius filter using haversine distance from employer centroid to ZIP centroids
- [ ] Fallback: uniform distribution across ZIPs in radius when LODES data unavailable

### Task 4.2: Top-N ZIP Ranking
- [ ] Implement `get_top_zips(zip_impacts, n=10)` — returns top N ZIPs sorted by estimated_jobs_lost descending

---

## Unit 5: Business Exposure Analyzer

### Task 5.1: CBP Data Fetcher
- [ ] Create `backend/app/business_exposure.py` with `BusinessExposure`, `ExposureSummary` dataclasses
- [ ] Implement `fetch_cbp_data(zip_codes)` — queries Census CBP API for establishment counts by 2-digit NAICS per ZIP
- [ ] Handle data suppression: when CBP returns "D" values, use establishment count only, set `data_suppressed=true`
- [ ] Cache responses with 7-day TTL

### Task 5.2: Exposure Ranking
- [ ] Implement `analyze_exposure(zip_impacts, cbp_data)` — ranks NAICS categories by exposure score
- [ ] Exposure score = establishment_count × weighted_impact_proportion
- [ ] Return top 5 categories + total_affected_businesses (weighted sum across ZIPs)

---

## Unit 6: BLS Comparator

### Task 6.1: BLS Comparison Builder
- [ ] Create `backend/app/bls_comparator.py` with `BLSComparison` dataclass
- [ ] Implement `build_comparison(event, total_impact, qcew_data)`
- [ ] Compute projected QCEW reporting quarter: event_quarter_end + 5 months
- [ ] Retrieve baseline employment/wages from most recent available QCEW data
- [ ] Label distinction: "BLS Reported" vs "Engine Predicted"

---

## Unit 7: FastAPI Backend

### Task 7.1: FastAPI Application Setup
- [ ] Create `backend/app/main.py` — FastAPI app with CORS middleware
- [ ] Create `backend/app/models.py` — Pydantic models matching API contract from design doc
- [ ] Implement startup event: load LODES/XWALK Parquet files into memory, load WARN data, load ZCTA GeoJSON

### Task 7.2: Analysis Endpoint
- [ ] Implement `POST /api/analyze` — orchestrates full analysis pipeline: parse → direct impact → indirect impact → dollar impact → commute mapping → business exposure → BLS comparison
- [ ] Return complete `AnalysisResponse` JSON matching design doc API contract
- [ ] Handle errors: 400 for parse errors, 500 for internal errors, timeout handling

### Task 7.3: Static Data Endpoint
- [ ] Implement `GET /api/zcta-boundaries` — serves pre-loaded Arizona ZCTA GeoJSON
- [ ] Add appropriate caching headers (immutable, long max-age)

### Task 7.4: Headline & Formatting Utilities
- [ ] Create `backend/app/formatters.py` — dollar formatting ($340M, $1.2B), headline generation
- [ ] Headline template: "{indirect_jobs} indirect jobs at risk across {businesses} small businesses within {radius}-mile radius"
- [ ] Source attribution list generation

---

## Unit 8: Frontend Integration

### Task 8.1: API Integration Hook
- [ ] Create `frontend/src/hooks/useAnalysis.ts` — API call hook for `POST /api/analyze`
- [ ] Create `frontend/src/hooks/useZCTABoundaries.ts` — loads ZCTA GeoJSON from backend
- [ ] Create `frontend/src/types/index.ts` — TypeScript interfaces matching backend response models

### Task 8.2: Map Migration (Leaflet → deck.gl)
- [ ] Install deck.gl and MapLibre GL JS dependencies
- [ ] Create `frontend/src/components/ImpactMap.tsx` — deck.gl DeckGL + GeoJsonLayer with ZCTA polygons
- [ ] Implement green-to-red color scale based on dollar impact per ZIP
- [ ] Create `frontend/src/components/MapTooltip.tsx` — hover/click tooltip showing ZIP, jobs, dollars, business categories

### Task 8.3: Dashboard Panels (Connect to Live Data)
- [ ] Update `frontend/src/components/SummaryPanel.tsx` — bind to API response (total dollars, indirect jobs, affected businesses, ZIP count)
- [ ] Create `frontend/src/components/ZIPRankList.tsx` — top 10 ZIP codes table from API data
- [ ] Create `frontend/src/components/BusinessRankList.tsx` — top 5 NAICS categories table from API data
- [ ] Create `frontend/src/components/BLSComparisonPanel.tsx` — side-by-side BLS comparison with distinct styling
- [ ] Create `frontend/src/components/SourceAttribution.tsx` — data source footer

### Task 8.4: Dollar Formatting Utility
- [ ] Create `frontend/src/utils/formatters.ts` — `formatDollars()`: $1.2B for ≥$1B, $340M for ≥$1M, $500,000 with commas for <$1M

---

## Unit 9: Infrastructure (CDK)

### Task 9.1: Backend Stack Implementation
- [ ] Update `backend/lib/backend-stack.ts` — define Lambda function(s) for analysis engine
- [ ] Configure API Gateway with POST /api/analyze and GET /api/zcta-boundaries routes
- [ ] Add S3 bucket for pre-cached data files (LODES Parquet, XWALK Parquet, WARN CSV, ZCTA GeoJSON)
- [ ] Add IAM role for Lambda to read from S3 data bucket and write CloudWatch logs
- [ ] Configure Lambda with sufficient memory (512MB+) and timeout (30s) for pandas operations
- [ ] Add CORS configuration on API Gateway for frontend origin

### Task 9.2: Frontend Deployment
- [ ] Add CloudFront distribution + S3 bucket for Next.js static export
- [ ] Configure API Gateway endpoint URL as environment variable for frontend
- [ ] Configure CORS between CloudFront origin and API Gateway

---

## Unit 10: Testing

### Task 10.1: Property-Based Tests (Hypothesis)
- [ ] Create `backend/tests/test_properties.py` — 15 property-based tests matching design doc properties
- [ ] Property 1: Event parsing round-trip
- [ ] Property 4: Direct job percentage calculation
- [ ] Property 5: Indirect job multiplier
- [ ] Property 6: Plausibility warning threshold
- [ ] Property 7: Geographic distribution proportionality and conservation
- [ ] Property 8: Top-N ranking correctness
- [ ] Property 9: Radius filter enforcement
- [ ] Property 10: Dollar impact computation chain
- [ ] Property 14: Dollar formatting

### Task 10.2: Unit Tests (pytest)
- [ ] Create `backend/tests/test_event_parser.py` — test each event type, missing fields, invalid locations
- [ ] Create `backend/tests/test_impact_calculator.py` — test multiplier constants, WARN cross-reference, plausibility warning
- [ ] Create `backend/tests/test_commute_mapper.py` — test proportional distribution, uniform fallback, radius filter
- [ ] Create `backend/tests/test_business_exposure.py` — test data suppression handling, exposure ranking
- [ ] Create `backend/tests/test_formatters.py` — test dollar formatting, headline generation

### Task 10.3: Integration Tests
- [ ] Create `backend/tests/test_integration.py` — end-to-end: "Intel lays off 1,500 at Chandler, AZ" → complete response validation
- [ ] Test QCEW API URL construction and CSV parsing
- [ ] Test CBP API query and JSON parsing

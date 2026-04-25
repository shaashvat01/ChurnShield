# Implementation Plan: Economic Blast Radius Engine

## Overview

This plan implements the Economic Blast Radius Engine as an AWS serverless application: API Gateway for secure frontend-backend connection, Lambda functions for compute, S3 for data storage and static frontend hosting, and a React + deck.gl frontend. Tasks are ordered for hackathon efficiency: data pipeline first (unblocks everything), then core calculation engine, then Lambda + API Gateway wiring, then frontend. Property-based tests use Hypothesis (Python) and map to the 15 correctness properties in the design. All data files are pre-downloaded in `data/` and backed up to S3 bucket `economic-blast-radius-data-216989103356`.

## Tasks

- [ ] 1. AWS infrastructure and data pipeline
  - [ ] 1.1 Create the backend project structure and install dependencies
    - Create `backend/` directory with `requirements.txt` (pandas, pyarrow, hypothesis, pytest, boto3, requests)
    - Create `backend/lambdas/` directory for Lambda function handlers
    - Create `backend/shared/` package with `__init__.py` and `models.py` (Pydantic models for ParsedEvent, DirectImpact, IndirectImpact, DollarImpact, ZIPImpact, BusinessExposure, ExposureSummary, BLSComparison, AnalysisResponse matching the design's API contract)
    - Create `infrastructure/template.yaml` (SAM template) or `infrastructure/` CDK app defining: API Gateway REST API with `/analyze` POST and `/zcta-boundaries` GET routes, two Lambda functions (analyze_handler, zcta_handler), IAM roles with S3 read access to the data bucket, and CORS configuration on API Gateway
    - _Requirements: 9.1, 9.5_

  - [ ] 1.2 Implement data pipeline module (`backend/shared/data_pipeline.py`)
    - Implement `load_from_s3(bucket, key) -> bytes` — download data files from S3 bucket `economic-blast-radius-data-216989103356` using boto3
    - Implement `load_lodes(state: str) -> DataFrame` — load LODES OD Parquet/CSV from S3 into pandas DataFrame (use `/tmp/` for Lambda local caching)
    - Implement `load_xwalk(state: str) -> DataFrame` — load XWALK from S3 into pandas DataFrame
    - Implement `load_warn_data(state: str) -> DataFrame` — load WARN CSV from S3 (`data/warn-notices/az_warn_notices.csv`)
    - Implement `load_zcta_geojson() -> dict` — load AZ ZCTA GeoJSON from S3
    - Implement `/tmp/` file caching for Lambda: check if file exists in `/tmp/` before downloading from S3 (Lambda container reuse optimization)
    - Implement `fetch_qcew(county_fips, year, quarter) -> dict` — fetch from BLS QCEW API URL `https://data.bls.gov/cew/data/api/{year}/{quarter}/area/{county_fips}.csv`, parse CSV response. Fall back to pre-loaded S3 data (`data/qcew-wages/maricopa_county_2024_q2.csv`) if API unreachable.
    - Implement `fetch_cbp(zip_codes: list[str]) -> dict` — fetch from Census CBP API `https://api.census.gov/data/2022/cbp`. Fall back to pre-loaded S3 data (`data/cbp-business-patterns/zbp22detail.txt`) if API unreachable.
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

  - [ ] 1.3 Convert large CSV data files to Parquet and upload to S3
    - Write a one-time script `scripts/convert_to_parquet.py` that reads `data/lodes-arizona/az_od_main_JT00_2023.csv` and `data/lodes-arizona/az_xwalk.csv`, converts to Parquet with pyarrow, and uploads to S3 bucket under `data/lodes-arizona/` prefix
    - Parquet gives 5-10x faster reads and smaller file sizes — critical for Lambda cold start performance
    - _Requirements: 9.4, 9.5_

  - [ ]* 1.4 Write property test for cache TTL enforcement
    - **Property 13: Cache TTL enforcement**
    - Generate (fetched_at, ttl_hours, current_time) triples using Hypothesis; verify cache returns data when within TTL and returns None when expired
    - **Validates: Requirements 9.2, 9.3**

- [ ] 2. Event parser
  - [ ] 2.1 Implement event parser module (`backend/shared/event_parser.py`)
    - Implement `EventType` enum (LAYOFF, PLANT_CLOSURE, ACQUISITION, EARNINGS_MISS)
    - Implement `ParsedEvent` Pydantic model with all fields from design (employer_name, city, state, event_type, magnitude_type, magnitude_value, county_fips, work_zip_codes, work_census_blocks)
    - Implement `ParseError` exception class with `field` attribute identifying which field is missing/invalid
    - Implement `parse_event(text: str) -> ParsedEvent` using regex patterns to extract employer name, city, state, event type keywords, and magnitude (headcount or percentage). Raise `ParseError` with specific field name on failure.
    - Implement `resolve_location(city: str, state: str, xwalk_df: DataFrame) -> tuple[str, list[str], list[str]]` — filter XWALK by state, fuzzy-match city name against `ctyname` column, return (county_fips, zip_codes, census_blocks)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property test for event parsing round-trip
    - **Property 1: Event parsing round-trip**
    - Generate random (employer_name, city, state, event_type, magnitude_type, magnitude_value) tuples with Hypothesis, format into natural-language strings, parse with `parse_event`, verify field equality
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test for parser error detection
    - **Property 2: Parser error detection for missing or invalid fields**
    - Generate event strings missing magnitude or with invalid city/state using Hypothesis; verify `ParseError` is raised with correct `field` attribute
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.4 Write property test for location resolution consistency
    - **Property 3: Location resolution consistency with XWALK**
    - Sample (city, state) pairs from XWALK data; verify returned ZIP codes all have census blocks with matching county FIPS in XWALK
    - **Validates: Requirements 1.5**

- [ ] 3. Impact calculator
  - [ ] 3.1 Implement impact calculator module (`backend/shared/impact_calculator.py`)
    - Implement `get_moretti_multiplier(industry: str) -> float` — return 3.0 for "high-tech"/"semiconductor", 1.6 for "manufacturing"
    - Implement `calculate_direct_jobs(event: ParsedEvent, qcew_data: dict) -> DirectImpact` — if magnitude_type is "percentage", multiply by QCEW employment; if "headcount", use directly. Cross-reference WARN data if available.
    - Implement `calculate_indirect_jobs(direct: DirectImpact, industry: str) -> IndirectImpact` — multiply direct_jobs_lost by Moretti multiplier. Set plausibility_warning if indirect_jobs > 50% of county employment.
    - Implement `calculate_dollar_impact(total_jobs: int, county_fips: str, naics: str, qcew_data: dict) -> DollarImpact` — compute total_wage_loss = total_jobs × avg_annual_wage, retail_revenue_loss = total_wage_loss × 0.60, quarterly_retail_loss = retail_revenue_loss / 4
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.5_

  - [ ]* 3.2 Write property test for direct job loss percentage calculation
    - **Property 4: Direct job loss percentage calculation**
    - Generate positive (percentage, headcount) pairs with Hypothesis; verify result equals round(percentage × headcount)
    - **Validates: Requirements 2.1**

  - [ ]* 3.3 Write property test for indirect job loss via Moretti multiplier
    - **Property 5: Indirect job loss via Moretti multiplier**
    - Generate (direct_jobs, industry) pairs with Hypothesis; verify indirect_jobs == direct_jobs × get_moretti_multiplier(industry)
    - **Validates: Requirements 3.1**

  - [ ]* 3.4 Write property test for plausibility warning threshold
    - **Property 6: Plausibility warning threshold**
    - Generate (indirect_jobs, county_employment) pairs with Hypothesis; verify plausibility_warning is non-null iff indirect_jobs > 0.5 × county_employment
    - **Validates: Requirements 3.5**

  - [ ]* 3.5 Write property test for dollar impact computation chain
    - **Property 10: Dollar impact computation chain**
    - Generate (total_jobs, avg_annual_wage) pairs with Hypothesis; verify total_wage_loss == total_jobs × avg_annual_wage, retail_revenue_loss == total_wage_loss × 0.60, quarterly_retail_loss == retail_revenue_loss / 4
    - **Validates: Requirements 5.1, 5.2**

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Commute mapper
  - [ ] 5.1 Implement commute mapper module (`backend/shared/commute_mapper.py`)
    - Implement `distribute_impact(work_blocks, total_jobs, total_dollars, lodes_df, xwalk_df, radius_miles=15.0) -> list[ZIPImpact]`:
      - Filter LODES OD rows where `w_geocode` is in work_blocks
      - Map `h_geocode` to ZIP codes via XWALK
      - Aggregate commute flows by ZIP code
      - Compute each ZIP's share = zip_flow / total_flow
      - Compute estimated_jobs_lost = total_jobs × share, estimated_dollar_impact = total_dollars × share
      - Calculate distance from employer location using XWALK centroid coordinates; filter by radius_miles
      - Fall back to uniform distribution if no LODES data found
    - Implement `get_top_zips(zip_impacts, n=10) -> list[ZIPImpact]` — sort by share descending, return top N
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.4_

  - [ ]* 5.2 Write property test for geographic distribution proportionality and conservation
    - **Property 7: Geographic distribution proportionality and conservation**
    - Generate synthetic LODES-like commute flow DataFrames with Hypothesis; verify all shares non-negative, shares sum to 1.0 (within tolerance), each share equals zip_flow/total_flow, and dollar impact equals total_dollars × share
    - **Validates: Requirements 4.1, 4.3, 5.4**

  - [ ]* 5.3 Write property test for top-N ranking correctness
    - **Property 8: Top-N ranking correctness**
    - Generate lists of ZIPImpact-like objects with numeric scores and positive N with Hypothesis; verify top-N returns min(N, len) items in descending order, all returned scores ≥ all non-returned scores
    - **Validates: Requirements 4.4, 6.2, 6.3**

  - [ ]* 5.4 Write property test for radius filter enforcement
    - **Property 9: Radius filter enforcement**
    - Generate ZIP impacts with distances and a positive radius with Hypothesis; verify all output distances ≤ radius and no qualifying ZIP is excluded
    - **Validates: Requirements 4.5**

- [ ] 6. Business exposure analyzer
  - [ ] 6.1 Implement business exposure analyzer module (`backend/shared/business_exposure.py`)
    - Implement `analyze_exposure(zip_impacts: list[ZIPImpact], cbp_data: dict) -> ExposureSummary`:
      - For each affected ZIP, look up establishment counts by 2-digit NAICS from CBP data
      - Compute exposure_score = establishment_count × zip_impact_share for each NAICS category
      - Aggregate across ZIPs, rank by exposure_score descending
      - Return top 5 categories and total_affected_businesses (sum of establishment_count × share, rounded)
      - Handle suppressed "D" values by using establishment count only, setting data_suppressed=true
    - Implement `fetch_cbp_data(zip_codes: list[str]) -> dict` — wrapper around data_pipeline.fetch_cbp with error handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.2 Write property test for business exposure weighted sum
    - **Property 11: Business exposure weighted sum**
    - Generate (zip_code, establishment_count, zip_impact_share) tuples with Hypothesis where shares sum to 1.0; verify total_affected_businesses equals sum of (establishment_count × share) rounded to nearest integer
    - **Validates: Requirements 6.4**

- [ ] 7. BLS comparator and formatting utilities
  - [ ] 7.1 Implement BLS comparator module (`backend/shared/bls_comparator.py`)
    - Implement `build_comparison(event, total_impact, qcew_data) -> BLSComparison`:
      - Extract baseline employment and wages from QCEW data for the affected county
      - Compute predicted_employment = baseline - total_jobs_lost
      - Compute projected_report_quarter = event quarter end + 5 months
      - Set labels "BLS Reported" and "Engine Predicted"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 7.2 Implement formatting utilities (`backend/shared/formatters.py`)
    - Implement `format_dollars(amount: float) -> str` — "$X.XB" for ≥$1B, "$XM" for ≥$1M, "$X,XXX" with commas for <$1M. Always starts with "$".
    - Implement `format_headline(indirect_jobs, total_businesses, radius_miles) -> str` — returns headline string containing all three values
    - _Requirements: 10.1, 10.4_

  - [ ]* 7.3 Write property test for QCEW projected quarter calculation
    - **Property 12: QCEW projected quarter calculation**
    - Generate event dates with Hypothesis; verify projected quarter = calendar quarter containing (event_quarter_end + 5 months)
    - **Validates: Requirements 8.2**

  - [ ]* 7.4 Write property test for dollar formatting
    - **Property 14: Dollar formatting**
    - Generate non-negative dollar amounts with Hypothesis; verify "$X.XB" for ≥$1B, "$XM" for ≥$1M, "$X,XXX" for <$1M, always starts with "$"
    - **Validates: Requirements 10.1**

  - [ ]* 7.5 Write property test for headline generation
    - **Property 15: Headline generation from computed data**
    - Generate (indirect_jobs, total_businesses, radius_miles) tuples with Hypothesis; verify headline string contains all three values as formatted strings
    - **Validates: Requirements 10.4**

- [ ] 8. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Lambda handlers and API Gateway deployment
  - [ ] 9.1 Implement the analyze Lambda handler (`backend/lambdas/analyze_handler.py`)
    - Wire up the full analysis pipeline in a single Lambda function:
      1. Parse API Gateway event body to extract `event_text`
      2. Parse event text with `parse_event()`
      3. Load LODES, XWALK, WARN data from S3 via data pipeline (with `/tmp/` caching)
      4. Calculate direct impact with `calculate_direct_jobs()`
      5. Calculate indirect impact with `calculate_indirect_jobs()`
      6. Calculate dollar impact with `calculate_dollar_impact()`
      7. Distribute geographically with `distribute_impact()`
      8. Analyze business exposure with `analyze_exposure()`
      9. Build BLS comparison with `build_comparison()`
      10. Generate headline with `format_headline()`
      11. Return API Gateway-formatted response with statusCode 200, CORS headers, and JSON body matching the design's AnalysisResponse
    - Handle `ParseError` → return statusCode 400 with field-specific error message
    - Handle unexpected errors → return statusCode 500 with generic message
    - Configure Lambda with 1024MB memory and 60s timeout (pandas + large DataFrames need memory)
    - _Requirements: 1.1, 9.4, 10.4, 10.5_

  - [ ] 9.2 Implement the ZCTA boundaries Lambda handler (`backend/lambdas/zcta_handler.py`)
    - Load AZ ZCTA GeoJSON from S3 via data pipeline (with `/tmp/` caching)
    - Return API Gateway-formatted response with statusCode 200, CORS headers, and GeoJSON body
    - _Requirements: 7.3_

  - [ ] 9.3 Deploy API Gateway + Lambda stack
    - Package Lambda functions with shared modules and dependencies into a deployment ZIP (include `backend/shared/` and `pandas`, `pyarrow`, `boto3`, `requests` as Lambda layer or bundled)
    - Deploy API Gateway REST API with:
      - `POST /analyze` → analyze_handler Lambda (proxy integration)
      - `GET /zcta-boundaries` → zcta_handler Lambda (proxy integration)
      - CORS enabled on all routes (Access-Control-Allow-Origin: *, Access-Control-Allow-Methods: GET,POST,OPTIONS, Access-Control-Allow-Headers: Content-Type)
    - Use SAM CLI (`sam build && sam deploy`) or AWS CDK to deploy the stack
    - Record the API Gateway invoke URL for frontend configuration
    - _Requirements: 9.4_

  - [ ]* 9.4 Write integration test for the analyze Lambda handler
    - Invoke the handler locally with a mock API Gateway event containing "Intel announces 1,500 layoffs at Chandler, AZ semiconductor fab"
    - Verify response statusCode 200, body JSON contains all top-level keys (parsed_event, direct_impact, indirect_impact, dollar_impact, zip_impacts, exposure_summary, bls_comparison, headline, sources)
    - Verify sources array is non-empty
    - _Requirements: 9.4, 10.5_

- [ ] 10. Frontend — install dependencies and create types
  - [ ] 10.1 Install frontend dependencies and create TypeScript types
    - Install deck.gl packages: `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`, `@deck.gl/geo-layers`, `@loaders.gl/core`; install `maplibre-gl` for base map (free, no token)
    - Create `frontend/src/types/index.ts` with TypeScript interfaces matching the backend API response: `ParsedEvent`, `DirectImpact`, `IndirectImpact`, `DollarImpact`, `ZIPImpact`, `BusinessExposure`, `ExposureSummary`, `BLSComparison`, `AnalysisResponse`
    - Create `frontend/src/utils/formatters.ts` with `formatDollars(amount: number): string` and `formatNumber(n: number): string` matching the backend formatting rules
    - _Requirements: 10.1_

  - [ ] 10.2 Create the API hook (`frontend/src/hooks/useAnalysis.ts`)
    - Create `frontend/src/config.ts` with `API_BASE_URL` pointing to the API Gateway invoke URL (e.g., `https://{api-id}.execute-api.us-east-1.amazonaws.com/prod`)
    - Implement `useAnalysis()` hook that POSTs to `${API_BASE_URL}/analyze` with event_text, manages loading/error/data state
    - Implement `useZCTABoundaries()` hook that GETs `${API_BASE_URL}/zcta-boundaries`, caches result
    - _Requirements: 9.4_

- [ ] 11. Frontend — map and core components
  - [ ] 11.1 Implement the ImpactMap component (`frontend/src/components/ImpactMap.tsx`)
    - Render a deck.gl `DeckGL` component with `GeoJsonLayer` for ZCTA boundary polygons
    - Use MapLibre GL JS as the base map (no API token required)
    - Color polygons on a green-to-red diverging scale based on `estimated_dollar_impact` per ZIP
    - Center map on employer location coordinates from the analysis response
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 11.2 Implement the MapTooltip component (`frontend/src/components/MapTooltip.tsx`)
    - On hover/click of a ZIP polygon, display tooltip with: ZIP code, estimated job losses, dollar impact (formatted), top business categories
    - _Requirements: 7.5_

  - [ ] 11.3 Implement the EventInput component (`frontend/src/components/EventInput.tsx`)
    - Text input field with submit button
    - Pre-fill with example: "Intel announces 1,500 layoffs at Chandler, AZ semiconductor fab"
    - On submit, call the `useAnalysis` hook
    - Display loading state and error messages (field-specific from ParseError)
    - _Requirements: 1.1, 1.2, 1.3_

- [ ] 12. Frontend — panels and layout
  - [ ] 12.1 Implement the SummaryPanel component (`frontend/src/components/SummaryPanel.tsx`)
    - Display four headline stats: total dollar impact (formatted), total indirect jobs at risk, total affected small businesses, number of affected ZIP codes
    - _Requirements: 7.6, 10.4_

  - [ ] 12.2 Implement the ZIPRankList component (`frontend/src/components/ZIPRankList.tsx`)
    - Render a table of top 10 ZIP codes ranked by impact: ZIP code, estimated job losses, dollar impact (formatted)
    - _Requirements: 10.2_

  - [ ] 12.3 Implement the BusinessRankList component (`frontend/src/components/BusinessRankList.tsx`)
    - Render a table of top 5 NAICS categories ranked by exposure: NAICS label, establishment count, exposure score
    - _Requirements: 10.3_

  - [ ] 12.4 Implement the BLSComparisonPanel component (`frontend/src/components/BLSComparisonPanel.tsx`)
    - Side-by-side display: "BLS Reported" baseline vs "Engine Predicted" values
    - Show projected reporting quarter label
    - Distinct visual styling for reported vs predicted
    - _Requirements: 8.1, 8.4, 8.5_

  - [ ] 12.5 Implement the SourceAttribution component and wire up the main page layout
    - Create `frontend/src/components/SourceAttribution.tsx` — render data source footer from the `sources` array in the API response
    - Update `frontend/src/app/page.tsx` to compose all components into a single-page layout: EventInput at top, ImpactMap + SummaryPanel in main area, ZIPRankList + BusinessRankList + BLSComparisonPanel in side/bottom panels, SourceAttribution in footer
    - Ensure primary results visible without scrolling (single-page view)
    - _Requirements: 10.5, 10.6_

- [ ] 13. Final checkpoint — Ensure all tests pass and app runs end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 15 universal correctness properties using Hypothesis
- **Architecture: API Gateway (REST API) → Lambda functions → S3 data bucket**
- Lambda analyze_handler needs 1024MB+ memory for pandas DataFrame operations on LODES data (~164MB CSV)
- Use `/tmp/` caching in Lambda to avoid re-downloading S3 data on warm invocations (Lambda container reuse)
- Convert LODES CSV to Parquet before deploying (Task 1.3) — critical for Lambda cold start performance
- API Gateway provides HTTPS, throttling, and CORS out of the box — no need for manual CORS middleware
- Frontend calls API Gateway invoke URL directly — no proxy needed
- Backend tasks (1–8) can be parallelized across team members: data pipeline (1), parser+calculator (2–3), mapper+exposure+comparator (5–7)
- Frontend tasks (10–12) depend on API Gateway URL but can start with mocked data
- All data files are in S3 bucket `economic-blast-radius-data-216989103356` — Lambda reads from there at runtime

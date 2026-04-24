# Requirements Document

## Introduction

The Economic Blast Radius Engine is a web application that predicts the economic ripple effects of major employer events (layoffs, acquisitions, earnings misses) on surrounding local economies. It produces geospatial heatmaps with dollar-figure impact estimates, affected ZIP codes, and exposed business categories — surfacing predictions 6–18 months before BLS data catches up. This is an 11-hour hackathon build for a 3-person team.

## Evidence-Based Data Source Verification

The following data sources have been verified through direct inspection of APIs, file directories, and documentation. Each entry documents what was found, the format, and any constraints.

### LEHD LODES (Origin-Destination Employment Statistics)
- **Verified URL**: `https://lehd.ces.census.gov/data/lodes/LODES8/az/od/` — directory listing confirmed
- **Arizona data available**: 2004–2023 (LODES 8.3 release, confirmed via [Census press release, Nov 2024](https://www.census.gov/newsroom/press-releases/2024/onthemap-lodes-data.html))
- **Format**: Gzipped CSV files (~400KB each for AZ OD files), directly downloadable via HTTP
- **File naming**: `az_od_main_JT00_2023.csv.gz` (state, type, job type, year)
- **Key columns**: `h_geocode` (home census block, 15-digit), `w_geocode` (work census block, 15-digit), `S000` (total jobs), `SA01`–`SA03` (age segments), `SE01`–`SE03` (earnings segments), `SI01`–`SI03` (industry segments)
- **Geographic Crosswalk (XWALK)**: Maps every 2020 Census block to tracts, counties, metros, congressional districts, ZCTAs (ZIP Code Tabulation Areas), and lat/lon coordinates. ~8.2 million rows per state. This is the critical link from census-block-level commute data to ZIP-code-level output.
- **Access**: No API key required. Direct HTTP download. Python `pandas.read_csv()` can read directly from URL.
- **Constraint**: Data lags ~2 years (latest is 2023 for most states). This is acceptable because commute patterns are structurally stable year-over-year.

### BLS QCEW (Quarterly Census of Employment and Wages)
- **Verified URL**: `https://data.bls.gov/cew/data/api/{year}/{quarter}/area/{area_code}.csv`
- **Format**: CSV files, sliceable by area, industry, or establishment size class
- **Coverage**: Every NAICS industry for 3,000+ counties, quarterly, back to 1975
- **Key fields**: Area FIPS code, ownership code, NAICS industry code, year, quarter, monthly employment levels (month1–month3), total quarterly wages, average weekly wage, establishment count
- **Access**: No API key required. Direct HTTP GET returns CSV. BLS provides [sample Python code](https://www.bls.gov/cew/additional-resources/open-data/sample-code.htm) for programmatic access.
- **Constraint**: Published ~5 months after quarter end. This lag is actually the feature — the engine predicts what QCEW will eventually report.

### Census County Business Patterns (CBP) / ZIP Code Business Patterns (ZBP)
- **Verified URL**: `https://api.census.gov/data/2022/cbp?get=NAME,NAICS2017_LABEL,ESTAB,PAYANN,PAYQTR1,EMP&for=zip%20code:*`
- **Format**: JSON array via Census Data API; also available as bulk CSV downloads
- **Coverage**: Establishment counts, employment, payroll by ZIP code and 2–6 digit NAICS code. Data available 2019+ via unified CBP API (earlier ZBP data via separate endpoint, 1994–2018).
- **Key fields**: `ESTAB` (establishment count), `EMP` (employment), `PAYANN` (annual payroll), `PAYQTR1` (Q1 payroll), `NAICS2017` (industry code), `NAICS2017_LABEL` (industry name), ZIP code
- **Access**: Requires free Census API key (instant registration at [api.census.gov](https://api.census.gov/data/key_signup.html)). No rate limit issues for hackathon-scale queries.
- **Constraint**: ZBP at ZIP level only shows establishment counts by NAICS size class — actual employment figures are suppressed at fine NAICS × ZIP granularity to protect confidentiality. Workaround: use county-level CBP for employment by NAICS, distribute proportionally to ZIP using establishment counts.

### WARN Act Notices
- **Arizona source**: `https://www.azjobconnection.gov/warn_info` — confirmed active, provides searchable database of WARN notices
- **Scraper available**: `warn-scraper` Python package ([PyPI](https://pypi.org/project/warn-scraper/), [GitHub](https://github.com/biglocalnews/warn-scraper)) — Stanford Big Local News project, Apache 2.0 license, supports AZ and 40+ other states
- **Usage**: `warn-scraper AZ` outputs CSV with company name, location, number of employees affected, notice date, layoff date
- **Alternative**: Pre-compiled dataset at [layoffdata.com](https://layoffdata.com/data/) through 11/2023; [warntracker.com](https://www.warntracker.com/?state=AZ) for more recent data
- **Constraint**: WARN only covers employers with 100+ employees and layoffs of 50+ workers. Smaller layoffs are not captured. For the hackathon demo (Intel Chandler), this is not an issue — Intel is well above the threshold.

### SEC EDGAR (Tier 2)
- **Verified API**: `https://data.sec.gov/submissions/CIK##########.json` — free, no auth required, JSON format, real-time updates
- **Full-text search**: `https://efts.sec.gov/LATEST/search-index` — accepts POST with JSON body, supports keyword search across all filings since 2001, filterable by form type (8-K), date range
- **8-K filings**: Item 2.05 (Costs Associated with Exit or Disposal Activities) is the specific 8-K item for layoff/restructuring announcements
- **Access**: No API key. Must include User-Agent header per SEC policy. Rate limit: 10 requests/second.
- **Constraint**: Requires parsing HTML/text from filing documents to extract structured layoff data. For hackathon, better to use WARN data as primary and SEC as supplementary validation.

### Census TIGER/Line Shapefiles (Tier 2)
- **Verified**: 2024 TIGER/Line shapefiles released September 2024, available at `https://www.census.gov/geographies/mapping-files/2024/geo/tiger-line-file.html`
- **ZCTA boundaries**: Available as shapefiles (.shp) and GeoPackage (.gpkg) format
- **Alternative**: For the hackathon, the LODES XWALK file provides census block centroids (lat/lon), which can be aggregated to ZIP-level polygons. Combined with a pre-built GeoJSON of ZCTA boundaries (freely available from Census or community sources), this eliminates the need to process raw shapefiles.

### Mapbox GL JS (Frontend Mapping)
- **Free tier**: 50,000 map loads/month — more than sufficient for hackathon demo
- **Alternative**: deck.gl (open source, WebGL-powered, MIT license) can render heatmaps without Mapbox dependency, or can layer on top of Mapbox/MapLibre base maps
- **Recommendation**: Use deck.gl HeatmapLayer on top of MapLibre GL JS (open-source fork of Mapbox GL JS v1, BSD license, no token required for self-hosted tiles) for zero-cost option, or Mapbox GL JS with free tier for better base map quality

### Moretti Multiplier (Analytical Foundation)
- **Source**: Enrico Moretti (UC Berkeley), "Local Multipliers" (American Economic Review, 2010)
- **Finding**: Each new high-tech job in a metro area creates approximately 5 additional local jobs in non-traded sectors over 10 years. For manufacturing/non-tech traded sectors, the multiplier is approximately 1.6.
- **For this engine**: The user's proposed 3.0x multiplier is a reasonable middle-ground estimate for a large semiconductor employer like Intel (high-tech traded sector). Moretti's research supports multipliers ranging from 1.6x (manufacturing) to 5.0x (high-tech innovation), so 3.0x is defensible for a mixed high-tech/manufacturing employer.
- **Confirmed by**: Richmond Fed (2025) applied Moretti's framework to analyze federal layoff ripple effects, validating the methodology's continued relevance.

## Glossary

- **Engine**: The Economic Blast Radius Engine web application
- **Event_Parser**: The subsystem that accepts and validates user-entered employer event descriptions
- **Impact_Calculator**: The subsystem that computes direct and indirect economic impact using multiplier models and geographic distribution
- **Commute_Mapper**: The subsystem that distributes job losses geographically using LEHD LODES origin-destination commute flow data
- **Business_Exposure_Analyzer**: The subsystem that identifies and ranks affected business categories using CBP/ZBP establishment data by NAICS code
- **Heatmap_Renderer**: The frontend subsystem that renders geospatial impact visualization on an interactive map
- **Data_Pipeline**: The backend subsystem that ingests, caches, and serves data from Census, BLS, and WARN sources
- **LODES**: Longitudinal Employer-Household Dynamics Origin-Destination Employment Statistics — Census Bureau dataset providing worker commute flows at census block level
- **QCEW**: Quarterly Census of Employment and Wages — BLS dataset providing employment and wage data by county and industry
- **CBP**: County Business Patterns — Census Bureau dataset providing establishment counts and employment by geography and NAICS industry
- **ZBP**: ZIP Code Business Patterns — subset of CBP at ZIP code level
- **NAICS**: North American Industry Classification System — standard for classifying business establishments
- **ZCTA**: ZIP Code Tabulation Area — Census Bureau's geographic approximation of USPS ZIP codes
- **XWALK**: Geographic crosswalk file mapping census blocks to higher-level geographies (ZIP, county, tract, metro)
- **WARN**: Worker Adjustment and Retraining Notification Act — federal law requiring 60-day advance notice of mass layoffs
- **Moretti_Multiplier**: The local employment multiplier derived from Moretti (2010) research, used to estimate indirect job losses from direct employer events

## Requirements

### Requirement 1: Event Input Parsing

**User Story:** As a user, I want to enter a natural-language description of a major employer event, so that the engine can extract structured parameters for impact analysis.

#### Acceptance Criteria

1. WHEN a user submits an event description containing an employer name, location, and event type, THE Event_Parser SHALL extract the employer name, city, state, event type (layoff, acquisition, earnings miss), and magnitude (percentage or headcount) into structured fields within 500 milliseconds
2. WHEN a user submits an event description missing the event magnitude, THE Event_Parser SHALL prompt the user to provide the missing magnitude value
3. IF the Event_Parser cannot identify a valid US city and state in the event description, THEN THE Event_Parser SHALL display an error message specifying which location field is missing or unrecognized
4. THE Event_Parser SHALL support the following event types: workforce reduction (layoff), plant closure, acquisition, and earnings miss
5. WHEN a valid event is parsed, THE Event_Parser SHALL resolve the employer location to a FIPS county code and set of encompassing ZIP codes using the LODES XWALK geographic crosswalk

### Requirement 2: Direct Job Loss Estimation

**User Story:** As a user, I want the engine to estimate direct job losses from the employer event, so that I have a baseline for ripple-effect calculations.

#### Acceptance Criteria

1. WHEN an event specifies a percentage workforce reduction, THE Impact_Calculator SHALL compute direct job losses by multiplying the percentage by the employer's known headcount at the specified location
2. WHEN an event specifies an absolute headcount reduction, THE Impact_Calculator SHALL use that headcount directly as the direct job loss figure
3. WHEN employer headcount at a specific location is not available, THE Impact_Calculator SHALL estimate it using QCEW county-level employment data for the employer's primary NAICS industry, filtered by the employer's county FIPS code
4. THE Impact_Calculator SHALL cross-reference the direct job loss estimate against WARN Act notice data (where available) to validate or refine the estimate
5. IF WARN data for the specified employer and location exists, THEN THE Impact_Calculator SHALL display both the user-entered estimate and the WARN-reported figure

### Requirement 3: Indirect Job Loss Calculation via Moretti Multiplier

**User Story:** As a user, I want the engine to estimate indirect job losses caused by the employer event, so that I can understand the full economic ripple effect on the local economy.

#### Acceptance Criteria

1. THE Impact_Calculator SHALL compute indirect job losses by multiplying direct job losses by the Moretti_Multiplier value appropriate to the employer's industry sector
2. THE Impact_Calculator SHALL use a default Moretti_Multiplier of 3.0 for high-tech and semiconductor manufacturing employers
3. THE Impact_Calculator SHALL use a default Moretti_Multiplier of 1.6 for general manufacturing employers
4. THE Impact_Calculator SHALL display the multiplier value used and its academic source (Moretti 2010) alongside the indirect job loss estimate
5. WHEN the total indirect job loss estimate exceeds 50% of the county's total non-farm employment (per QCEW data), THE Impact_Calculator SHALL flag the estimate with a plausibility warning

### Requirement 4: Geographic Distribution of Impact via Commute Patterns

**User Story:** As a user, I want to see how job losses are distributed geographically across surrounding ZIP codes, so that I can identify which communities are most affected.

#### Acceptance Criteria

1. WHEN direct and indirect job losses are calculated, THE Commute_Mapper SHALL distribute losses across ZIP codes using LEHD LODES origin-destination data for the employer's work-location census blocks
2. THE Commute_Mapper SHALL load the Arizona LODES OD main file (`az_od_main_JT00_2023.csv.gz`) and the XWALK geographic crosswalk file to map census block geocodes to ZCTA (ZIP) codes
3. THE Commute_Mapper SHALL compute each ZIP code's share of total impact proportional to the number of workers commuting from that ZIP to the employer's work-location census blocks
4. THE Commute_Mapper SHALL rank ZIP codes by estimated impact and return the top 10 most-affected ZIP codes with their individual impact figures
5. THE Commute_Mapper SHALL limit the geographic scope to a configurable radius (default 15 miles) from the employer's primary location, using census block centroid coordinates from the XWALK file
6. IF LODES data is not available for the specified state, THEN THE Commute_Mapper SHALL fall back to a uniform distribution across ZIP codes within the configured radius and display a data-availability warning

### Requirement 5: Dollar Impact Estimation

**User Story:** As a user, I want to see the estimated dollar impact on local retail revenue, so that I can quantify the economic damage in monetary terms.

#### Acceptance Criteria

1. THE Impact_Calculator SHALL compute dollar impact by multiplying total affected jobs (direct plus indirect) by the average annual wage from QCEW data for the employer's county and industry
2. THE Impact_Calculator SHALL apply a local spending rate of 60% to the total wage loss to estimate retail revenue impact
3. THE Impact_Calculator SHALL retrieve average weekly wage data from the QCEW Open Data API using the URL pattern `https://data.bls.gov/cew/data/api/{year}/{quarter}/area/{county_fips}.csv`
4. THE Impact_Calculator SHALL distribute the dollar impact across ZIP codes using the same proportional distribution computed by the Commute_Mapper
5. THE Impact_Calculator SHALL present the total dollar impact as a quarterly retail revenue loss figure (e.g., "$340M predicted Q3 retail revenue loss")

### Requirement 6: Business Exposure Analysis by NAICS Category

**User Story:** As a user, I want to see which types of small businesses are most exposed to the economic ripple effect, so that I can understand which business categories face the greatest risk.

#### Acceptance Criteria

1. WHEN ZIP-level impact distribution is computed, THE Business_Exposure_Analyzer SHALL query the Census CBP API (`https://api.census.gov/data/2022/cbp`) for establishment counts by 2-digit NAICS code for each affected ZIP code
2. THE Business_Exposure_Analyzer SHALL rank business categories by exposure, computed as the product of establishment count in affected ZIPs and the proportional impact score for those ZIPs
3. THE Business_Exposure_Analyzer SHALL return the top 5 most-exposed business categories with their NAICS labels and estimated number of affected establishments
4. THE Business_Exposure_Analyzer SHALL compute total affected small businesses across all affected ZIP codes by summing establishment counts weighted by ZIP-level impact proportion
5. IF the Census CBP API returns suppressed data (indicated by null or "D" values for employment) for a ZIP-NAICS combination, THEN THE Business_Exposure_Analyzer SHALL use the establishment count alone as the exposure proxy and note the data suppression

### Requirement 7: Geospatial Heatmap Visualization

**User Story:** As a user, I want to see an interactive heatmap showing the geographic distribution of economic impact, so that I can visually identify the blast radius of the employer event.

#### Acceptance Criteria

1. WHEN impact data is computed, THE Heatmap_Renderer SHALL display an interactive map centered on the employer's location with color-gradient overlays representing impact intensity by ZIP code
2. THE Heatmap_Renderer SHALL use deck.gl HeatmapLayer or GeoJsonLayer with a diverging color scale (green-to-red) where intensity corresponds to the estimated dollar impact per ZIP code
3. THE Heatmap_Renderer SHALL load ZCTA boundary polygons from a pre-built GeoJSON file (sourced from Census TIGER/Line 2024 ZCTA shapefiles or an equivalent community-maintained ZCTA GeoJSON) to render ZIP code polygon overlays on the map
4. THE Heatmap_Renderer SHALL render the initial map view within 2 seconds after impact data is received from the backend
5. WHEN a user hovers over or clicks a ZIP code polygon on the map, THE Heatmap_Renderer SHALL display a tooltip showing the ZIP code, estimated job losses, dollar impact, and top affected business categories for that ZIP
6. THE Heatmap_Renderer SHALL display a summary panel alongside the map showing: total dollar impact, total indirect jobs at risk, total affected small businesses, and the number of affected ZIP codes

### Requirement 8: BLS Comparison Panel

**User Story:** As a user, I want to see a comparison between the engine's predictions and what BLS QCEW data will eventually report, so that I can understand the predictive value of the engine.

#### Acceptance Criteria

1. THE Engine SHALL display a comparison panel showing the predicted impact alongside the most recent available QCEW data for the affected county and industry
2. THE Engine SHALL compute the projected QCEW reporting quarter based on the event date plus the standard QCEW publication lag (approximately 5 months after quarter end)
3. WHEN historical QCEW data is available for a prior quarter, THE Engine SHALL show the baseline employment and wage figures for the affected county-industry combination
4. THE Engine SHALL label the comparison as "What BLS QCEW will report in {projected quarter} based on current trajectory"
5. THE Engine SHALL clearly distinguish between verified historical data (labeled "BLS Reported") and engine predictions (labeled "Engine Predicted") using distinct visual styling

### Requirement 9: Data Pipeline and Caching

**User Story:** As a user, I want the engine to respond within 5 seconds of submitting an event, so that the demo experience is fast and compelling.

#### Acceptance Criteria

1. THE Data_Pipeline SHALL pre-download and cache LODES OD and XWALK files for Arizona (and optionally other target demo states) at application startup or during a build step
2. THE Data_Pipeline SHALL cache QCEW area-level CSV responses after first retrieval, with a cache expiration of 24 hours
3. THE Data_Pipeline SHALL cache CBP API responses after first retrieval, with a cache expiration of 7 days (data is annual, changes infrequently)
4. WHEN all required data is cached, THE Engine SHALL return complete impact results within 5 seconds of event submission
5. THE Data_Pipeline SHALL store cached data files in a format readable by pandas (CSV or Parquet) to minimize deserialization overhead
6. IF a data source API is unreachable during a live query, THEN THE Data_Pipeline SHALL serve the most recent cached version and display a staleness indicator showing the cache date

### Requirement 10: Demo-Ready Output Format

**User Story:** As a user, I want the output to be presentation-ready with clear dollar figures, ranked lists, and a professional map, so that the hackathon demo is compelling and credible.

#### Acceptance Criteria

1. THE Engine SHALL display all dollar figures formatted with appropriate units (e.g., "$340M" not "$340,000,000") and rounded to the nearest million for figures above $1M
2. THE Engine SHALL display the top 10 most-exposed ZIP codes as a ranked list with ZIP code, estimated job losses, and dollar impact per ZIP
3. THE Engine SHALL display the top 5 most-exposed small business categories as a ranked list with NAICS category name and estimated number of affected establishments
4. THE Engine SHALL display a headline summary (e.g., "4,200 indirect jobs at risk across 1,847 small businesses within 15-mile radius") computed from the underlying data
5. THE Engine SHALL include source attribution for all data (e.g., "Source: Census LEHD LODES 2023, BLS QCEW 2024 Q2, Census CBP 2022") displayed in a footer or info panel
6. THE Engine SHALL render the complete output (map, summary panel, ranked lists, comparison panel) as a single-page view without requiring scrolling for the primary results

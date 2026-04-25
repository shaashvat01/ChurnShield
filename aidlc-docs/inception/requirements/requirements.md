# Requirements Analysis — Economic Blast Radius Engine (ChurnShield)

## Intent Analysis Summary

- **User Request**: Build a web application that predicts economic ripple effects of major employer events (layoffs, acquisitions, earnings misses) on surrounding local economies, producing geospatial heatmaps with dollar-figure impact estimates, affected ZIP codes, and exposed business categories.
- **Request Type**: New Feature (backend engine + data pipeline) + Enhancement (connect existing frontend demo to live data)
- **Scope Estimate**: System-wide — spans frontend, backend API, data pipeline, and infrastructure
- **Complexity Estimate**: Complex — multiple external data sources (Census LODES, BLS QCEW, Census CBP, WARN Act), economic modeling (Moretti multiplier), geospatial computation, and real-time visualization
- **Context**: 11-hour hackathon build for a 3-person team. Demo-first approach with Intel Chandler, AZ as primary scenario.

---

## Functional Requirements

### FR-1: Event Input Parsing
The system shall accept natural-language event descriptions and extract structured parameters (employer name, city, state, event type, magnitude) using regex-based parsing. Location resolution maps to FIPS county codes and ZIP codes via LODES XWALK crosswalk data.

**Acceptance Criteria**: 5 criteria covering field extraction (<500ms), missing magnitude prompting, invalid location error messaging, 4 supported event types, and FIPS/ZIP resolution.

**Source**: Spec Requirement 1

### FR-2: Direct Job Loss Estimation
The system shall compute direct job losses from percentage-based or absolute headcount reductions. When employer headcount is unavailable, QCEW county-level employment data provides estimates. WARN Act data cross-references and validates estimates.

**Acceptance Criteria**: 5 criteria covering percentage computation, absolute headcount passthrough, QCEW fallback estimation, WARN cross-referencing, and dual-figure display.

**Source**: Spec Requirement 2

### FR-3: Indirect Job Loss Calculation (Moretti Multiplier)
The system shall compute indirect job losses using the Moretti (2010) local employment multiplier: 3.0x for high-tech/semiconductor, 1.6x for general manufacturing. A plausibility warning triggers when indirect losses exceed 50% of county non-farm employment.

**Acceptance Criteria**: 5 criteria covering multiplier application, default values by industry, academic source attribution, and plausibility threshold warning.

**Source**: Spec Requirement 3

### FR-4: Geographic Distribution via Commute Patterns
The system shall distribute job losses across ZIP codes using LEHD LODES origin-destination commute flow data. Each ZIP's share is proportional to commuter flow to employer work-location census blocks. Results are ranked (top 10) and radius-filtered (default 15 miles).

**Acceptance Criteria**: 6 criteria covering LODES-based distribution, file loading (az_od_main_JT00_2023.csv.gz + XWALK), proportional computation, top-10 ranking, configurable radius, and uniform fallback when LODES is unavailable.

**Source**: Spec Requirement 4

### FR-5: Dollar Impact Estimation
The system shall compute dollar impact as: total_jobs × avg_annual_wage × 0.60 spending rate, presented as quarterly retail revenue loss. QCEW API provides wage data. Dollar impact distributes across ZIPs using the same commute-based proportions.

**Acceptance Criteria**: 5 criteria covering wage-based computation, 60% spending rate, QCEW API URL pattern, ZIP-level distribution, and quarterly presentation format.

**Source**: Spec Requirement 5

### FR-6: Business Exposure Analysis by NAICS
The system shall query Census CBP API for establishment counts by 2-digit NAICS code in affected ZIPs. Categories are ranked by exposure score (establishment_count × impact_proportion). Top 5 categories and total affected businesses are reported. Suppressed data ("D" values) handled gracefully.

**Acceptance Criteria**: 5 criteria covering CBP API querying, exposure ranking, top-5 reporting, weighted business totals, and data suppression handling.

**Source**: Spec Requirement 6

### FR-7: Geospatial Heatmap Visualization
The system shall render an interactive map with deck.gl GeoJsonLayer using ZCTA boundary polygons, green-to-red color scale by dollar impact, hover/click tooltips (ZIP, jobs, dollars, business categories), and a summary panel (total dollars, indirect jobs, affected businesses, ZIP count). Initial render within 2 seconds.

**Acceptance Criteria**: 6 criteria covering map rendering, deck.gl layer configuration, ZCTA GeoJSON loading, 2-second render target, tooltip interactivity, and summary panel display.

**Source**: Spec Requirement 7

### FR-8: BLS Comparison Panel
The system shall display a comparison panel showing engine predictions alongside historical QCEW data. Projected QCEW reporting quarter is computed from event date + 5-month publication lag. Distinct visual styling differentiates "BLS Reported" vs "Engine Predicted" labels.

**Acceptance Criteria**: 5 criteria covering comparison panel display, projected quarter computation, baseline data retrieval, predictive labeling, and visual distinction.

**Source**: Spec Requirement 8

### FR-9: Data Pipeline and Caching
The system shall pre-cache LODES/XWALK files as Parquet at build time, cache QCEW responses (24h TTL) and CBP responses (7-day TTL) in-memory, and serve complete results within 5 seconds when cached. Stale cache served with indicator when APIs are unreachable.

**Acceptance Criteria**: 6 criteria covering pre-download caching, QCEW TTL, CBP TTL, 5-second response target, Parquet/CSV storage format, and staleness indicator fallback.

**Source**: Spec Requirement 9

### FR-10: Demo-Ready Output Format
The system shall format dollar figures with appropriate units ($340M not $340,000,000), display top-10 ZIP ranked list, top-5 business category list, headline summary with computed values, source attribution footer, and single-page view without scrolling.

**Acceptance Criteria**: 6 criteria covering dollar formatting, ZIP ranking, business ranking, headline generation, source attribution, and single-page layout.

**Source**: Spec Requirement 10

---

## Non-Functional Requirements

### NFR-1: Performance
- Complete analysis response within 5 seconds when data is cached (FR-9)
- Event parsing within 500ms (FR-1)
- Initial map render within 2 seconds after data receipt (FR-7)
- Frontend API timeout at 10 seconds with retry button

### NFR-2: Data Freshness & Reliability
- QCEW cache TTL: 24 hours
- CBP cache TTL: 7 days
- LODES data: structurally stable, 2-year lag acceptable
- Graceful degradation: serve stale cache when APIs unreachable

### NFR-3: Scalability (Hackathon Scope)
- Single FastAPI server on EC2 (no Lambda cold-start concerns)
- In-memory dict cache (Arizona dataset fits in memory)
- Pre-cached Parquet files for 5-10x faster reads than CSV

### NFR-4: Security
- Census API key required for CBP queries (free registration)
- SEC EDGAR requires User-Agent header (10 req/sec rate limit)
- No authentication required for demo (hackathon scope)

### NFR-5: Usability
- Single-page view, no scrolling for primary results
- Professional presentation-ready output
- Clear source attribution for all data
- Distinct visual styling for predicted vs. reported data

### NFR-6: Accuracy & Transparency
- Moretti multiplier values sourced from peer-reviewed research (AER 2010)
- Plausibility warnings when estimates exceed reasonable thresholds
- Dual display of user estimates and WARN-reported figures
- All data sources cited in footer

---

## Data Source Requirements

| Source | Format | Access | Cache TTL | Constraint |
|--------|--------|--------|-----------|------------|
| LEHD LODES OD | Gzipped CSV → Parquet | HTTP, no auth | Pre-cached at build | 2-year lag |
| LODES XWALK | CSV → Parquet | HTTP, no auth | Pre-cached at build | 8.2M rows/state |
| BLS QCEW | CSV via API | HTTP, no auth | 24 hours | 5-month publication lag |
| Census CBP/ZBP | JSON via API | Census API key | 7 days | Employment suppressed at fine granularity |
| WARN Act | CSV (scraped) | warn-scraper package | Pre-downloaded | Only covers 100+ employee firms |
| ZCTA Boundaries | GeoJSON | Pre-built file | Static | Census TIGER/Line 2024 |
| SEC EDGAR | JSON | HTTP, User-Agent header | Tier 2 (supplementary) | 10 req/sec rate limit |

---

## Architectural Decisions (Resolved)

1. **Lambda + API Gateway over FastAPI on EC2**: User override — serverless deployment via CDK. Parquet files stored in S3, loaded per Lambda invocation (AZ dataset ~400KB, feasible per-request)
2. **Pre-cached Parquet in S3**: LODES/XWALK converted to Parquet, stored in S3, read by Lambda at invocation time
3. **Frontend map rendering**: Already completed (Leaflet-based), no migration to deck.gl needed
4. **Regex parsing over NLP**: Sufficient for semi-structured hackathon demo input
5. **Arizona primary, parameterized**: State is a parameter, but only AZ data pre-cached for demo
6. **Parallel development**: Backend and frontend built simultaneously via sub-agents, connected at integration
7. **Data ingestion approach**: Flexible — user still considering (design for S3 as data store regardless)
8. **Census API key**: Already handled, not a concern

---

## Identified Gaps & Considerations

1. **Infrastructure Gap**: The CDK backend stack is empty — needs EC2 instance, security groups, and deployment configuration for FastAPI server
2. **Frontend-Backend Integration**: Current frontend uses hardcoded demo data — needs API integration hooks
3. **Data Ingestion Pipeline**: No build-step scripts exist yet for downloading and converting LODES/XWALK to Parquet
4. **ZCTA GeoJSON Source**: Need to identify and include the pre-built Arizona ZCTA boundary GeoJSON file
5. **Census API Key Management**: Need environment variable or secrets management for the CBP API key
6. **deck.gl Migration**: Current frontend uses Leaflet — design doc specifies deck.gl GeoJsonLayer, which is a different rendering library

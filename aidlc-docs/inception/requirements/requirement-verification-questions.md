# Requirements Verification Questions

The existing spec docs are comprehensive. These questions address the 6 identified gaps between the spec and the current codebase state.

## Question 1
The current frontend uses Leaflet for map rendering, but the design doc specifies deck.gl GeoJsonLayer. Which approach should we take?

A) Migrate to deck.gl GeoJsonLayer as specified in the design doc (recommended for ZCTA polygon overlays and tooltips)
B) Keep Leaflet and adapt the heatmap visualization to work with Leaflet's GeoJSON layer
C) Use MapLibre GL JS (open-source Mapbox fork) with deck.gl overlay for best of both worlds
D) Other (please describe after [Answer]: tag below)

[Answer]: D Already completed

## Question 2
The backend design specifies FastAPI on EC2. The existing CDK stack is an empty scaffold. What infrastructure approach should we use?

A) Deploy FastAPI on a single EC2 instance with CDK (as specified in design doc — simplest for hackathon)
B) Deploy FastAPI as a containerized service on ECS Fargate with CDK
C) Deploy as Lambda functions behind API Gateway (contradicts design doc but serverless)
D) Skip CDK infrastructure for now — run FastAPI locally for the hackathon demo
E) Other (please describe after [Answer]: tag below)

[Answer]: C

## Question 3
For the data ingestion pipeline (LODES, XWALK, WARN data), when should pre-processing happen?

A) Build-time script that downloads and converts to Parquet, committed to repo or S3
B) Application startup — FastAPI downloads and caches on first boot
C) Separate CLI tool that runs before deployment, outputs to data/ directory
D) Pre-process manually and include Parquet files in the deployment artifact
E) Other (please describe after [Answer]: tag below)

[Answer]: E Custom Approach

## Question 4
The Census CBP API requires a free API key. How should this be managed?

A) Environment variable on the EC2 instance / container
B) AWS Secrets Manager, retrieved at application startup
C) .env file (gitignored) for local development, environment variable for production
D) Other (please describe after [Answer]: tag below)

[Answer]: D Not required, all done

## Question 5
The design doc mentions Arizona as the primary demo state. Should the system support multiple states from the start?

A) Arizona only — hardcode state-specific paths and optimize for the Intel Chandler demo
B) Arizona primary, but parameterize state so adding others later is straightforward
C) Support all 50 states from the start (significantly more data to pre-cache)
D) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 6
For the hackathon demo, what is the priority order if time runs short?

A) Backend engine first (parsing + calculation + data pipeline), then connect to frontend
B) Frontend visualization first (map + panels with mock API), then build real backend
C) End-to-end thin slice first (one simplified flow from input to map), then expand
D) Other (please describe after [Answer]: tag below)

[Answer]: A and B

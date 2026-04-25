# Requirements Clarification Questions

I detected ambiguities in 3 of your responses that need quick clarification before proceeding.

## Ambiguity 1: Infrastructure Approach (Q2 → C: Lambda + API Gateway)
Your answer overrides the design doc's FastAPI-on-EC2 decision. This changes the backend architecture significantly — pandas DataFrames can't stay in-memory across Lambda invocations, and cold starts may affect the 5-second response target.

### Clarification Question 1
How should we handle the data pipeline given Lambda's stateless nature?

A) Store pre-processed Parquet files in S3, load into Lambda memory on each invocation (works for small AZ dataset ~400KB)
B) Use Lambda with EFS mount for persistent data access (avoids re-loading)
C) Keep FastAPI as the design doc specifies but deploy it as a Lambda container image (best of both — keeps pandas in-memory during warm invocations)
D) Other (please describe after [Answer]: tag below)

[Answer]: A

## Ambiguity 2: Data Ingestion Custom Approach (Q3 → E)
You selected "Custom Approach" but didn't describe it.

### Clarification Question 2
What is your preferred data ingestion approach?

A) Pre-process data locally, upload Parquet/CSV to S3, Lambda reads from S3 at invocation
B) CDK custom resource that runs a data ingestion Lambda during stack deployment
C) GitHub Actions / CI pipeline step that processes data and uploads to S3 before deployment
D) Other (please describe after [Answer]: tag below)

[Answer]: D Considering

## Ambiguity 3: Priority Order (Q6 → "A and B")
You selected both A (backend first) and B (frontend first). This suggests parallel development.

### Clarification Question 3
Should we treat backend and frontend as parallel workstreams?

A) Yes — build both simultaneously, connect them at the end
B) Backend slightly ahead — get the API working first, then wire up the frontend
C) Frontend slightly ahead — polish the UI with mock data, then swap in real API
D) Other (please describe after [Answer]: tag below)

[Answer]: A, because we have subagents

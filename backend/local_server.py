"""
Local development server for ChurnShield.

Wraps the existing analyze_handler logic with a FastAPI app so the Next.js
frontend can hit `http://localhost:8000` instead of API Gateway.

Run with:
    uvicorn local_server:app --reload --port 8000
"""
import json
import os
import sys
import time
import uuid
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared import (
    INTEL_CHANDLER_EVENT,
    MICROCHIP_TEMPE_EVENT,
    ParsedEvent,
    analysis_response_to_json,
    run_analysis,
)

app = FastAPI(title="ChurnShield Local API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    event_text: str = ""


JOBS: Dict[str, dict] = {}


def _build_event(event_text: str) -> ParsedEvent:
    """Resolve the request text to a ParsedEvent.

    For the demo we recognize a few canonical strings and otherwise fall back
    to the Intel Chandler event so the demo always renders.
    """
    text = (event_text or "").lower()

    if "tendit" in text:
        return ParsedEvent(
            employer="The Tendit Group",
            location_city="Phoenix",
            location_state="AZ",
            location_zip="85050",
            direct_jobs=120,
            naics_code="5617",
            industry="services",
            event_type="LAYOFF",
            county_fips="04013",
        )

    if "republic national" in text or "republic-forward" in text:
        return ParsedEvent(
            employer="Republic National Distributing",
            location_city="Phoenix",
            location_state="AZ",
            location_zip="85034",
            direct_jobs=210,
            naics_code="4248",
            industry="distribution",
            event_type="LAYOFF",
            county_fips="04013",
        )

    if "microchip" in text:
        return MICROCHIP_TEMPE_EVENT

    return INTEL_CHANDLER_EVENT


def _run_and_serialize(event: ParsedEvent) -> dict:
    response = run_analysis(event, use_calibrated_multiplier=False)
    return json.loads(analysis_response_to_json(response))


@app.get("/")
def root():
    return {
        "service": "ChurnShield Local API",
        "endpoints": ["/analyze", "/results/{job_id}", "/zcta-boundaries"],
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    job_id = f"job-{uuid.uuid4().hex[:12]}"
    event = _build_event(req.event_text)

    try:
        result = _run_and_serialize(event)
        JOBS[job_id] = {"status": "complete", "result": result, "ts": time.time()}
    except Exception as exc:
        print(f"[analyze] error: {exc}")
        JOBS[job_id] = {"status": "error", "error": str(exc), "ts": time.time()}

    return {
        "job_id": job_id,
        "status": "processing",
        "message": "Analysis submitted",
    }


@app.get("/results/{job_id}")
def results(job_id: str):
    job = JOBS.get(job_id)

    if not job:
        if job_id == "demo-intel-chandler":
            result = _run_and_serialize(INTEL_CHANDLER_EVENT)
            return {"status": "complete", "result": result}
        raise HTTPException(status_code=404, detail=f"Unknown job_id {job_id}")

    if job["status"] == "complete":
        return {"status": "complete", "result": job["result"]}
    if job["status"] == "error":
        return {"status": "error", "error": job.get("error", "unknown error")}
    return {"status": job["status"]}


@app.get("/zcta-boundaries")
def zcta_boundaries():
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"ZCTA5CE20": "85224", "name": "Chandler"},
                "geometry": {
                    "type": "Point",
                    "coordinates": [-111.8413, 33.3062],
                },
            },
            {
                "type": "Feature",
                "properties": {"ZCTA5CE20": "85225", "name": "Chandler"},
                "geometry": {
                    "type": "Point",
                    "coordinates": [-111.8521, 33.2847],
                },
            },
        ],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("local_server:app", host="0.0.0.0", port=8000, reload=True)

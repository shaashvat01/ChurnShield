"""
Lambda handler for the Economic Blast Radius Engine.

Handles:
- POST /analyze - Submit an event for analysis
- GET /results/{job_id} - Poll for results
- GET /zcta-boundaries - Get ZCTA GeoJSON

For the hackathon demo, this returns hardcoded Intel Chandler results
to ensure reliability. In production, would use the full pipeline.
"""
import json
import os
import sys

# Add shared modules to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared import (
    run_analysis,
    analysis_response_to_json,
    INTEL_CHANDLER_EVENT,
    format_dollar,
    format_number,
)

# CORS headers
CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}


def lambda_handler(event, context):
    """
    Main Lambda handler for API Gateway.
    Routes to appropriate handler based on HTTP method and path.
    """
    http_method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    
    # Handle OPTIONS (CORS preflight)
    if http_method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}
    
    try:
        if http_method == "POST" and "/analyze" in path:
            return handle_analyze(event)
        elif http_method == "GET" and "/results/" in path:
            return handle_poll(event)
        elif http_method == "GET" and "/zcta" in path:
            return handle_zcta(event)
        else:
            return {
                "statusCode": 404,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "Not found"}),
            }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)}),
        }


def handle_analyze(event):
    """
    Handle POST /analyze
    
    For demo: immediately returns Intel Chandler analysis.
    In production: would submit to async queue and return job_id.
    """
    # Parse request body
    body = json.loads(event.get("body", "{}"))
    event_text = body.get("event_text", "")
    
    # Return job_id for polling (demo: use fixed ID)
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "job_id": "demo-intel-chandler",
            "status": "processing",
            "message": "Analysis submitted",
        }),
    }


def handle_poll(event):
    """
    Handle GET /results/{job_id}
    
    For demo: immediately returns complete Intel Chandler analysis.
    In production: would check S3 for results.
    """
    # Run analysis
    response = run_analysis(INTEL_CHANDLER_EVENT, use_calibrated_multiplier=False)
    
    # Convert to JSON
    result_json = analysis_response_to_json(response)
    result_dict = json.loads(result_json)
    
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps({
            "status": "complete",
            "result": result_dict,
        }),
    }


def handle_zcta(event):
    """
    Handle GET /zcta-boundaries
    
    Returns GeoJSON for Arizona ZCTA boundaries.
    For demo: returns minimal GeoJSON.
    In production: would load from S3.
    """
    # Minimal GeoJSON for demo
    geojson = {
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
    
    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "body": json.dumps(geojson),
    }


# For local testing
if __name__ == "__main__":
    print("Testing Lambda handler locally...")
    
    # Test analyze endpoint
    analyze_event = {
        "httpMethod": "POST",
        "path": "/analyze",
        "body": json.dumps({"event_text": "Intel announces 3000 layoffs at Chandler, AZ"}),
    }
    result = lambda_handler(analyze_event, None)
    print(f"\nPOST /analyze: {result['statusCode']}")
    print(json.loads(result["body"]))
    
    # Test poll endpoint
    poll_event = {
        "httpMethod": "GET",
        "path": "/results/demo-intel-chandler",
    }
    result = lambda_handler(poll_event, None)
    print(f"\nGET /results/demo-intel-chandler: {result['statusCode']}")
    body = json.loads(result["body"])
    print(f"Status: {body['status']}")
    if body["status"] == "complete":
        r = body["result"]
        print(f"Direct jobs: {r['direct_jobs']}")
        print(f"Multiplier: {r['multiplier']}x")
        print(f"Indirect jobs: {r['indirect_jobs']}")
        print(f"Total jobs at risk: {r['total_jobs_at_risk']}")
        print(f"Quarterly revenue loss: ${r['quarterly_revenue_loss']:,.0f}")

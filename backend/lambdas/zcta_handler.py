"""
Lambda handler for GET /zcta-boundaries
Returns AZ ZCTA boundary GeoJSON from S3.
"""
import json

from shared.data_pipeline import load_zcta_geojson

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        geojson = load_zcta_geojson()
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps(geojson),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)}),
        }

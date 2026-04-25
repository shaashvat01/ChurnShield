"""
Lambda handler for GET /results/{job_id}.
Checks S3 for the analysis result and returns it if ready.
"""
import json
import os
import boto3
from botocore.exceptions import ClientError

DATA_BUCKET = os.environ.get("DATA_BUCKET", "blast-radius-data-us-west-2")
s3_client = boto3.client("s3")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    job_id = event.get("pathParameters", {}).get("job_id", "")
    if not job_id:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "job_id is required"}),
        }

    try:
        resp = s3_client.get_object(
            Bucket=DATA_BUCKET,
            Key=f"results/{job_id}.json",
        )
        body = resp["Body"].read().decode("utf-8")
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": body,
        }
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps({"status": "processing"}),
            }
        raise

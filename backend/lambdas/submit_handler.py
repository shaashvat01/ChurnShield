"""
Lambda handler for POST /analyze (submit job).
Generates a job ID, invokes the analyze worker Lambda asynchronously,
and returns the job ID immediately. No timeout risk.
"""
import json
import uuid
import os
import boto3

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
}

WORKER_FUNCTION_NAME = os.environ["WORKER_FUNCTION_NAME"]
lambda_client = boto3.client("lambda")


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body", "{}"))
        event_text = body.get("event_text", "")

        if not event_text:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "event_text is required"}),
            }

        job_id = str(uuid.uuid4())

        lambda_client.invoke(
            FunctionName=WORKER_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps({"job_id": job_id, "event_text": event_text}),
        )

        return {
            "statusCode": 202,
            "headers": CORS_HEADERS,
            "body": json.dumps({"job_id": job_id, "status": "processing"}),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)}),
        }

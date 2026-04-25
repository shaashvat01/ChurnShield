from aws_cdk import (
    Stack,
    Duration,
    CfnOutput,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_s3 as s3,
    aws_iam as iam,
    aws_amplify as amplify,
)
from constructs import Construct
import os


class BlastRadiusApiStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        backend_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "backend")
        )

        data_bucket = s3.Bucket.from_bucket_name(
            self, "DataBucket", "economic-blast-radius-data-216989103356"
        )

        # --- Single Lambda for all API routes (simpler, faster deploy) ---
        api_fn = _lambda.Function(
            self,
            "ApiFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="lambdas.analyze_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                backend_dir,
                exclude=[".*", "__pycache__", "*.pyc", "Dockerfile*"],
            ),
            memory_size=2048,
            timeout=Duration.seconds(60),
            environment={"DATA_BUCKET": data_bucket.bucket_name},
        )
        data_bucket.grant_read(api_fn)
        data_bucket.grant_put(api_fn, "results/*")

        # --- API Gateway ---
        api = apigw.RestApi(
            self,
            "BlastRadiusApi",
            rest_api_name="Blast Radius API",
            default_cors_preflight_options=apigw.CorsOptions(
                allow_origins=apigw.Cors.ALL_ORIGINS,
                allow_methods=apigw.Cors.ALL_METHODS,
                allow_headers=["Content-Type"],
            ),
        )

        # POST /analyze
        analyze_resource = api.root.add_resource("analyze")
        analyze_resource.add_method(
            "POST", apigw.LambdaIntegration(api_fn)
        )

        # GET /results/{job_id}
        results_resource = api.root.add_resource("results")
        job_resource = results_resource.add_resource("{job_id}")
        job_resource.add_method(
            "GET", apigw.LambdaIntegration(api_fn)
        )

        # GET /zcta-boundaries
        zcta_resource = api.root.add_resource("zcta-boundaries")
        zcta_resource.add_method(
            "GET", apigw.LambdaIntegration(api_fn)
        )

        CfnOutput(self, "ApiUrl", value=api.url, description="API Gateway URL")

        # --- Amplify Frontend (GitHub PAT from Secrets Manager) ---
        amplify_role = iam.Role(
            self,
            "AmplifyServiceRole",
            assumed_by=iam.ServicePrincipal("amplify.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AdministratorAccess-Amplify"
                )
            ],
        )

        amplify_app = amplify.CfnApp(
            self,
            "ChurnShieldFrontend",
            name="ChurnShield",
            repository="https://github.com/shaashvat01/ChurnShield",
            access_token="{{resolve:secretsmanager:github-token}}",
            iam_service_role=amplify_role.role_arn,
            platform="WEB_COMPUTE",
            environment_variables=[
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_API_URL",
                    value=api.url,
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="AMPLIFY_MONOREPO_APP_ROOT",
                    value="frontend",
                ),
            ],
            build_spec="""version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - env | grep -e NEXT_PUBLIC_ >> .env.production
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
""",
            custom_rules=[
                amplify.CfnApp.CustomRuleProperty(
                    source="/<*>",
                    target="/index.html",
                    status="404-200",
                )
            ],
        )

        amplify_branch = amplify.CfnBranch(
            self,
            "MainBranch",
            app_id=amplify_app.attr_app_id,
            branch_name="main",
            enable_auto_build=True,
            framework="Next.js - SSR",
            stage="PRODUCTION",
        )

        CfnOutput(
            self,
            "AmplifyAppUrl",
            value=f"https://main.{amplify_app.attr_default_domain}",
            description="Amplify Frontend URL",
        )
        CfnOutput(
            self,
            "AmplifyAppId",
            value=amplify_app.attr_app_id,
        )

from aws_cdk import (
    Stack,
    Duration,
    CfnOutput,
    SecretValue,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_s3 as s3,
    aws_iam as iam,
    aws_amplify as amplify,
    aws_secretsmanager as sm,
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
            self, "DataBucket", "blast-radius-data-us-west-2"
        )

        # --- Worker Lambda (heavy — pandas/pyarrow, runs async) ---
        worker_fn = _lambda.DockerImageFunction(
            self,
            "AnalyzeWorker",
            code=_lambda.DockerImageCode.from_image_asset(
                directory=backend_dir,
                file="Dockerfile.analyze",
            ),
            memory_size=2048,
            timeout=Duration.seconds(300),
            environment={"DATA_BUCKET": data_bucket.bucket_name},
            architecture=_lambda.Architecture.X86_64,
        )
        data_bucket.grant_read(worker_fn)
        data_bucket.grant_put(worker_fn, "results/*")

        # --- Submit Lambda (lightweight — just invokes worker async) ---
        submit_fn = _lambda.DockerImageFunction(
            self,
            "SubmitFunction",
            code=_lambda.DockerImageCode.from_image_asset(
                directory=backend_dir,
                file="Dockerfile.submit",
            ),
            memory_size=256,
            timeout=Duration.seconds(10),
            environment={"WORKER_FUNCTION_NAME": worker_fn.function_name},
            architecture=_lambda.Architecture.X86_64,
        )
        worker_fn.grant_invoke(submit_fn)

        # --- Poll Lambda (lightweight — reads result from S3) ---
        poll_fn = _lambda.DockerImageFunction(
            self,
            "PollFunction",
            code=_lambda.DockerImageCode.from_image_asset(
                directory=backend_dir,
                file="Dockerfile.poll",
            ),
            memory_size=256,
            timeout=Duration.seconds(10),
            environment={"DATA_BUCKET": data_bucket.bucket_name},
            architecture=_lambda.Architecture.X86_64,
        )
        data_bucket.grant_read(poll_fn, "results/*")

        # --- ZCTA Boundaries Lambda ---
        zcta_fn = _lambda.DockerImageFunction(
            self,
            "ZctaFunction",
            code=_lambda.DockerImageCode.from_image_asset(
                directory=backend_dir,
                file="Dockerfile.zcta",
            ),
            memory_size=512,
            timeout=Duration.seconds(30),
            environment={"DATA_BUCKET": data_bucket.bucket_name},
            architecture=_lambda.Architecture.X86_64,
        )
        data_bucket.grant_read(zcta_fn)

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

        analyze_resource = api.root.add_resource("analyze")
        analyze_resource.add_method(
            "POST", apigw.LambdaIntegration(submit_fn)
        )

        results_resource = api.root.add_resource("results")
        job_resource = results_resource.add_resource("{job_id}")
        job_resource.add_method(
            "GET", apigw.LambdaIntegration(poll_fn)
        )

        zcta_resource = api.root.add_resource("zcta-boundaries")
        zcta_resource.add_method(
            "GET", apigw.LambdaIntegration(zcta_fn)
        )

        CfnOutput(self, "ApiUrl", value=api.url, description="API Gateway URL")

        # --- Amplify Frontend (GitHub PAT from Secrets Manager) ---
        github_secret = sm.Secret.from_secret_name_v2(
            self, "GitHubPat", "churnshield/github-pat"
        )

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
            access_token=SecretValue.secrets_manager("churnshield/github-pat").to_string(),
            iam_service_role_arn=amplify_role.role_arn,
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

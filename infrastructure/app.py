#!/usr/bin/env python3
import aws_cdk as cdk
from stacks.api_stack import BlastRadiusApiStack

app = cdk.App()

BlastRadiusApiStack(
    app,
    "BlastRadiusApiStack",
    env=cdk.Environment(account="216989103356", region="us-west-2"),
)

app.synth()

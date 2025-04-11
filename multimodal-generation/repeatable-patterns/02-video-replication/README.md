# Video replication with Amazon Nova 

## Introduction

In the dynamic landscape of contemporary cinema, executing sophisticated camera movements and visual techniques can be challenging. This notebook demonstrates comprehensive basic workflows for crafting professional cinematic sequences using Amazon Bedrock's image and video generation capabilities.

By combining Amazon Nova Canvas and Amazon Nova Reel, accessed through Amazon Bedrock, we'll walk through a step-by-step process that enables filmmakers and cinematographers to:

- Create short, visually compelling sequences
- Experiment with innovative framing and scene composition
- Maintain artistic vision by preserving essential visual elements

This workflow is particularly useful for:

- Film education and technique demonstration
- Storyboard and pre-visualization development
- Independent filmmakers exploring visual techniques
- Shot planning for complex cinematic sequences

## Setup - Permissions and Model Entitlement

### Prerequisites

- Your AWS account has been allow-listed for access to the model. See [Access Amazon Bedrock foundation models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) for more information.
- You have the AWS CLI installed.
- You have used the AWS CLI to set the "default" AWS credentials to those associated with your allow-listed account.
- You have Python installed.
- You have a way to run Jupyter Notebooks.

### One-time setup

The following steps only need to be performed once during your initial setup.

#### Add necessary AWS permissions to your user profile

Using Nova Reel requires that you have permissions allowing access to the following AWS Actions:

- "s3:PutObject"
- "bedrock:\*"

Because the code in this notebook and scripts provide some additional conveniences - like creating an S3 bucket and automatically downloading generated video files - you'll need a few additional permissions in order to use them. The required permissions are listed below. If the IAM user you plan to use already has these permissions, there is no need to take any action. Otherwise, attach the following premissions policy to that user in the AWS console. (This guide assumes you know how to apply permissions policies through the console.)

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "NovaReelUserPermissions",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:CreateBucket",
                "s3:ListBucket",
                "bedrock:*"
            ],
            "Resource": "*"
        }
    ]
}
```

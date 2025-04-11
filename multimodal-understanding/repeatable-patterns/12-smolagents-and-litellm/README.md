# How to use LiteLLM and Smolagents with Amazon Nova models

In this tutorial we are going to:

1. Configure a LiteLLM load-balancer with Amazon Nova models. 
2. Configure LiteLLM with the Hugging Face smolagents agentic framework with Cross-Region Inference with Amazon Nova.

## Before running this notebook
- Make sure you have enabled the models Amazon Micro and Pro in your AWS Console in us-east-1 and us-west-2. For more informations about the process check the following link: 
https://docs.aws.amazon.com/bedrock/latest/userguide/model-access-modify.html
- Configure your AWS credentials: https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/setup-credentials.html
- AWS IAM permissions required: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html
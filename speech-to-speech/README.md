# Amazon Nova Sonic Speech-to-Speech Model Samples 

The Amazon Nova Sonic model provides real-time, conversational interactions through bidirectional audio streaming. Amazon Nova Sonic processes and responds to real-time speech as it occurs, enabling natural, human-like conversational experiences.

The Amazon Nova Sonic model uses the `InvokeModelWithBidirectionalStream` API, which enables real-time bidirectional streaming conversations. This differs from traditional request-response patterns by maintaining an open channel for continuous audio streaming in both directions.

This repository provides sample applications, organized into subfolders:
- The `sample-codes` folder contains basic examples in Java, Node.js, and Python. If you're looking for a quick start to understand how to interact with Nova Sonic in your preferred programming language, this is the place to begin.
- The `repeatable-patterns` folder includes common integration patterns, such as Retrieval-Augmented Generation (RAG) using Amazon Bedrock Knowledge Bases or Langchain, chat history logging, and business-oriented sample apps like customer service and resume conversation scenarios.

To learn more about Amazon Nova Sonic, refer to the [User Guide](https://docs.aws.amazon.com/nova/latest/userguide/speech.html)


## Browser Compatibility Warning
> **Warning:** The WebSocket-based sample applications with UIs in this repository are optimized for Google Chrome and may not function properly in other browsers. These applications require the ability to set the audio sample rate to 16kHz for proper microphone streaming over WebSockets, which Firefox and some other browsers do not support natively.
Firefox does not allow setting the input audio sample rate required by Amazon Nova Sonic model, and would need additional code to perform audio conversion. For the best demo experience, please use Google Chrome when running these WebSocket-based UI samples.

## Reference Solutions
The following projects were developed by AWS teams and showcase examples of how to build solutions using Amazon Nova Sonic and AWS services, serve as helpful inspiration or starting points for your own implementations.

- [Intelligent conversational IVR for hotel reservation system using Amazon Nova Sonic](https://github.com/aws-samples/genai-quickstart-pocs/tree/main/genai-quickstart-pocs-python/amazon-bedrock-nova-sonic-poc)

    This Python app showcases real-time audio streaming with Amazon Nova Sonic model in a hotel reservation scenario. It enables natural conversations and uses function calling to create, modify, or cancel reservations via API.

- [Nova Sonic CDK Package: Call Center Agent Tools](https://github.com/aws-samples/sample-s2s-cdk-agent)

    A CDK-deployable Nova Sonic S2S application designed as a flexible foundation for building PoCs. The CDK package deploys the WebSocket service to Amazon ECS Fargate and hosts the frontend web application on Amazon S3 and CloudFront as a static site with Amazon Cognito authentication.


# VideoLite
A cloud-based video compression web application

## Core functionality:
Uploading, compressing, and downloading videos across formats and resolutions

## Cloud sevices integrated 
- S3 bucket: video storage
- DynamoDB: video metadata storage
- EC2 & ECS: microservices hosting with load balancing and auto-scaling
- CloudFront: edge caching
- Cognito: user management and authentication
- Route 53: DNS hosting
- Parameter Store & Secrets Manager: storing API keys and environment variables
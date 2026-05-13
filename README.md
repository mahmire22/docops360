# DocOps360

Cloud-native intelligent document operations platform for ingesting, extracting, validating, routing, and auditing business documents.

DocOps360 is designed as a production-style portfolio product, not a one-off extraction script. It demonstrates event-driven AWS architecture, AI document processing, platform reliability, observability, infrastructure as code, and operational workflows.

## Product Goal

Users upload invoices, warranty claims, service reports, or dealer documents. The platform extracts key fields with AI, validates the result, routes failures for review, stores structured records, and exposes status through APIs and a dashboard.

## Initial Build Scope

- React operations dashboard
- TypeScript API contracts and handlers
- Mock document-processing workflow for local development
- Terraform foundation for AWS
- AWS profile: `docops360-dev`
- AWS region: `us-east-1`
- First target document type: invoices

## Planned AWS Architecture

- S3 for document storage
- API Gateway for upload and status APIs
- Lambda for processing steps
- S3 object-created events for asynchronous invoice processing
- SQS for async job decoupling
- Step Functions for orchestration and retry paths
- Textract for document extraction
- DynamoDB for job status and audit events
- RDS PostgreSQL for structured business records
- Cognito for authentication
- CloudWatch and X-Ray for logs, metrics, alarms, and traces
- KMS, IAM, and Secrets Manager for production-style security
- Terraform for reproducible infrastructure

## Repository Layout

```text
apps/
  web/              Operations dashboard
  api/              API and Lambda-oriented handlers
packages/
  shared/           Shared TypeScript schemas and domain types
infra/
  terraform/        AWS infrastructure
docs/
  architecture.md   Architecture narrative
  api-contract.md   API request and response shapes
  environment.md    Local environment and AWS profile notes
  next-steps.md     Build guide
```

## Local Development

This repository is intentionally scaffolded without downloaded dependencies. Once Node dependencies are installed, the intended commands are:

```bash
npm install
npm run dev
```

AWS commands should use the local profile rather than pasted secrets:

```bash
aws sts get-caller-identity --profile docops360-dev
```

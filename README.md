# DocOps360

DocOps360 is a Personal Operations Intelligence Assistant for organizing documents and future signals into calm, actionable context.

It helps users stay on top of personal/admin decisions by collecting evidence, tracking priorities, and preparing future summaries and actions from one workspace. Documents are the first source; email, calendar, messages, and bills can become additional signal sources later.

## Product Goal

Users upload bills, letters, forms, invoices, and admin documents. DocOps360 stores them as evidence, derives normalized signals, highlights what needs attention, and keeps the foundation ready for future AI-assisted summaries, risks, priorities, and recommended actions.

The product is not intended to be only a document processor or chatbot. The core direction is a personal operations layer for:

- Signals
- Documents
- Decisions
- Priorities
- Actions
- Evidence
- Assistant workflows

## Current Build Scope

- React/Vite personal operations portal
- TypeScript API contracts and shared domain models
- Normalized `SignalRecord` model
- Operational Intelligence Layer models for goals, evidence, recommendations, review-aware actions, decisions, and impact
- Document upload and Document Library experience
- Mock mode for local development
- Real mode against AWS upload/read APIs
- Terraform-managed AWS foundation
- AWS profile: `docops360-dev`
- AWS region: `us-east-1`
- First active document module: invoice-style uploads

## AWS Foundation

- S3 for document evidence storage
- API Gateway for upload and read APIs
- Lambda for API handlers and lightweight processing
- S3 object-created events for asynchronous document processing
- DynamoDB for job lifecycle state and audit-friendly metadata
- CloudWatch for logs and operational visibility
- IAM least-privilege roles
- Terraform for reproducible infrastructure

Future infrastructure may add SQS, Step Functions, Cognito, KMS refinements, and AI enrichment services when the product need is clear.

## AI And Extraction Strategy

The MVP extraction strategy is `metadata_only`. Uploaded documents are stored as evidence, and the worker records source, object metadata, lifecycle state, and a basic summary without paid AI calls.

Future `bedrock_claude` can enrich signals with summaries, risks, priorities, due-date reasoning, recommended actions, and evidence citations. Bedrock/Claude is disabled for now.

Future MCP tools can expose narrow internal capabilities such as archive search, document metadata lookup, goal listing, project context, and recent document summaries. No MCP server is enabled in the MVP.

## Technical Demo Story

DocOps360 currently demonstrates:

- React/Vite frontend
- Typed shared models
- API Gateway HTTP API
- Lambda upload/read handlers
- S3 presigned upload URLs
- S3 event worker
- DynamoDB lifecycle state
- Job read APIs
- Terraform IaC
- Deterministic Operational Intelligence Layer foundations
- A future path for Bedrock/Claude and connector-based signal enrichment

## Repository Layout

```text
apps/
  web/              Personal operations portal
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
  operational-intelligence-layer.md
                    Recommendation and review foundation
  personal-signal-model.md
                    Personal operations signal model
```

## Local Development

Once Node dependencies are installed, run:

```bash
npm install
npm run dev
```

AWS commands should use the local profile rather than pasted secrets:

```bash
aws sts get-caller-identity --profile docops360-dev
```

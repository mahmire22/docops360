# Next Steps

## Step 1: Confirm Local Tooling

Check these commands locally:

```bash
node --version
npm --version
terraform version
aws sts get-caller-identity --profile docops360-dev
```

## Step 2: Install Dependencies

After the first scaffold is committed:

```bash
npm install
```

## Step 3: Run The Dashboard

```bash
npm run dev
```

## Step 4: Configure Terraform Backend

Start with local Terraform state during development. Move to a remote S3 backend after the first AWS foundation deploy is stable.

## Step 5: Build Incrementally

1. Local mock upload and job tracking
2. S3 bucket and DynamoDB job table
3. Lambda API handlers
4. S3 event-driven processing worker
5. Operational Intelligence Layer for goals, evidence, recommendations, review-aware actions, and impact
6. SQS job queue
7. Step Functions workflow
8. Optional structured extraction for documents that need OCR, forms, tables, or confidence scores
9. AI enrichment for summaries, priorities, risks, and recommended actions
10. Assistant experience for asking questions and reviewing decisions
11. CloudWatch alarms and interview-ready docs

## Current Implementation Status

- Local portal uses shared API contracts.
- Upload action creates a mock job and S3-style object key.
- API package has handler-level functions for job listing and upload creation.
- Dev Terraform has been applied through the upload API, job read API, and S3 event worker foundation.
- The frontend derives personal signals and a Document Library from the existing job read APIs.
- The frontend now creates deterministic recommendation, action, goal, and impact records from existing signals.
- Phase 5D keeps the MVP simple: Archive, Goals, Sources, Projects, Assistant, and System Console. Approval/action-review workflows are future-only.
- See [AI Integration Readiness](./ai-integration-readiness.md) before enabling Bedrock/Claude, OpenAI, or any paid AI provider.

# DocOps360 Architecture

DocOps360 is a Personal Operations Intelligence Assistant. The architecture starts with document upload because documents are reliable evidence for personal/admin decisions, then grows toward a broader signal layer for priorities, actions, and assistant workflows.

## Core Flow

1. A user uploads a document through the portal or API.
2. The API stores the raw document in S3 and creates a job record in DynamoDB.
3. An S3 object-created event triggers the lightweight processing worker for the current upload prefix.
4. The worker reads object metadata, updates lifecycle state, and writes structured logs.
5. The frontend reads job records and derives normalized personal signals.
6. The Document Library keeps uploaded files available as evidence for future summaries, priorities, and actions.

## Product Model

The main product unit is the signal, not the infrastructure job. A signal can come from a document today and from email, calendar, messages, bills, or manual input later.

Each signal should preserve:

- Source
- Document type
- Related goal
- Related project
- Category
- Priority
- Review need
- Action type
- Evidence quality
- Status
- Summary
- Recommended action
- Evidence references
- Technical metadata for debugging and demos

## Operational Intelligence Layer

The Operational Intelligence Layer sits above raw job state and derived signals. It turns signals into evidence-backed recommendations and review-aware action suggestions.

The product loop is:

```text
Input -> Understand -> Link to context -> Recommend -> Review -> Remember
```

In Phase 4A this layer is deterministic and local to the frontend. It creates:

- user goal placeholders
- evidence references
- recommendation records
- action proposals
- operational impact metrics

Bedrock/Claude can later enhance this layer by replacing or enriching the deterministic recommendation mapper, while the product keeps the same auditable recommendation and evidence shapes.

The MVP intelligence filter is intentionally simple:

```text
Input/document -> Archive/evidence -> metadata -> compare with active goals -> check project context -> check review need -> recommend or file quietly
```

Archived goals are ignored for active recommendations unless explicitly searched or linked later.

## Reliability Story

- S3 object-created events trigger asynchronous processing after upload.
- The processing worker updates lifecycle state independently from the upload API.
- DynamoDB stores job status and audit-friendly metadata.
- `GET /jobs` and `GET /jobs/{jobId}` expose current state to the frontend.
- `DELETE /jobs/{jobId}` is prepared to delete only the S3 object linked to the DynamoDB job record, then remove that archive record.
- CloudWatch logs expose operational health.
- SQS and Step Functions can be introduced later when the workflow needs buffering, replay controls, retries, and richer failure paths.

## Current Worker

The current worker is intentionally lightweight and low cost:

- triggered by S3 uploads under the current document upload prefix
- reads object metadata with S3 `HeadObject`
- parses `jobId` from the object key
- updates DynamoDB through `uploaded`, `queued`, `processing`, `completed`, or `failed`
- exposes read APIs through `GET /jobs` and `GET /jobs/{jobId}`
- writes structured JSON logs to CloudWatch
- keeps AI extraction disabled

## ExtractionStrategy

DocOps360 MVP does not use Textract. The active extraction strategy is `metadata_only`.

`metadata_only` means the worker reads S3 object metadata, stores source, bucket, object key, size, content type, uploaded/processed timestamps, and writes the basic summary:

```text
Document stored successfully. AI extraction is disabled.
```

Future `bedrock_claude` can summarize documents, extract useful metadata where possible, generate recommended actions, identify review needs, create evidence citations, and fail safely back to `metadata_only`. Bedrock remains disabled and manual-trigger-only for now.

## Technical Demo Story

The current implementation demonstrates:

- React/Vite frontend
- Typed shared models
- API Gateway HTTP API
- Lambda upload/read/delete handlers prepared for the Node.js 22 runtime
- S3 presigned uploads
- S3 event worker
- DynamoDB lifecycle state
- Job read APIs
- Safe archive delete API prepared behind Terraform
- Terraform IaC
- Future AI enrichment path through Bedrock/Claude and connector-derived signals

## Future MCP Readiness

DocOps360 is not running an MCP server in the MVP. The internal product boundaries are being kept MCP-ready so future assistant tools can expose narrow, auditable operations such as:

- `search_archive`
- `get_document_metadata`
- `list_goals`
- `get_project_context`
- `summarize_recent_documents`

These tools should read DocOps360 evidence and context first, then optionally call Bedrock/Claude behind feature flags when paid AI review is explicitly enabled.

## Security Story

- S3 buckets use encryption.
- IAM permissions are scoped by workload.
- Archive deletion is by `jobId` only; the frontend never supplies arbitrary bucket or object keys.
- Destructive actions require confirmation in the UI.
- Secrets are not stored in the repository.
- Future phases can add KMS refinements, Cognito authentication, and Secrets Manager for managed service credentials.

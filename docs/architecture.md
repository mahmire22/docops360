# DocOps360 Architecture

DocOps360 is an event-driven document operations platform. The product is designed to show how a document moves from upload to validated business record with clear ownership, retries, auditability, and observability.

## Core Flow

1. A user uploads a document through the dashboard or API.
2. The API stores the raw document in S3 and creates a job record in DynamoDB.
3. An S3 object-created event triggers the processing worker for `uploads/invoice/`.
4. The worker reads object metadata, updates job lifecycle state, and writes structured logs.
5. Later phases add SQS buffering, Step Functions orchestration, Textract extraction, validation, and review routing.
6. Validated records are persisted for reporting and downstream APIs.

## First Use Case

The first implementation targets invoices because the extraction story is easy to understand:

- Supplier name
- Invoice number
- Invoice date
- Due date
- Currency
- Net amount
- Tax amount
- Gross amount
- Line items
- Confidence score

## Reliability Story

- S3 object-created events trigger asynchronous invoice processing after upload.
- The processing worker updates the job lifecycle independently from the upload API.
- SQS will be introduced later when the workflow needs buffering and replay controls.
- Step Functions owns orchestration, retries, and failure paths.
- DynamoDB stores job status and audit events.
- CloudWatch metrics and alarms expose operational health.
- X-Ray traces make processing bottlenecks easier to inspect.

## Phase 2 Worker

The current worker is intentionally lightweight and low cost:

- triggered by S3 uploads under `uploads/invoice/`
- reads object metadata with S3 `HeadObject`
- parses `jobId` from the object key
- updates DynamoDB through `uploaded`, `queued`, `processing`, `completed`, or `failed`
- writes structured JSON logs to CloudWatch
- keeps `ENABLE_TEXTRACT=false`

Textract is prepared as a service boundary for Phase 3, but no Textract API calls are made yet.

## Security Story

- S3 buckets use encryption.
- IAM permissions are scoped by workload.
- KMS protects stored documents and sensitive records.
- Secrets Manager stores database credentials.
- Cognito is planned for dashboard/API authentication.

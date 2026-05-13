# DocOps360 Architecture

DocOps360 is an event-driven document operations platform. The product is designed to show how a document moves from upload to validated business record with clear ownership, retries, auditability, and observability.

## Core Flow

1. A user uploads a document through the dashboard or API.
2. The API stores the raw document in S3 and creates a job record in DynamoDB.
3. An event places the job onto SQS.
4. Step Functions coordinates extraction, validation, enrichment, persistence, and failure routing.
5. Textract extracts tables, forms, and text.
6. Business rules validate required fields, confidence scores, totals, dates, and duplicate records.
7. Validated records are persisted for reporting and downstream APIs.
8. Failed or low-confidence jobs are routed for review with reason codes and audit history.

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

- SQS decouples ingestion from processing.
- Step Functions owns orchestration, retries, and failure paths.
- DynamoDB stores job status and audit events.
- CloudWatch metrics and alarms expose operational health.
- X-Ray traces make processing bottlenecks easier to inspect.

## Security Story

- S3 buckets use encryption.
- IAM permissions are scoped by workload.
- KMS protects stored documents and sensitive records.
- Secrets Manager stores database credentials.
- Cognito is planned for dashboard/API authentication.

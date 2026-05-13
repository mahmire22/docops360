# DocOps360 API Contract

This contract describes the first product slice: authenticated document intake and job tracking.

The current implementation uses a local mock client with the same shapes that the AWS API will return later. That lets the dashboard and shared types mature before the cloud resources are applied.

Development AWS region: `us-east-1`.

Development API base URL:

```text
https://v9lqv2g88e.execute-api.us-east-1.amazonaws.com
```

## Create Upload

Creates a document job and returns an upload target.

Future AWS implementation:

- API Gateway receives the request.
- Lambda validates metadata.
- DynamoDB stores the job record.
- S3 presigned upload details are returned to the browser.
- EventBridge or S3 events trigger the processing workflow.

### Request

```json
{
  "documentType": "invoice",
  "fileName": "supplier-invoice.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 248192
}
```

### Response

```json
{
  "data": {
    "job": {
      "id": "job_...",
      "documentType": "invoice",
      "fileName": "supplier-invoice.pdf",
      "status": "uploaded",
      "confidence": null,
      "createdAt": "2026-05-13T08:20:00.000Z",
      "updatedAt": "2026-05-13T08:20:00.000Z"
    },
    "uploadTarget": {
      "method": "presigned_put",
      "bucketName": "docops360-dev-invoice-ingest-...",
      "objectKey": "uploads/invoice/job_.../supplier-invoice.pdf",
      "uploadUrl": "https://...",
      "expiresAt": "2026-05-13T08:30:00.000Z"
    }
  },
  "requestId": "..."
}
```

## List Jobs

Returns jobs for the operations queue.

Current AWS implementation:

- API Gateway invokes Lambda.
- Lambda scans DynamoDB with a small dev limit.
- Results are sorted by `updatedAt`.

### Request

```text
GET /jobs
```

### Response

```json
{
  "data": {
    "jobs": [
      {
        "id": "job_...",
        "documentType": "invoice",
        "fileName": "supplier-invoice.pdf",
        "status": "completed",
        "confidence": null,
        "createdAt": "2026-05-13T08:20:00.000Z",
        "updatedAt": "2026-05-13T08:21:00.000Z",
        "bucket": "docops360-dev-invoice-ingest-...",
        "objectKey": "uploads/invoice/job_.../supplier-invoice.pdf",
        "uploadedAt": "2026-05-13T08:20:00.000Z",
        "processedAt": "2026-05-13T08:21:00.000Z",
        "processingMetadata": {
          "textractEnabled": false,
          "textractSkipped": true
        }
      }
    ]
  },
  "requestId": "..."
}
```

## Get Job

Returns job detail, extraction fields, validation findings, workflow steps, and audit events.

Current AWS implementation:

- API Gateway invokes Lambda.
- Lambda uses DynamoDB `GetItem` by `jobId`.
- The dashboard polls this endpoint until `completed`, `failed`, or `review_required`.

### Request

```text
GET /jobs/{jobId}
```

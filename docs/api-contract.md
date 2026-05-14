# DocOps360 API Contract

This contract describes the first product slice: document intake, job tracking, and the source data used to derive personal operations signals.

The frontend supports both real AWS mode and local mock mode with the same response shapes. That lets the portal, Document Library, and shared signal types mature without changing the API contract.

Development AWS region: `us-east-1`.

Development API base URL:

```text
https://v9lqv2g88e.execute-api.us-east-1.amazonaws.com
```

## Create Upload

Creates a document job and returns a presigned upload target.

Current AWS implementation:

- API Gateway receives the request.
- Lambda validates metadata.
- DynamoDB stores the job record.
- S3 presigned upload details are returned to the browser.
- S3 events trigger the lightweight processing worker after upload.

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

Returns jobs used by the portal to derive signals and populate the Document Library.

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
          "source": "device_upload",
          "extractionStrategy": "metadata_only",
          "extractionProvider": "metadata_only",
          "extractedTextAvailable": false,
          "intelligenceReadiness": "metadata_only",
          "summary": "Document stored successfully. AI extraction is disabled."
        }
      }
    ]
  },
  "requestId": "..."
}
```

## Get Job

Returns one job record for upload polling, signal derivation, and developer details.

Current AWS implementation:

- API Gateway invokes Lambda.
- Lambda uses DynamoDB `GetItem` by `jobId`.
- The portal polls this endpoint until `completed`, `failed`, or `review_required`.

### Request

```text
GET /jobs/{jobId}
```

## Delete Job

Prepared for Phase 5B/5C. This route is implemented in code and Terraform, but it is not live until Terraform is applied.

The frontend must not send arbitrary S3 bucket or object keys. The backend resolves the job from DynamoDB first, then deletes only the stored `bucket` and `objectKey` for that `jobId`.

Current planned AWS implementation:

- API Gateway invokes the jobs Lambda.
- Lambda reads the DynamoDB job record by `jobId`.
- Lambda validates that the stored object key is under `uploads/invoice/`.
- Lambda deletes the matching S3 object.
- Lambda deletes the DynamoDB job item.
- CloudWatch receives structured delete logs.

### Request

```text
DELETE /jobs/{jobId}
```

### Response

```json
{
  "data": {
    "jobId": "job_...",
    "deletedBucket": "docops360-dev-invoice-ingest-...",
    "deletedObjectKey": "uploads/invoice/job_.../supplier-invoice.pdf"
  },
  "requestId": "..."
}
```

# DocOps360 Terraform

The first Terraform slice creates the foundation for document intake:

- encrypted S3 invoice ingest bucket
- public access blocking
- bucket versioning
- browser upload CORS for presigned PUT requests
- DynamoDB jobs table
- status GSI for operations queue filtering
- Lambda upload handler
- S3 event notification for uploaded invoices
- worker Lambda for asynchronous processing metadata updates
- API Gateway HTTP API
- CloudWatch log groups with 14-day retention

## Development Commands

Run from `infra/terraform/environments/dev`:

```bash
cd infra/terraform/environments/dev
terraform init
terraform validate
terraform plan
```

Terraform is configured to use the local AWS profile:

```text
docops360-dev
```

The development region is:

```text
us-east-1
```

Do not commit `terraform.tfvars`, state files, or AWS credentials.

Phase 2 keeps `ENABLE_TEXTRACT=false`. The worker only reads S3 object metadata and updates DynamoDB lifecycle fields.

# Environment Configuration

DocOps360 uses local AWS CLI profiles. Do not paste, store, print, or commit AWS access keys.

## Development Profile

```text
AWS_PROFILE=docops360-dev
AWS_REGION=us-east-1
DOCOPS360_ENV=dev
```

Verify the profile locally:

```bash
aws sts get-caller-identity --profile docops360-dev
```

## Terraform

Terraform reads the profile and region from variables with safe defaults:

- profile: `docops360-dev`
- region: `us-east-1`
- environment: `dev`

Do not commit:

- `.env`
- `terraform.tfvars`
- Terraform state files
- AWS credentials

## Current Cloud Scope

The next infrastructure slice is scaffold-only until reviewed:

- S3 invoice ingest bucket
- DynamoDB jobs table
- Lambda upload handler
- API Gateway HTTP API
- CloudWatch log groups
- least-privilege IAM role and policy for upload handling

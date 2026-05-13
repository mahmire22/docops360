# DocOps360 Terraform

The first Terraform slice creates the foundation for document intake:

- encrypted S3 document bucket
- public access blocking
- bucket versioning
- DynamoDB jobs table
- status GSI for operations queue filtering

## Development Commands

Run from `infra/terraform/environments/dev`:

```bash
terraform init
terraform plan
```

Terraform is configured to use the local AWS profile:

```text
docops360-dev
```

Do not commit `terraform.tfvars`, state files, or AWS credentials.

# DocOps360 Terraform State Backend Bootstrap

This root is intentionally separate from the application infrastructure. It uses local state first and creates only the dedicated remote state bucket for future Terraform state migration.

It does not use the document ingest bucket and it does not create a DynamoDB lock table. The dev backend will use S3 native state locking with `use_lockfile = true` after migration.

## Planned Resources

- S3 bucket: `docops360-tfstate-009160052610-us-east-1`
- Versioning enabled
- Default SSE-S3 encryption enabled
- Public access fully blocked
- Bucket owner enforced
- HTTPS-only bucket policy
- `prevent_destroy` guard on the bucket
- Tags: `Project=DocOps360`, `Environment=shared`, `ManagedBy=Terraform`, `Purpose=terraform-state`

## Review Only

```bash
cd infra/terraform/bootstrap/state-backend
terraform init -backend=false
terraform fmt -recursive -check
terraform validate
terraform plan -no-color
```

Do not apply this bootstrap unless explicitly approved.

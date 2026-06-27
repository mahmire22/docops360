# Terraform Remote State Migration Runbook

DocOps360 currently uses local Terraform state on the iMac at:

```text
infra/terraform/environments/dev/terraform.tfstate
```

That local state remains the source of truth until the migration is explicitly completed. Do not delete, rewrite, move, or commit local `terraform.tfstate` files. Keep the existing private backup zip outside Git, and create a fresh private backup immediately before migration.

The remote state target is a dedicated S3 bucket, separate from the document ingest bucket:

```text
docops360-tfstate-009160052610-us-east-1
```

The dev state key will be:

```text
docops360/dev/terraform.tfstate
```

The backend uses S3 native state locking with `use_lockfile = true`. Do not add DynamoDB locking for this MVP backend.

## Safety Rules

- Do not run `terraform apply` without explicit approval.
- Do not run `terraform init -migrate-state` until the bootstrap bucket exists.
- Do not use the document ingest bucket for Terraform state.
- Do not commit Terraform state, backend credentials, secrets, or backup zips.
- Do not run Terraform applies from two machines at the same time.
- Keep the private local backup zip until remote migration is verified from both Macs.

## Stage A - Review Bootstrap Only

```bash
cd /Users/munshiahmed/Documents/docops360/infra/terraform/bootstrap/state-backend
terraform init -backend=false
terraform fmt -recursive -check
terraform validate
terraform plan -no-color
```

Expected result: a plan that creates only the dedicated Terraform state backend S3 bucket and its safety controls.

## Stage B - Apply Bootstrap Only After Explicit Approval

```bash
cd /Users/munshiahmed/Documents/docops360/infra/terraform/bootstrap/state-backend
terraform apply
```

This creates only the remote state bucket infrastructure. It does not migrate the existing dev state.

## Stage C - Migrate Existing Dev Local State After Bootstrap Exists

Before running migration, create a fresh private backup of:

```text
infra/terraform/environments/dev/terraform.tfstate
infra/terraform/environments/dev/terraform.tfstate.backup
```

Then run:

```bash
cd /Users/munshiahmed/Documents/docops360/infra/terraform/environments/dev
terraform init -migrate-state
# Confirm the migration prompt manually.
terraform plan -no-color
```

Expected result after migration: no infrastructure changes.

## Stage D - Verify From Second Mac

```bash
git clone https://github.com/mahmire22/docops360.git
cd docops360/infra/terraform/environments/dev
terraform init
terraform plan -no-color
```

Expected result: no infrastructure changes. After this verification, both Macs can safely use the same remote state, but Terraform applies should still be coordinated so only one machine applies at a time.

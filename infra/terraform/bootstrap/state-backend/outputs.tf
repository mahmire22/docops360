output "terraform_state_bucket_name" {
  description = "Dedicated S3 bucket for DocOps360 Terraform state."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "dev_state_key" {
  description = "S3 key reserved for the dev Terraform root state after migration."
  value       = "docops360/dev/terraform.tfstate"
}

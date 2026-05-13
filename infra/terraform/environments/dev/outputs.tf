output "document_bucket_name" {
  description = "S3 bucket used for uploaded documents."
  value       = module.storage.document_bucket_name
}

output "jobs_table_name" {
  description = "DynamoDB table used for document job status."
  value       = module.storage.jobs_table_name
}

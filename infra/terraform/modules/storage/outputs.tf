output "document_bucket_name" {
  description = "S3 bucket used for uploaded documents."
  value       = aws_s3_bucket.documents.bucket
}

output "jobs_table_name" {
  description = "DynamoDB table used for document job status."
  value       = aws_dynamodb_table.jobs.name
}

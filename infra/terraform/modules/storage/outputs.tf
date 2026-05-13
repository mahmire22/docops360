output "document_bucket_name" {
  description = "S3 bucket used for uploaded invoice documents."
  value       = aws_s3_bucket.documents.bucket
}

output "document_bucket_arn" {
  description = "ARN of the S3 bucket used for uploaded invoice documents."
  value       = aws_s3_bucket.documents.arn
}

output "jobs_table_name" {
  description = "DynamoDB table used for document job status."
  value       = aws_dynamodb_table.jobs.name
}

output "jobs_table_arn" {
  description = "ARN of the DynamoDB table used for document job status."
  value       = aws_dynamodb_table.jobs.arn
}

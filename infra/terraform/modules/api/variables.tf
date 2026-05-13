variable "document_bucket_arn" {
  description = "ARN of the S3 ingest bucket."
  type        = string
}

variable "document_bucket_name" {
  description = "Name of the S3 ingest bucket."
  type        = string
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
}

variable "jobs_table_arn" {
  description = "ARN of the DynamoDB jobs table."
  type        = string
}

variable "jobs_table_name" {
  description = "Name of the DynamoDB jobs table."
  type        = string
}

variable "name_prefix" {
  description = "Prefix used for DocOps360 AWS resources."
  type        = string
}

variable "upload_url_expires_seconds" {
  description = "How long presigned upload URLs remain valid."
  type        = number
}

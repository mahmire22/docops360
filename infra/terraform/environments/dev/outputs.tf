output "document_bucket_name" {
  description = "S3 bucket used for uploaded invoice documents."
  value       = module.storage.document_bucket_name
}

output "jobs_table_name" {
  description = "DynamoDB table used for document job status."
  value       = module.storage.jobs_table_name
}

output "http_api_endpoint" {
  description = "Base URL for the DocOps360 HTTP API."
  value       = module.api.http_api_endpoint
}

output "upload_route" {
  description = "Route used to create invoice upload URLs."
  value       = "POST ${module.api.http_api_endpoint}/uploads"
}

output "processing_worker_name" {
  description = "Name of the invoice processing worker Lambda."
  value       = module.api.processing_worker_name
}

output "jobs_read_routes" {
  description = "Routes used to read document jobs."
  value = [
    "GET ${module.api.http_api_endpoint}/jobs",
    "GET ${module.api.http_api_endpoint}/jobs/{jobId}"
  ]
}

output "jobs_delete_route" {
  description = "Route prepared for deleting a document job and its associated S3 object."
  value       = "DELETE ${module.api.http_api_endpoint}/jobs/{jobId}"
}

output "goals_table_name" {
  description = "DynamoDB table used for persisted goals."
  value       = module.storage.goals_table_name
}

output "goals_routes" {
  description = "Routes used to manage persisted goals."
  value = [
    "GET ${module.api.http_api_endpoint}/goals",
    "POST ${module.api.http_api_endpoint}/goals",
    "PATCH ${module.api.http_api_endpoint}/goals/{goalId}",
    "DELETE ${module.api.http_api_endpoint}/goals/{goalId}"
  ]
}

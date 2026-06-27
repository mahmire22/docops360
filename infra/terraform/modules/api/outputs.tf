output "http_api_endpoint" {
  description = "Base URL for the DocOps360 HTTP API."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "upload_lambda_name" {
  description = "Name of the upload Lambda function."
  value       = aws_lambda_function.upload_handler.function_name
}

output "processing_worker_arn" {
  description = "ARN of the invoice processing worker Lambda function."
  value       = aws_lambda_function.processing_worker.arn
}

output "processing_worker_name" {
  description = "Name of the invoice processing worker Lambda function."
  value       = aws_lambda_function.processing_worker.function_name
}

output "jobs_lambda_name" {
  description = "Name of the jobs read Lambda function."
  value       = aws_lambda_function.jobs_handler.function_name
}

output "goals_lambda_name" {
  description = "Name of the goals persistence Lambda function."
  value       = aws_lambda_function.goals_handler.function_name
}

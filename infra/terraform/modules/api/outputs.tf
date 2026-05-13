output "http_api_endpoint" {
  description = "Base URL for the DocOps360 HTTP API."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "upload_lambda_name" {
  description = "Name of the upload Lambda function."
  value       = aws_lambda_function.upload_handler.function_name
}

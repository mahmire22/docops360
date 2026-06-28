output "app_client_id" {
  description = "Cognito browser SPA app client ID."
  value       = aws_cognito_user_pool_client.browser_spa.id
}

output "hosted_ui_base_url" {
  description = "Base URL for Cognito managed login."
  value       = "https://${aws_cognito_user_pool_domain.managed_login.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "issuer_url" {
  description = "Cognito JWT issuer URL."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.owner.id}"
}

output "user_pool_id" {
  description = "Cognito User Pool ID."
  value       = aws_cognito_user_pool.owner.id
}

output "user_pool_domain" {
  description = "Cognito managed login domain prefix."
  value       = aws_cognito_user_pool_domain.managed_login.domain
}

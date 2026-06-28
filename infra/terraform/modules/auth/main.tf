data "aws_caller_identity" "current" {}

resource "aws_cognito_user_pool" "owner" {
  name                = "${var.name_prefix}-${var.environment}-owner"
  deletion_protection = "ACTIVE"
  username_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }
}

resource "aws_cognito_user_pool_client" "browser_spa" {
  name         = "${var.name_prefix}-${var.environment}-browser-spa"
  user_pool_id = aws_cognito_user_pool.owner.id

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 7

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  prevent_user_existence_errors        = "ENABLED"
  supported_identity_providers         = ["COGNITO"]

  generate_secret = false

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "managed_login" {
  domain       = "${var.name_prefix}-${var.environment}-auth-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.owner.id
}

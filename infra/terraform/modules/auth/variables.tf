variable "callback_urls" {
  description = "Allowed OAuth callback URLs for the browser SPA."
  type        = list(string)
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
}

variable "logout_urls" {
  description = "Allowed OAuth logout URLs for the browser SPA."
  type        = list(string)
}

variable "name_prefix" {
  description = "Prefix used for DocOps360 AWS resources."
  type        = string
}

variable "aws_region" {
  description = "AWS region for Cognito."
  type        = string
}

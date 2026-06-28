variable "aws_region" {
  description = "AWS region for the development environment."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile used by Terraform."
  type        = string
  default     = "docops360-dev"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "name_prefix" {
  description = "Prefix used for DocOps360 AWS resources."
  type        = string
  default     = "docops360"
}

variable "upload_url_expires_seconds" {
  description = "How long presigned upload URLs remain valid."
  type        = number
  default     = 600
}


variable "cognito_callback_urls" {
  description = "Allowed Cognito callback URLs for local/browser development."
  type        = list(string)
  default = [
    "http://127.0.0.1:5173/",
    "http://localhost:5173/"
  ]
}

variable "cognito_logout_urls" {
  description = "Allowed Cognito logout URLs for local/browser development."
  type        = list(string)
  default = [
    "http://127.0.0.1:5173/",
    "http://localhost:5173/"
  ]
}

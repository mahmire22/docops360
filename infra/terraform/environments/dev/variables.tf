variable "aws_region" {
  description = "AWS region for the development environment."
  type        = string
  default     = "eu-west-2"
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

variable "aws_region" {
  description = "AWS region for the Terraform state backend bucket."
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Local AWS CLI profile used for the bootstrap apply."
  type        = string
  default     = "docops360-dev"
}

variable "aws_account_id" {
  description = "AWS account ID used to make the state bucket name deterministic and unique."
  type        = string
  default     = "009160052610"
}

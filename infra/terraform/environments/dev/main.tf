terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "DocOps360"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

module "storage" {
  source = "../../modules/storage"

  environment = var.environment
  name_prefix = var.name_prefix
}

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
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

module "api" {
  source = "../../modules/api"

  document_bucket_arn        = module.storage.document_bucket_arn
  document_bucket_name       = module.storage.document_bucket_name
  environment                = var.environment
  jobs_table_arn             = module.storage.jobs_table_arn
  jobs_table_name            = module.storage.jobs_table_name
  name_prefix                = var.name_prefix
  upload_url_expires_seconds = var.upload_url_expires_seconds
}

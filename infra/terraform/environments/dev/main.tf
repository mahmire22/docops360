terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket       = "docops360-tfstate-009160052610-us-east-1"
    key          = "docops360/dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

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

resource "aws_lambda_permission" "allow_invoice_ingest_bucket" {
  statement_id  = "AllowExecutionFromInvoiceIngestBucket"
  action        = "lambda:InvokeFunction"
  function_name = module.api.processing_worker_name
  principal     = "s3.amazonaws.com"
  source_arn    = module.storage.document_bucket_arn
}

resource "aws_s3_bucket_notification" "invoice_processing" {
  bucket = module.storage.document_bucket_name

  lambda_function {
    lambda_function_arn = module.api.processing_worker_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/invoice/"
  }

  depends_on = [aws_lambda_permission.allow_invoice_ingest_bucket]
}

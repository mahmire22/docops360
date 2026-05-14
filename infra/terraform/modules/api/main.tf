locals {
  upload_function_name = "${var.name_prefix}-${var.environment}-create-upload"
  worker_function_name = "${var.name_prefix}-${var.environment}-process-invoice"
  jobs_function_name   = "${var.name_prefix}-${var.environment}-read-jobs"
}

data "archive_file" "upload_handler" {
  type        = "zip"
  source_dir  = "${path.root}/../../../../apps/api/dist"
  output_path = "${path.root}/.terraform/build/upload-handler.zip"
}

resource "aws_cloudwatch_log_group" "upload_handler" {
  name              = "/aws/lambda/${local.upload_function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "processing_worker" {
  name              = "/aws/lambda/${local.worker_function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "jobs_handler" {
  name              = "/aws/lambda/${local.jobs_function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "http_api" {
  name              = "/aws/apigateway/${var.name_prefix}-${var.environment}-http-api"
  retention_in_days = 14
}

data "aws_iam_policy_document" "upload_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "upload_handler" {
  name               = "${local.upload_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.upload_assume_role.json
}

resource "aws_iam_role" "processing_worker" {
  name               = "${local.worker_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.upload_assume_role.json
}

resource "aws_iam_role" "jobs_handler" {
  name               = "${local.jobs_function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.upload_assume_role.json
}

data "aws_iam_policy_document" "upload_handler" {
  statement {
    sid = "WriteOwnLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.upload_handler.arn}:*"]
  }

  statement {
    sid = "CreateInvoiceUploadObjects"
    actions = [
      "s3:PutObject",
      "s3:PutObjectTagging"
    ]
    resources = ["${var.document_bucket_arn}/uploads/invoice/*"]
  }

  statement {
    sid       = "CreateJobRecord"
    actions   = ["dynamodb:PutItem"]
    resources = [var.jobs_table_arn]
  }
}

resource "aws_iam_policy" "upload_handler" {
  name   = "${local.upload_function_name}-policy"
  policy = data.aws_iam_policy_document.upload_handler.json
}

resource "aws_iam_role_policy_attachment" "upload_handler" {
  role       = aws_iam_role.upload_handler.name
  policy_arn = aws_iam_policy.upload_handler.arn
}

data "aws_iam_policy_document" "processing_worker" {
  statement {
    sid = "WriteOwnLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.processing_worker.arn}:*"]
  }

  statement {
    sid       = "ReadInvoiceUploadObjects"
    actions   = ["s3:GetObject"]
    resources = ["${var.document_bucket_arn}/uploads/invoice/*"]
  }

  statement {
    sid       = "UpdateJobLifecycle"
    actions   = ["dynamodb:UpdateItem"]
    resources = [var.jobs_table_arn]
  }
}

resource "aws_iam_policy" "processing_worker" {
  name   = "${local.worker_function_name}-policy"
  policy = data.aws_iam_policy_document.processing_worker.json
}

resource "aws_iam_role_policy_attachment" "processing_worker" {
  role       = aws_iam_role.processing_worker.name
  policy_arn = aws_iam_policy.processing_worker.arn
}

data "aws_iam_policy_document" "jobs_handler" {
  statement {
    sid = "WriteOwnLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${aws_cloudwatch_log_group.jobs_handler.arn}:*"]
  }

  statement {
    sid = "ReadJobRecords"
    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:Scan"
    ]
    resources = [var.jobs_table_arn]
  }

  statement {
    sid       = "DeleteInvoiceUploadObjects"
    actions   = ["s3:DeleteObject"]
    resources = ["${var.document_bucket_arn}/uploads/invoice/*"]
  }
}

resource "aws_iam_policy" "jobs_handler" {
  name   = "${local.jobs_function_name}-policy"
  policy = data.aws_iam_policy_document.jobs_handler.json
}

resource "aws_iam_role_policy_attachment" "jobs_handler" {
  role       = aws_iam_role.jobs_handler.name
  policy_arn = aws_iam_policy.jobs_handler.arn
}

resource "aws_lambda_function" "upload_handler" {
  function_name    = local.upload_function_name
  filename         = data.archive_file.upload_handler.output_path
  handler          = "lambda/upload-handler.handler"
  role             = aws_iam_role.upload_handler.arn
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.upload_handler.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      DOCUMENT_BUCKET_NAME       = var.document_bucket_name
      JOBS_TABLE_NAME            = var.jobs_table_name
      UPLOAD_URL_EXPIRES_SECONDS = tostring(var.upload_url_expires_seconds)
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.upload_handler,
    aws_iam_role_policy_attachment.upload_handler
  ]
}

resource "aws_lambda_function" "processing_worker" {
  function_name    = local.worker_function_name
  filename         = data.archive_file.upload_handler.output_path
  handler          = "lambda/processing-worker.handler"
  role             = aws_iam_role.processing_worker.arn
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.upload_handler.output_base64sha256
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      EXTRACTION_STRATEGY = "metadata_only"
      JOBS_TABLE_NAME     = var.jobs_table_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.processing_worker,
    aws_iam_role_policy_attachment.processing_worker
  ]
}

resource "aws_lambda_function" "jobs_handler" {
  function_name    = local.jobs_function_name
  filename         = data.archive_file.upload_handler.output_path
  handler          = "lambda/jobs-handler.handler"
  role             = aws_iam_role.jobs_handler.arn
  runtime          = "nodejs20.x"
  source_code_hash = data.archive_file.upload_handler.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      JOBS_TABLE_NAME = var.jobs_table_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.jobs_handler,
    aws_iam_role_policy_attachment.jobs_handler
  ]
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name_prefix}-${var.environment}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["DELETE", "GET", "OPTIONS", "POST"]
    allow_origins = ["*"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.http_api.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      httpMethod     = "$context.httpMethod"
      path           = "$context.path"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      integrationErr = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_apigatewayv2_integration" "upload_handler" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.upload_handler.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "jobs_handler" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.jobs_handler.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "create_upload" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /uploads"
  target    = "integrations/${aws_apigatewayv2_integration.upload_handler.id}"
}

resource "aws_apigatewayv2_route" "list_jobs" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /jobs"
  target    = "integrations/${aws_apigatewayv2_integration.jobs_handler.id}"
}

resource "aws_apigatewayv2_route" "get_job" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /jobs/{jobId}"
  target    = "integrations/${aws_apigatewayv2_integration.jobs_handler.id}"
}

resource "aws_apigatewayv2_route" "delete_job" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "DELETE /jobs/{jobId}"
  target    = "integrations/${aws_apigatewayv2_integration.jobs_handler.id}"
}

resource "aws_lambda_permission" "allow_http_api" {
  statement_id  = "AllowExecutionFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_http_api_jobs" {
  statement_id  = "AllowJobReadsFromHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.jobs_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/jobs*"
}

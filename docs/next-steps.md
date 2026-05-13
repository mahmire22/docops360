# Next Steps

## Step 1: Confirm Local Tooling

Check these commands locally:

```bash
node --version
npm --version
terraform version
aws sts get-caller-identity --profile docops360-dev
```

## Step 2: Install Dependencies

After the first scaffold is committed:

```bash
npm install
```

## Step 3: Run The Dashboard

```bash
npm run dev
```

## Step 4: Configure Terraform Backend

Start with local Terraform state during development. Move to a remote S3 backend after the first AWS foundation deploy is stable.

## Step 5: Build Incrementally

1. Local mock upload and job tracking
2. S3 bucket and DynamoDB job table
3. Lambda API handlers
4. SQS job queue
5. Step Functions workflow
6. Textract extraction step
7. Dashboard job detail view
8. CloudWatch alarms and interview-ready docs

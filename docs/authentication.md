# DocOps360 Authentication Foundation

DocOps360 is a single-owner MVP. Archive metadata, upload jobs, document delete operations, and goals are personal data and should not be exposed through public API routes.

Phase 6A.1 prepares Cognito authentication and API Gateway JWT authorization. It does not create a user, store credentials, enable external connectors, or run Terraform apply.

## Cognito Design

Terraform prepares:

- One Cognito User Pool in `us-east-1`.
- Public self-sign-up disabled. Users must be created or invited deliberately by the owner/admin.
- One browser SPA app client with no client secret.
- Cognito managed login using OAuth authorization-code flow with PKCE.
- Local development callback/logout URLs through Terraform variables:
  - `http://127.0.0.1:5173/`
  - `http://localhost:5173/`

The frontend uses managed login and stores only short-lived browser session tokens in local storage. It does not store AWS credentials, client secrets, passwords, or personal email addresses in source code.

## Protected API Routes

After Terraform is applied, API Gateway requires a valid Cognito JWT for:

- `POST /uploads`
- `GET /jobs`
- `GET /jobs/{jobId}`
- `DELETE /jobs/{jobId}`
- `GET /goals`
- `POST /goals`
- `PATCH /goals/{goalId}`
- `DELETE /goals/{goalId}`

CORS preflight remains public. The API allows the `Authorization` header so the browser can send Bearer tokens.

The S3 event notification to the processing Lambda remains internal and unchanged.

## Frontend Environment

After apply, use Terraform outputs to configure local frontend real mode:

```bash
VITE_API_BASE_URL=<http_api_endpoint>
VITE_UPLOAD_MODE=real
VITE_AUTH_MODE=cognito
VITE_COGNITO_DOMAIN=<cognito_hosted_ui_base_url>
VITE_COGNITO_CLIENT_ID=<cognito_app_client_id>
VITE_COGNITO_REDIRECT_URI=http://127.0.0.1:5173/
VITE_COGNITO_LOGOUT_URI=http://127.0.0.1:5173/
```

For local UI-only development without Cognito, explicitly use mock mode or `VITE_AUTH_MODE=local`. This bypass must not be used as a deployed configuration.

## Later Manual Owner Setup

After Terraform apply, create the owner user manually in Cognito. Do not commit the email address, password, temporary password, or any token.

Example CLI shape, using your own owner email locally:

```bash
aws cognito-idp admin-create-user \
  --profile docops360-dev \
  --region us-east-1 \
  --user-pool-id <cognito_user_pool_id> \
  --username <owner-email-address> \
  --user-attributes Name=email,Value=<owner-email-address> Name=email_verified,Value=true
```

Then complete the Cognito managed-login invite/password flow in the browser.

## Security Boundary

This phase creates an authenticated single-owner boundary. It does not yet implement per-user document isolation or a multi-tenant data migration. Existing document/job records are treated as belonging to the owner account once the protected API is deployed.

Technical IDs, object keys, JWT claims, and metadata should remain hidden from the normal user experience and only appear in Developer Details/System Console where appropriate.

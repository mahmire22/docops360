# AI Integration Readiness

DocOps360 is prepared for future AI enrichment, but the current MVP does not make live Bedrock, Claude, OpenAI, Lex, or other paid AI calls.

## Current Guardrails

- `EXTRACTION_STRATEGY=metadata_only`
- `ENABLE_BEDROCK=false`
- `ENABLE_OPENAI=false`
- `AI_MANUAL_TRIGGER_ONLY=true`
- Monthly AI budget is not configured

The frontend exposes these as disabled cost guardrails in the System Console. They are placeholders only and do not enable provider calls.

## ExtractionStrategy

The MVP extraction strategy is `metadata_only`.

`metadata_only` stores:

- source
- bucket and object key
- size and content type
- uploaded and processed timestamps
- processing lifecycle state
- a basic summary: `Document stored successfully. AI extraction is disabled.`

This keeps the system useful and cost-safe before paid AI is enabled.

## Future Bedrock / Claude Strategy

Future `bedrock_claude` can support:

- document summaries
- useful metadata extraction where possible
- priority assessment
- risk analysis
- recommendations
- review need detection
- evidence and citation fields
- decision support

The AI layer should read from DocOps360 evidence, metadata, goals, projects, decisions, and audit history rather than acting as a generic chatbot. If AI review fails, it should fall back safely to `metadata_only`.

## Future MCP Tool Surface

MCP is not implemented in the MVP. The future assistant can expose narrow internal tools when the product is ready:

- `search_archive`
- `get_document_metadata`
- `list_goals`
- `get_project_context`
- `summarize_recent_documents`

Those tools should stay read-focused first. Any future write/action tools should remain explicit, auditable, and human-reviewed.

## Product Data Kept By DocOps360

DocOps360 is designed to store and connect:

- evidence
- document metadata
- personal context and goals
- projects and sessions
- recommendations
- future action-review checkpoints
- decisions
- audit trail

This keeps the product value in the operational intelligence layer, with AI providers acting as replaceable enrichment services later.

## Safety Principle

AI should not perform sensitive actions automatically. Future actions such as sending emails, creating calendar events, drafting payment decisions, or changing external systems should require explicit human review and remain auditable.

## Future Flow

Input -> Archive/evidence -> metadata -> compare with active goals -> check project context -> check review need -> recommend or file quietly

Phase 5D keeps this simple in the MVP. It does not execute AI calls.

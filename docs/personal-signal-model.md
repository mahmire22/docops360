# Personal Operations Signal Model

DocOps360 is a Personal Operations Intelligence Assistant. The normalized `SignalRecord` model is the main intelligence unit behind that direction.

## Why Signals

A signal is a personal or operational item that may need tracking, review, a decision, or an action. Documents are one source of signals. Later, the same model can represent bills, moving tasks, school/admin documents, appointments, finance decisions, legal/admin documents, email items, calendar events, and messages.

The product should help answer:

- What needs attention?
- What is being monitored?
- What has been handled?
- What should I review next?
- What decision or action is waiting?
- What evidence supports it?

## Current Phase

Document upload is the first active source. The first upload module still uses `documentType=invoice` internally because invoice-style documents are useful for testing structured metadata, but the product language should stay broader: bills, letters, forms, invoices, and admin documents.

For now, each document job from the existing upload pipeline is mapped into a `SignalRecord`:

- `source`: `document_upload`
- `category`: currently derived from document type, with invoice-style uploads mapped to `invoice`
- `priority`: derived from job status
- `status`: derived from job status
- `summary`: human-readable explanation
- `recommendedAction`: simple next step
- `linkedJobId`: existing document job ID
- `evidenceRefs`: links back to the job, document, or storage object
- `technicalMetadata`: bucket, object key, processing state, and worker metadata

No new storage table or API is required in this phase. The frontend derives signals from `GET /jobs` and `GET /jobs/{jobId}` so the deployed upload pipeline remains unchanged.

## Status And Priority Mapping

| Job status | Signal status | Signal priority | Recommended action |
| --- | --- | --- | --- |
| `uploaded` | `new` | `monitoring` | `monitor_processing` |
| `queued` | `monitoring` | `monitoring` | `monitor_processing` |
| `processing` | `monitoring` | `monitoring` | `monitor_processing` |
| `completed` | `completed` | `normal` | `use_as_decision_evidence` |
| `review_required` | `needs_review` | `attention` | `review_document_manually` |
| `failed` | `failed` | `attention` | `review_document_manually` |

Completed documents are treated as evidence that can support future summaries, priorities, and actions. Failed or review-required items become attention signals.

## Future Sources

Future connectors can add signals without changing the core dashboard model:

- Email can produce `source=email` signals for bills, admin notices, travel, or school communication.
- Calendar can produce `source=calendar` signals for appointments, deadlines, and reminders.
- Messages can produce `source=message` signals for important personal or family admin threads.
- Bills can produce finance/admin signals from recurring charges and payment reminders.
- Manual entry can create `source=manual` signals for moving plans, finance decisions, or legal tasks.

Each connector should normalize raw input into the same fields: title, source, category, priority, status, summary, recommended action, timestamps, confidence, evidence references, and technical metadata.

## Document Metadata Foundation

Document metadata exists so uploaded files can later become stronger evidence for decisions:

- `supplier`
- `invoiceNumber`
- `totalAmount`
- `dueDate`
- `documentDate`
- `extractedTextAvailable`
- `extractionProvider`
- `extractionStrategy`
- `intelligenceReadiness`
- `confidence`

In the current phase, `extractionStrategy` and `extractionProvider` are `metadata_only`, `extractedTextAvailable` is `false`, confidence is `null`, and extraction-specific fields remain empty. This keeps the UI and data model ready without running paid AI services.

## Metadata-Only And Bedrock Strategy

DocOps360 does not use Textract in the MVP. The active strategy is `metadata_only`.

`metadata_only` stores source, object metadata, timestamps, lifecycle state, and a basic summary:

```text
Document stored successfully. AI extraction is disabled.
```

Bedrock/Claude can later enrich signals with reasoning and language tasks:

- summaries
- risks
- priority suggestions
- due-date reasoning
- recommended actions
- decision support
- evidence citations

Future `bedrock_claude` should interpret evidence and produce helpful personal operations intelligence. If AI review fails or is not manually triggered, the system should remain useful with `metadata_only`.

AI analysis can later update:

- `summary`
- `priority`
- `category`
- `recommendedAction`
- `dueDate`
- `evidenceRefs`
- `confidence`
- document-level decision metadata

The important rule is that AI output should enrich the signal model rather than becoming a separate chatbot-only experience.

## Relationship To Operational Intelligence

Signals are the input to the Operational Intelligence Layer. That layer links signals to goals, converts evidence into recommendations, and proposes review-aware actions. Formal approval/action-review workflows are future-only.

The intended loop is:

```text
Input/document -> Archive/evidence -> metadata -> compare with active goals -> check project context -> check review need -> recommend or file quietly
```

Each incoming document or future signal is filtered through source, document type, related goal, related project, priority, review need, action type, and evidence quality. Archived goals should generally be ignored for active recommendations unless explicitly searched or linked.

Phase 4A uses deterministic rules for this loop. Later Bedrock/Claude can enrich the same records with stronger summaries, risk detection, prioritisation, and decision support.

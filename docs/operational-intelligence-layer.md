# Operational Intelligence Layer

The Operational Intelligence Layer is the custom DocOps360 product layer between raw AWS data and future LLM reasoning.

It turns documents, signals, goals, evidence, workflow state, and safety rules into decision-ready recommendations.

## Product Loop

DocOps360 should support this loop:

```text
Input/document -> Archive/evidence -> metadata -> compare with active goals -> check project context -> check review need -> recommend or file quietly
```

Phase 4A/5C implements the foundation without Bedrock, Claude, OpenAI, or external connectors.

## Core Concepts

- `UserGoal`: the personal context a signal can support, such as study, family admin, moving/travel, bills, or career.
- `EvidenceRef`: a clean reference to the document, signal, job, or future connector item that supports a recommendation.
- `RecommendationRecord`: a decision-ready suggestion derived from signals and evidence.
- `ActionProposal`: the proposed next step, with a safety level. Approval-style checkpoints are future-only for agentic actions.
- `ApprovalItem`: a future human checkpoint shape for sensitive agentic actions. It is not part of the MVP user flow.
- `DecisionRecord`: a future container for recommendation-backed decisions.
- `WorkflowState`: the current point in the intelligence loop.
- `OperationalImpact`: lightweight metrics that show what the layer has organized, suggested, completed, or flagged.

## Deterministic Phase 4A Rules

No AI is used yet. The current mapper is intentionally simple and replaceable:

| Input condition | Recommendation | Action | Review |
| --- | --- | --- | --- |
| Completed document | File this document as evidence | Review later if AI extraction is needed | No |
| Uploaded, queued, or processing document | Monitor processing status | Wait for processing to complete | No |
| Failed or review-required document | Review document issue | Open developer details or re-upload document | Suggested |
| Filename contains AWS or invoice | Keep this as billing/training evidence | Review for future expense or training records | No |

This gives the UI and type system a real recommendation shape now, while keeping the logic cheap, transparent, and easy to replace.

## Why This Layer Matters

AWS services provide durable storage, events, APIs, and workflow state. LLMs can provide reasoning and summarization. The Operational Intelligence Layer connects those pieces into a product:

- normalizes inputs into signals
- preserves evidence
- links signals to goals and context
- turns workflow state into recommendations
- separates safe suggestions from items that need manual review
- remembers what was handled

Without this layer, the product would be only document storage or a generic chat interface.

## Future AI Enrichment

Bedrock/Claude can later enhance or replace the deterministic mapper by:

- summarizing document meaning
- detecting risks
- estimating urgency
- linking signals to personal goals
- proposing recommended actions
- drafting decision explanations
- producing evidence citations

AI output should write back into the same `RecommendationRecord`, `ActionProposal`, evidence, and future `DecisionRecord` shapes. Sensitive future actions can use the dormant `ApprovalItem` shape, but approvals are hidden from the MVP UI.

## ExtractionStrategy

DocOps360 MVP uses `metadata_only`. The worker reads S3 object metadata and stores enough evidence to keep the Archive useful without paid AI calls.

Future `bedrock_claude` can summarize, extract helpful metadata, identify risks, propose actions, and cite evidence. It should remain manual-triggered and fail safely back to `metadata_only`.

Textract is removed from the MVP architecture.

## Demo Story

Upload documents such as:

- utility bill
- travel booking
- study result
- job description

DocOps360 can then derive signals, file evidence, generate recommendations, and identify items needing review. Future AI can enrich the same records with summaries, risks, priorities, and decision support.

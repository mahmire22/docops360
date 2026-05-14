export type DocumentType = "invoice" | "warranty_claim" | "service_report" | "dealer_document";

export type UploadMethod = "mock" | "presigned_put";

export type JobStatus =
  | "uploaded"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "review_required";

export interface DocumentJob {
  id: string;
  documentType: DocumentType;
  fileName: string;
  status: JobStatus;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
  bucket?: string;
  objectKey?: string;
  uploadedAt?: string;
  processedAt?: string;
  processingMetadata?: Record<string, string | number | boolean | null>;
  errorMessage?: string;
  failureReason?: string;
}

export interface ValidationFinding {
  field: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface AuditEvent {
  at: string;
  actor: "system" | "user" | "workflow";
  message: string;
}

export interface ProcessingStep {
  name: "uploaded" | "queued" | "processing" | "completed" | "review";
  status: "pending" | "running" | "complete" | "blocked";
}

export interface InvoiceExtraction {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency?: string;
  netAmount?: number;
  taxAmount?: number;
  grossAmount?: number;
  confidence: number;
}

export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface CreateUploadRequest {
  documentType: DocumentType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface UploadTarget {
  method: UploadMethod;
  bucketName: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface CreateUploadResponse {
  job: DocumentJob;
  uploadTarget: UploadTarget;
}

export interface JobRecord extends DocumentJob {
  bucket: string;
  objectKey: string;
}

export type IntelligenceProvider = "none" | "bedrock_claude" | "openai" | "manual";

export type ExtractionStrategy = "metadata_only" | "bedrock_claude";

export type ExtractionProvider = ExtractionStrategy;

export type IntelligenceCardReadiness = "metadata_only" | "ready_for_ai_review" | "needs_manual_review";

export interface EvidenceCitation {
  citationId: string;
  sourceType: "document" | "metadata" | "signal" | "manual";
  linkedJobId?: string;
  label: string;
  value?: string;
}

export interface ExtractedMetadata {
  source: "device_upload" | "email" | "calendar" | "message" | "bill" | "manual";
  documentType: DocumentType | "general_document";
  supplier: string | null;
  invoiceNumber: string | null;
  totalAmount: number | null;
  dueDate: string | null;
  documentDate: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  confidence: number | null;
}

export interface DocumentMetadata {
  supplier: string | null;
  invoiceNumber: string | null;
  totalAmount: number | null;
  dueDate: string | null;
  documentDate: string | null;
  extractedTextAvailable: boolean;
  extractionProvider: ExtractionProvider;
  extractionStrategy: ExtractionStrategy;
  intelligenceReadiness: IntelligenceCardReadiness;
  confidence: number | null;
}

export type SignalSource =
  | "document_upload"
  | "email"
  | "calendar"
  | "message"
  | "finance"
  | "school_admin"
  | "legal_admin"
  | "manual";

export type SignalCategory =
  | "invoice"
  | "bill"
  | "appointment"
  | "school"
  | "moving"
  | "finance"
  | "legal"
  | "health_admin"
  | "career"
  | "general_admin";

export type SignalPriority = "normal" | "monitoring" | "attention" | "urgent";

export type SignalStatus = "new" | "monitoring" | "completed" | "needs_review" | "failed";

export type SignalAction =
  | "none"
  | "monitor_processing"
  | "review_document_manually"
  | "use_as_decision_evidence";

export interface SignalEvidenceRef {
  type: "job" | "document" | "storage_object" | "external_source";
  refId: string;
  label?: string;
}

export interface SignalRecord {
  signalId: string;
  linkedJobId?: string;
  title: string;
  source: SignalSource;
  category: SignalCategory;
  priority: SignalPriority;
  status: SignalStatus;
  summary: string;
  recommendedAction: SignalAction;
  dueDate?: string;
  receivedAt: string;
  updatedAt: string;
  confidence: number | null;
  documentMetadata?: DocumentMetadata;
  evidenceRefs: SignalEvidenceRef[];
  technicalMetadata: Record<string, string | number | boolean | null | undefined>;
}

export type UserGoalCategory =
  | "family_admin"
  | "moving_travel"
  | "bills_finance"
  | "finance_investment"
  | "career"
  | "hobby"
  | "relationship"
  | "others"
  | "general";

export type UserGoalStatus = "active" | "future" | "paused" | "completed" | "archived";

export interface UserGoal {
  goalId: string;
  title: string;
  category: UserGoalCategory;
  status: UserGoalStatus;
  priority: SignalPriority;
  targetDate?: string;
  description: string;
}

export type EvidenceSourceType =
  | "document"
  | "signal"
  | "job"
  | "email"
  | "calendar"
  | "message"
  | "manual";

export interface EvidenceRef {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  linkedJobId?: string;
  linkedSignalId?: string;
  documentName?: string;
  receivedAt: string;
  summary: string;
}

export type RecommendationConfidence = "low" | "medium" | "high";

export type RecommendationStatus = "suggested" | "pending_approval" | "approved" | "completed" | "dismissed";

export interface RecommendationRecord {
  recommendationId: string;
  linkedSignalId?: string;
  linkedGoalId?: string;
  title: string;
  summary: string;
  recommendedAction: string;
  priority: SignalPriority;
  confidence: RecommendationConfidence;
  evidenceRefs: EvidenceRef[];
  approvalRequired: boolean;
  createdAt: string;
  status: RecommendationStatus;
}

export type ActionSafetyLevel = "safe" | "approval_required" | "restricted";

export type ActionProposalType =
  | "file_evidence"
  | "monitor_status"
  | "manual_review"
  | "review_for_records"
  | "future_ai_review";

export interface ActionProposal {
  actionId: string;
  title: string;
  actionType: ActionProposalType;
  safetyLevel: ActionSafetyLevel;
  recommendedNextStep: string;
  approvalRequired: boolean;
  linkedRecommendationId: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "completed" | "archived";

export interface ApprovalItem {
  approvalId: string;
  title: string;
  reason: string;
  linkedActionId: string;
  status: ApprovalStatus;
  createdAt: string;
}

export type WorkflowState =
  | "input_received"
  | "understood"
  | "linked_to_context"
  | "recommended"
  | "approval_pending"
  | "approved"
  | "completed"
  | "remembered";

export interface DecisionRecord {
  decisionId: string;
  title: string;
  linkedRecommendationIds: string[];
  linkedGoalId?: string;
  evidenceRefs: EvidenceRef[];
  workflowState: WorkflowState;
  status: "draft" | "ready_for_review" | "approved" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface OperationalImpact {
  documentsProcessed: number;
  recommendationsGenerated: number;
  actionsSuggested: number;
  itemsCompleted: number;
  attentionItems: number;
  approvalsPending: number;
  deadlinesDetected: number;
  estimatedManualTimeSavedMinutes: number;
}

export interface IntelligenceFilterModel {
  source: SignalSource;
  documentType: DocumentType | "general_document";
  relatedGoalId?: string;
  relatedProjectId?: string;
  priority: SignalPriority;
  approvalNeed: "none" | "suggested" | "required";
  actionType: SignalAction | ActionProposalType;
  evidenceQuality: "metadata_only" | "partial" | "strong" | "needs_review";
}

export interface AIReviewRequest {
  requestId: string;
  provider: IntelligenceProvider;
  linkedSignalIds: string[];
  linkedGoalIds: string[];
  evidenceRefs: EvidenceRef[];
  prompt: string;
  manualTriggerOnly: boolean;
  createdAt: string;
}

export interface AIReviewResult {
  requestId: string;
  provider: IntelligenceProvider;
  summary: string;
  risks: string[];
  recommendations: RecommendationRecord[];
  citations: EvidenceCitation[];
  confidence: RecommendationConfidence;
  usageEstimate?: AIUsageEstimate;
  createdAt: string;
}

export interface ExtractionRequest {
  requestId: string;
  provider: ExtractionProvider;
  linkedJobId: string;
  documentName: string;
  contentType?: string;
  manualTriggerOnly: boolean;
  createdAt: string;
}

export interface ExtractionResult {
  requestId: string;
  provider: ExtractionProvider;
  strategy: ExtractionStrategy;
  extractedTextAvailable: boolean;
  metadata: ExtractedMetadata;
  summary: string;
  citations: EvidenceCitation[];
  intelligenceReadiness: IntelligenceCardReadiness;
  confidence: number | null;
  warnings: string[];
  usageEstimate?: AIUsageEstimate;
  createdAt: string;
}

export type ExtractionStrategyResult = ExtractionResult;

export interface CostGuardrailConfig {
  bedrockEnabled: boolean;
  openAiEnabled: boolean;
  extractionStrategy: ExtractionStrategy;
  manualTriggerOnly: boolean;
  monthlyBudgetLimit: number | null;
  currency: "GBP" | "USD";
}

export interface AIUsageEstimate {
  provider: IntelligenceProvider | ExtractionProvider;
  inputUnits: number;
  outputUnits: number;
  estimatedCost: number | null;
  currency: "GBP" | "USD";
}

export interface ListJobsResponse {
  jobs: JobRecord[];
}

export interface GetJobResponse {
  job: JobRecord;
}

export interface DeleteJobResponse {
  jobId: string;
  deletedObjectKey: string;
  deletedBucket: string;
}

export type ApprovalRiskLevel = "low" | "medium" | "high";

export type ApprovalActionType =
  | "reminder"
  | "document_review"
  | "email_draft"
  | "payment_review"
  | "admin_task"
  | "other";

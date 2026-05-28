import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  ActionProposal,
  ApprovalItem,
  AuditEvent,
  CostGuardrailConfig,
  DocumentJob,
  DocumentMetadata,
  EvidenceRef,
  InvoiceExtraction,
  JobRecord,
  OperationalImpact,
  ProcessingStep,
  RecommendationRecord,
  SignalAction,
  SignalCategory,
  SignalPriority,
  SignalRecord,
  SignalStatus,
  UploadTarget,
  UserGoal,
  UserGoalCategory,
  ValidationFinding
} from "@docops360/shared";
import {
  createUploadRequest,
  deleteJobRequest,
  getJobRequest,
  getUploadMode,
  isRealMode,
  isTerminalStatus,
  listJobsRequest,
  uploadFileToTarget
} from "./api";
import "./styles.css";

interface OperationsJob extends JobRecord {
  extraction?: InvoiceExtraction;
  findings: ValidationFinding[];
  audit: AuditEvent[];
  steps: ProcessingStep[];
  signal: SignalRecord;
  uploadTarget?: UploadTarget;
  requestId?: string;
}

type AppView = "assistant" | "documents" | "activity" | "goals" | "sources" | "developer" | "system" | "project";
type DateRangeFilter = "today" | "week" | "month" | "older" | "all";
type StatusFilter = "all" | DocumentJob["status"];
type GoalStatusFilter = "active" | "future" | "archived" | "all";
type ArchiveSourceFilter =
  | "all"
  | "device_upload"
  | "email"
  | "calendar"
  | "messages"
  | "bills"
  | "local_pc_sync"
  | "mobile_uploads"
  | "cloud_storage"
  | "shared_folders"
  | "file_server";

interface LocalProject {
  projectId: string;
  name: string;
  description?: string;
  category?: string;
  archived?: boolean;
  linkedSessionIds?: string[];
}

type GoalHistoryAction = "created" | "edited" | "priority_changed" | "notes_changed" | "status_changed" | "archived" | "deleted";

interface GoalHistoryItem {
  historyId: string;
  action: GoalHistoryAction;
  message: string;
  at: string;
}

interface GoalFormState {
  title: string;
  category: UserGoalCategory;
  priority: SignalPriority;
  status: UserGoal["status"];
  description: string;
}

interface ChatSession {
  sessionId: string;
  title: string;
  updatedAt: string;
  projectId?: string;
}

const ENABLE_BEDROCK = false;
const ENABLE_OPENAI = false;
const EXTRACTION_STRATEGY = "metadata_only" as const;
const AI_MANUAL_TRIGGER_ONLY = true;
const AI_MONTHLY_BUDGET_LIMIT_GBP: number | null = null;
const BEDROCK_MODEL_ID = "anthropic.claude-3-5-sonnet";

const aiCostGuardrails: CostGuardrailConfig = {
  bedrockEnabled: ENABLE_BEDROCK,
  openAiEnabled: ENABLE_OPENAI,
  extractionStrategy: EXTRACTION_STRATEGY,
  manualTriggerOnly: AI_MANUAL_TRIGGER_ONLY,
  monthlyBudgetLimit: AI_MONTHLY_BUDGET_LIMIT_GBP,
  currency: "GBP"
};

const lifecycleOrder: Array<ProcessingStep["name"]> = ["uploaded", "queued", "processing", "completed"];

const nowIso = () => new Date().toISOString();

const stepsForStatus = (status: DocumentJob["status"]): ProcessingStep[] => {
  if (status === "failed") {
    return [
      { name: "uploaded", status: "complete" },
      { name: "queued", status: "complete" },
      { name: "processing", status: "blocked" },
      { name: "completed", status: "pending" }
    ];
  }

  if (status === "review_required") {
    return [
      { name: "uploaded", status: "complete" },
      { name: "queued", status: "complete" },
      { name: "processing", status: "blocked" },
      { name: "review", status: "running" },
      { name: "completed", status: "pending" }
    ];
  }

  const currentIndex = lifecycleOrder.indexOf(status as ProcessingStep["name"]);

  return lifecycleOrder.map((name, index) => ({
    name,
    status: index < currentIndex || status === "completed" ? "complete" : index === currentIndex ? "running" : "pending"
  }));
};

const formatTime = (value?: string) => (value ? new Date(value).toLocaleTimeString() : "Pending");
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "Pending");

const metadataEntries = (job: OperationsJob) =>
  Object.entries(job.signal.technicalMetadata ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)] as const);

const pipelineStages = ["Browser/device upload", "API Gateway", "Lambda", "S3", "S3 Event", "Worker Lambda", "DynamoDB", "Read API", "UI"];
const intelligenceSources = [
  { name: "Device upload", status: "Active" },
  { name: "Email", status: "Coming soon" },
  { name: "Calendar", status: "Coming soon" },
  { name: "Messages", status: "Coming soon" },
  { name: "Bills", status: "Coming soon" },
  { name: "Local device / PC sync", status: "Coming soon" },
  { name: "Mobile uploads", status: "Coming soon" },
  { name: "Cloud storage", status: "Coming soon" },
  { name: "Shared folders", status: "Coming soon" },
  { name: "File server / enterprise source", status: "Coming soon" }
];

const archiveSourceOptions: Array<{ value: ArchiveSourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "device_upload", label: "Device upload" },
  { value: "email", label: "Email" },
  { value: "calendar", label: "Calendar" },
  { value: "messages", label: "Messages" },
  { value: "bills", label: "Bills" },
  { value: "local_pc_sync", label: "Local device / PC sync" },
  { value: "mobile_uploads", label: "Mobile uploads" },
  { value: "cloud_storage", label: "Cloud storage" },
  { value: "shared_folders", label: "Shared folders" },
  { value: "file_server", label: "File server / enterprise source" }
];

const defaultGoals: UserGoal[] = [
  {
    goalId: "goal_family_admin",
    title: "Family admin",
    category: "family_admin",
    status: "active",
    priority: "normal",
    description: "Track household documents, appointments, and shared responsibilities."
  },
  {
    goalId: "goal_travel",
    title: "Travel",
    category: "moving_travel",
    status: "active",
    priority: "monitoring",
    description: "Organize documents that affect travel, relocation, or timing decisions."
  },
  {
    goalId: "goal_bills",
    title: "Bills",
    category: "bills_finance",
    status: "active",
    priority: "monitoring",
    description: "Keep bills, invoices, and payments visible for future review."
  },
  {
    goalId: "goal_finance_investment",
    title: "Finance / investment",
    category: "finance_investment",
    status: "active",
    priority: "normal",
    description: "Track evidence that may support savings, planning, or investment decisions."
  },
  {
    goalId: "goal_work",
    title: "Work",
    category: "career",
    status: "active",
    priority: "normal",
    description: "Collect useful career, job, and portfolio evidence."
  },
  {
    goalId: "goal_others",
    title: "Others",
    category: "others",
    status: "active",
    priority: "normal",
    description: "Keep flexible context for admin, life, and decision areas that do not fit elsewhere."
  },
  {
    goalId: "goal_hobby",
    title: "Hobby",
    category: "hobby",
    status: "active",
    priority: "normal",
    description: "Track personal interests, learning, and creative activities."
  },
  {
    goalId: "goal_relationship",
    title: "Relationship",
    category: "relationship",
    status: "active",
    priority: "normal",
    description: "Keep context for shared plans, communication, and important personal decisions."
  }
];

const signalCategoryForDocumentType = (documentType: DocumentJob["documentType"]): SignalCategory =>
  documentType === "invoice" ? "invoice" : "general_admin";

const goalHistoryItem = (action: GoalHistoryAction, message: string): GoalHistoryItem => ({
  historyId: `history_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  action,
  message,
  at: nowIso()
});

const currentLocalTime = () => new Date().toLocaleString();

const initialGoalHistory = (goals: UserGoal[]): Record<string, GoalHistoryItem[]> =>
  Object.fromEntries(
    goals.map((goal) => [
      goal.goalId,
      [
        {
          historyId: `history_${goal.goalId}_created`,
          action: "created",
          message: "Goal created as starter context.",
          at: nowIso()
        }
      ]
    ])
  );

const goalCategoryLabels: Record<UserGoalCategory, string> = {
  family_admin: "Family admin",
  moving_travel: "Travel",
  bills_finance: "Bills",
  finance_investment: "Finance / investment",
  career: "Work",
  hobby: "Hobby",
  relationship: "Relationship",
  others: "Others",
  general: "Others"
};

const documentMetadataFromJob = (_job: JobRecord): DocumentMetadata => ({
  supplier: null,
  invoiceNumber: null,
  totalAmount: null,
  dueDate: null,
  documentDate: null,
  extractedTextAvailable: false,
  extractionProvider: "metadata_only",
  extractionStrategy: "metadata_only",
  intelligenceReadiness: "metadata_only",
  confidence: null
});

const signalPriorityForJobStatus = (status: DocumentJob["status"]): SignalPriority => {
  if (status === "failed" || status === "review_required") {
    return "attention";
  }

  if (["uploaded", "queued", "processing"].includes(status)) {
    return "monitoring";
  }

  return "normal";
};

const signalStatusForJobStatus = (status: DocumentJob["status"]): SignalStatus => {
  if (status === "completed") {
    return "completed";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "review_required") {
    return "needs_review";
  }

  if (status === "uploaded") {
    return "new";
  }

  return "monitoring";
};

const actionForJobStatus = (status: DocumentJob["status"]): SignalAction => {
  if (status === "failed" || status === "review_required") {
    return "review_document_manually";
  }

  if (status === "completed") {
    return "use_as_decision_evidence";
  }

  return "monitor_processing";
};

const signalSummaryForJob = (job: JobRecord) => {
  if (job.status === "completed") {
    return "Document stored as evidence for future summaries, priorities, and actions.";
  }

  if (job.status === "failed") {
    return job.failureReason ?? job.errorMessage ?? "Review document manually because processing failed.";
  }

  if (job.status === "review_required") {
    return job.failureReason ?? "Review document manually before marking this signal as handled.";
  }

  return "Document received and being monitored while processing completes.";
};

const actionLabel = (action: SignalAction) => {
  const labels: Record<SignalAction, string> = {
    none: "No action needed",
    monitor_processing: "Monitor processing",
    review_document_manually: "Review document manually",
    use_as_decision_evidence: "Use as evidence for future decisions"
  };

  return labels[action];
};

const sourceLabel = (source: SignalRecord["source"]) =>
  source === "document_upload" ? "Device upload" : source.replaceAll("_", " ");

const signalStatusLabel = (status: SignalRecord["status"]) => status.replace("_", " ");

const toTitleCase = (value: string) => value.replace(/\b\w/g, (character) => character.toUpperCase());

const priorityView = (priority: SignalPriority) => {
  if (priority === "attention" || priority === "urgent") {
    return { label: "Attention needed", className: "attention" };
  }

  if (priority === "monitoring") {
    return { label: "Monitoring", className: "monitoring" };
  }

  return { label: "Normal", className: "normal" };
};

const friendlySubject = (job: OperationsJob) => {
  const filename = job.fileName.toLowerCase();

  if (filename.includes("aws")) {
    return "AWS invoice";
  }

  if (filename.includes("bill") || filename.includes("billing")) {
    return "billing document";
  }

  if (job.signal.category === "invoice" || filename.includes("invoice")) {
    return "invoice";
  }

  return "document";
};

const taskTitleForSignal = (job: OperationsJob) => {
  const subject = friendlySubject(job);

  if (job.signal.status === "failed" || job.signal.status === "needs_review") {
    return "Review document issue";
  }

  if (job.signal.status === "completed") {
    return `${toTitleCase(subject)} processed successfully`;
  }

  if (subject.includes("invoice")) {
    return `Review uploaded ${subject}`;
  }

  return "Document waiting for processing";
};

interface OperationalRecommendationBundle {
  job: OperationsJob;
  recommendation: RecommendationRecord;
  action: ActionProposal;
  approval?: ApprovalItem;
}

const priorityRank: Record<SignalPriority, number> = {
  urgent: 4,
  attention: 3,
  monitoring: 2,
  normal: 1
};

const goalForJob = (job: OperationsJob) => {
  const filename = job.fileName.toLowerCase();

  if (
    filename.includes("invoice") ||
    filename.includes("bill") ||
    filename.includes("billing") ||
    filename.includes("aws")
  ) {
    return "goal_bills";
  }

  if (filename.includes("study") || filename.includes("training") || filename.includes("cert")) {
    return "goal_work";
  }

  if (filename.includes("travel") || filename.includes("booking") || filename.includes("move")) {
    return "goal_travel";
  }

  if (filename.includes("job") || filename.includes("cv") || filename.includes("career")) {
    return "goal_work";
  }

  return "goal_family_admin";
};

const evidenceRefFromJob = (job: OperationsJob): EvidenceRef => ({
  evidenceId: `evidence_${job.id}`,
  sourceType: "document",
  linkedJobId: job.id,
  linkedSignalId: job.signal.signalId,
  documentName: job.fileName,
  receivedAt: job.uploadedAt ?? job.createdAt,
  summary: job.signal.summary
});

const activityItemsForBundle = (bundle: OperationalRecommendationBundle) => {
  const uploadedAt = bundle.job.uploadedAt ?? bundle.job.createdAt;
  const processedLabel =
    bundle.job.status === "completed"
      ? "Processing completed"
      : bundle.job.status === "failed" || bundle.job.status === "review_required"
        ? "Processing needs review"
        : "Processing in progress";

  return [
    {
      title: "Document uploaded",
      detail: "A document entered the personal operations workspace.",
      at: uploadedAt
    },
    {
      title: processedLabel,
      detail:
        bundle.job.status === "completed"
          ? "The document is available in the archive as evidence."
          : "DocOps360 is tracking the current processing state.",
      at: bundle.job.processedAt ?? bundle.job.updatedAt
    },
    {
      title: "Recommendation prepared",
      detail: bundle.recommendation.title,
      at: bundle.recommendation.createdAt
    },
    {
      title: bundle.approval ? "Manual review suggested" : "No review needed",
      detail: bundle.approval?.reason ?? "This item can stay filed quietly unless you search for it later.",
      at: bundle.approval?.createdAt ?? bundle.recommendation.createdAt
    }
  ];
};

const recommendationBundleFromJob = (job: OperationsJob): OperationalRecommendationBundle => {
  const evidence = evidenceRefFromJob(job);
  const createdAt = job.updatedAt;
  const linkedGoalId = goalForJob(job);
  const filename = job.fileName.toLowerCase();
  const isBillingEvidence = filename.includes("aws") || filename.includes("invoice");
  const baseId = job.signal.signalId.replace(/^sig_/, "");

  if (job.status === "failed" || job.status === "review_required") {
    const recommendation: RecommendationRecord = {
      recommendationId: `rec_${baseId}`,
      linkedSignalId: job.signal.signalId,
      linkedGoalId,
      title: "Review document issue",
      summary: "This document needs manual review before it can be treated as handled evidence.",
      recommendedAction: "Open developer details or re-upload the document.",
      priority: "attention",
      confidence: "high",
      evidenceRefs: [evidence],
      approvalRequired: true,
      createdAt,
      status: "pending_approval"
    };
    const action: ActionProposal = {
      actionId: `action_${baseId}`,
      title: "Review or re-upload document",
      actionType: "manual_review",
      safetyLevel: "approval_required",
      recommendedNextStep: recommendation.recommendedAction,
      approvalRequired: true,
      linkedRecommendationId: recommendation.recommendationId
    };

    return {
      job,
      recommendation,
      action,
      approval: {
        approvalId: `approval_${baseId}`,
        title: "Confirm manual review",
        reason: "This document needs human attention before any follow-up action is suggested.",
        linkedActionId: action.actionId,
        status: "pending",
        createdAt
      }
    };
  }

  if (["uploaded", "queued", "processing"].includes(job.status)) {
    const recommendation: RecommendationRecord = {
      recommendationId: `rec_${baseId}`,
      linkedSignalId: job.signal.signalId,
      linkedGoalId,
      title: "Monitor processing status",
      summary: "The document is still moving through the intake workflow.",
      recommendedAction: "Wait for processing to complete.",
      priority: "monitoring",
      confidence: "high",
      evidenceRefs: [evidence],
      approvalRequired: false,
      createdAt,
      status: "suggested"
    };

    return {
      job,
      recommendation,
      action: {
        actionId: `action_${baseId}`,
        title: "Wait for processing",
        actionType: "monitor_status",
        safetyLevel: "safe",
        recommendedNextStep: recommendation.recommendedAction,
        approvalRequired: false,
        linkedRecommendationId: recommendation.recommendationId
      }
    };
  }

  const recommendation: RecommendationRecord = {
    recommendationId: `rec_${baseId}`,
    linkedSignalId: job.signal.signalId,
    linkedGoalId,
    title: isBillingEvidence ? "Keep this as billing/training evidence" : "File this document as evidence",
    summary: isBillingEvidence
      ? "This looks useful for future billing, expense, or training context."
      : "This document has been handled and can support future summaries, priorities, and actions.",
    recommendedAction: isBillingEvidence
      ? "Review for future expense or training records."
      : "Review later if structured extraction is needed.",
    priority: "normal",
    confidence: "medium",
    evidenceRefs: [evidence],
    approvalRequired: false,
    createdAt,
    status: "suggested"
  };

  return {
    job,
    recommendation,
    action: {
      actionId: `action_${baseId}`,
      title: isBillingEvidence ? "Review for records" : "File as evidence",
      actionType: isBillingEvidence ? "review_for_records" : "file_evidence",
      safetyLevel: "safe",
      recommendedNextStep: recommendation.recommendedAction,
      approvalRequired: false,
      linkedRecommendationId: recommendation.recommendationId
    }
  };
};

const signalFromJob = (job: JobRecord): SignalRecord => {
  const signalId = `sig_${job.id}`;
  const documentMetadata = documentMetadataFromJob(job);

  return {
    signalId,
    linkedJobId: job.id,
    title: job.fileName,
    source: "document_upload",
    category: signalCategoryForDocumentType(job.documentType),
    priority: signalPriorityForJobStatus(job.status),
    status: signalStatusForJobStatus(job.status),
    summary: signalSummaryForJob(job),
    recommendedAction: actionForJobStatus(job.status),
    receivedAt: job.uploadedAt ?? job.createdAt,
    updatedAt: job.updatedAt,
    confidence: job.confidence,
    documentMetadata,
    evidenceRefs: [
      { type: "job", refId: job.id, label: "Linked document job" },
      { type: "storage_object", refId: `${job.bucket}/${job.objectKey}`, label: "Uploaded source document" }
    ],
    technicalMetadata: {
      bucket: job.bucket,
      objectKey: job.objectKey,
      documentType: job.documentType,
      jobStatus: job.status,
      uploadedAt: job.uploadedAt,
      processedAt: job.processedAt,
      ...job.processingMetadata
    }
  };
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = startOfDay(date);
  start.setDate(start.getDate() + mondayOffset);
  return start;
};

const isInDateRange = (value: string | undefined, range: DateRangeFilter, now: Date) => {
  if (range === "all") {
    return true;
  }

  const date = value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }

  if (range === "today") {
    return date >= startOfDay(now);
  }

  if (range === "week") {
    return date >= startOfWeek(now);
  }

  if (range === "month") {
    return date >= new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return date < new Date(now.getFullYear(), now.getMonth(), 1);
};

const toOperationsJob = (job: JobRecord, previous?: Partial<OperationsJob>): OperationsJob => ({
  ...job,
  findings: previous?.findings ?? [],
  audit:
    previous?.audit ??
    [
      { at: job.createdAt, actor: "system", message: "Signal loaded from DynamoDB job" },
      { at: job.updatedAt, actor: "workflow", message: `Current signal state: ${signalStatusLabel(signalStatusForJobStatus(job.status))}` }
    ],
  steps: stepsForStatus(job.status),
  signal: signalFromJob(job),
  uploadTarget: previous?.uploadTarget,
  requestId: previous?.requestId,
  extraction: previous?.extraction
});

const initialJobs: OperationsJob[] = [
  toOperationsJob({
    id: "job_1001",
    documentType: "invoice",
    fileName: "dealer-invoice-0426.pdf",
    status: "completed",
    confidence: 0.94,
    createdAt: "2026-05-13T08:20:00.000Z",
    updatedAt: "2026-05-13T08:22:14.000Z",
    uploadedAt: "2026-05-13T08:20:00.000Z",
    processedAt: "2026-05-13T08:22:14.000Z",
    bucket: "docops360-dev-invoice-ingest-local",
    objectKey: "uploads/invoice/job_1001/dealer-invoice-0426.pdf",
    processingMetadata: {
      source: "device_upload",
      extractionStrategy: "metadata_only",
      extractionProvider: "metadata_only",
      intelligenceReadiness: "metadata_only",
      summary: "Document stored successfully. AI extraction is disabled.",
      phase: "completed"
    }
  }),
  toOperationsJob({
    id: "job_1002",
    documentType: "invoice",
    fileName: "parts-supplier-tax-invoice.pdf",
    status: "review_required",
    confidence: 0.71,
    createdAt: "2026-05-13T08:25:00.000Z",
    updatedAt: "2026-05-13T08:27:33.000Z",
    uploadedAt: "2026-05-13T08:25:00.000Z",
    bucket: "docops360-dev-invoice-ingest-local",
    objectKey: "uploads/invoice/job_1002/parts-supplier-tax-invoice.pdf",
    processingMetadata: {
      source: "device_upload",
      extractionStrategy: "metadata_only",
      extractionProvider: "metadata_only",
      intelligenceReadiness: "metadata_only",
      phase: "review_required"
    },
    failureReason: "Gross amount confidence below review threshold"
  }),
  toOperationsJob({
    id: "job_1003",
    documentType: "invoice",
    fileName: "charging-network-invoice.pdf",
    status: "processing",
    confidence: null,
    createdAt: "2026-05-13T08:33:00.000Z",
    updatedAt: "2026-05-13T08:34:10.000Z",
    uploadedAt: "2026-05-13T08:33:00.000Z",
    bucket: "docops360-dev-invoice-ingest-local",
    objectKey: "uploads/invoice/job_1003/charging-network-invoice.pdf",
    processingMetadata: {
      source: "device_upload",
      extractionStrategy: "metadata_only",
      extractionProvider: "metadata_only",
      intelligenceReadiness: "metadata_only",
      phase: "processing"
    }
  })
];

function App() {
  const [jobs, setJobs] = useState<OperationsJob[]>(initialJobs);
  const [view, setView] = useState<AppView>("assistant");
  const [goals, setGoals] = useState<UserGoal[]>(defaultGoals);
  const [goalHistory, setGoalHistory] = useState<Record<string, GoalHistoryItem[]>>(() => initialGoalHistory(defaultGoals));
  const [editingGoalId, setEditingGoalId] = useState<string | undefined>();
  const [goalDraft, setGoalDraft] = useState<GoalFormState>({
    title: "",
    category: "others",
    priority: "normal",
    status: "active",
    description: ""
  });
  const [newGoal, setNewGoal] = useState<GoalFormState>({
    title: "",
    category: "others",
    priority: "normal",
    status: "active",
    description: ""
  });
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [goalStatusFilter, setGoalStatusFilter] = useState<GoalStatusFilter>("active");
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    category: ""
  });
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [chatSearchTerm, setChatSearchTerm] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string | undefined>();
  const [projectPrompt, setProjectPrompt] = useState("");
  const [, setUploadStatus] = useState(`Ready for document upload (${getUploadMode()} mode)`);
  const [jobSource, setJobSource] = useState(isRealMode() ? "Live job read API" : "Local mock mode");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | undefined>();
  const [uploadNotice, setUploadNotice] = useState<{ message: string; tone: "success" | "error" | "neutral" }>();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [documentSearchTerm, setDocumentSearchTerm] = useState("");
  const [documentStatusFilter, setDocumentStatusFilter] = useState<StatusFilter>("all");
  const [documentDateRange, setDocumentDateRange] = useState<DateRangeFilter>("month");
  const [documentSourceFilter, setDocumentSourceFilter] = useState<ArchiveSourceFilter>("all");
  const [archiveNotice, setArchiveNotice] = useState<{ message: string; tone: "success" | "error" }>();
  const [deletingJobId, setDeletingJobId] = useState<string | undefined>();
  const uploadNoticeTimeout = useRef<number | undefined>();
  const assistantInputRef = useRef<HTMLInputElement>(null);
  const completed = jobs.filter((job) => job.status === "completed").length;
  const review = jobs.filter((job) => job.status === "review_required").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const attention = review + failed;
  const filteredSignals = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...jobs]
      .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
      .filter((job) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          job.signal.title.toLowerCase().includes(normalizedSearch) ||
          taskTitleForSignal(job).toLowerCase().includes(normalizedSearch) ||
          job.signal.summary.toLowerCase().includes(normalizedSearch) ||
          actionLabel(job.signal.recommendedAction).toLowerCase().includes(normalizedSearch) ||
          sourceLabel(job.signal.source).toLowerCase().includes(normalizedSearch) ||
          job.signal.signalId.toLowerCase().includes(normalizedSearch) ||
          (job.signal.linkedJobId?.toLowerCase().includes(normalizedSearch) ?? false);

        return matchesSearch;
      });
  }, [jobs, searchTerm]);
  const hasSearch = searchTerm.trim().length > 0;
  const visibleSignals = hasSearch ? filteredSignals.slice(0, 4) : [];
  const filteredDocuments = useMemo(() => {
    const normalizedSearch = documentSearchTerm.trim().toLowerCase();

    return [...jobs]
      .sort((first, second) => new Date(second.uploadedAt ?? second.createdAt).getTime() - new Date(first.uploadedAt ?? first.createdAt).getTime())
      .filter((job) => {
        const matchesSearch = normalizedSearch.length === 0 || job.fileName.toLowerCase().includes(normalizedSearch);
        const matchesStatus = documentStatusFilter === "all" || job.status === documentStatusFilter;
        const matchesDate = isInDateRange(job.uploadedAt ?? job.createdAt, documentDateRange, currentTime);
        const matchesSource = documentSourceFilter === "all" || documentSourceFilter === "device_upload";

        return matchesSearch && matchesStatus && matchesDate && matchesSource;
      });
  }, [currentTime, documentDateRange, documentSearchTerm, documentSourceFilter, documentStatusFilter, jobs]);
  const archiveGroups: Array<{ value: DateRangeFilter; label: string; helper: string }> = [
    { value: "today", label: "Today", helper: `${jobs.filter((job) => isInDateRange(job.uploadedAt ?? job.createdAt, "today", currentTime)).length}` },
    { value: "week", label: "This week", helper: `${jobs.filter((job) => isInDateRange(job.uploadedAt ?? job.createdAt, "week", currentTime)).length}` },
    { value: "month", label: "This month", helper: `${jobs.filter((job) => isInDateRange(job.uploadedAt ?? job.createdAt, "month", currentTime)).length}` },
    { value: "older", label: "Older", helper: `${jobs.filter((job) => isInDateRange(job.uploadedAt ?? job.createdAt, "older", currentTime)).length}` },
    { value: "all", label: "All", helper: `${jobs.length}` }
  ];
  const filteredGoals = useMemo(
    () =>
      goals.filter((goal) => {
        if (goalStatusFilter === "all") {
          return true;
        }

        return goal.status === goalStatusFilter;
      }),
    [goalStatusFilter, goals]
  );
  const selectedProject = projects.find((project) => project.projectId === selectedProjectId);
  const operationalBundles = useMemo(
    () =>
      jobs
        .map(recommendationBundleFromJob)
        .sort((first, second) => {
          const priorityDifference =
            priorityRank[second.recommendation.priority] - priorityRank[first.recommendation.priority];

          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          return (
            new Date(second.recommendation.createdAt).getTime() -
            new Date(first.recommendation.createdAt).getTime()
          );
        }),
    [jobs]
  );
  const recommendations = operationalBundles.map((bundle) => bundle.recommendation);
  const actionProposals = operationalBundles.map((bundle) => bundle.action);
  const pendingApprovals = operationalBundles
    .map((bundle) => bundle.approval)
    .filter((approval): approval is ApprovalItem => approval?.status === "pending");
  const reviewSuggestedCount = pendingApprovals.length;
  const projectChatSessions = selectedProject
    ? chatSessions.filter((session) => session.projectId === selectedProject.projectId)
    : [];
  const filteredChatSessions = chatSessions.filter((session) =>
    session.title.toLowerCase().includes(chatSearchTerm.trim().toLowerCase())
  );
  const importantRecommendations = recommendations.filter((recommendation) => recommendation.priority !== "normal");
  const nextImportantRecommendation = importantRecommendations[0];
  const operationalImpact: OperationalImpact = {
    documentsProcessed: completed,
    recommendationsGenerated: recommendations.length,
    actionsSuggested: actionProposals.length,
    itemsCompleted: recommendations.filter((recommendation) => recommendation.status === "completed").length + completed,
    attentionItems: attention,
    approvalsPending: 0,
    deadlinesDetected: 0,
    estimatedManualTimeSavedMinutes: Math.max(0, completed * 3 + actionProposals.length)
  };
  const nowMs = currentTime.getTime();
  const activityWindowCounts = {
    lastHour: jobs.filter((job) => nowMs - new Date(job.updatedAt).getTime() <= 60 * 60 * 1000).length,
    today: jobs.filter((job) => isInDateRange(job.updatedAt, "today", currentTime)).length,
    thisWeek: jobs.filter((job) => isInDateRange(job.updatedAt, "week", currentTime)).length,
    thisMonth: jobs.filter((job) => isInDateRange(job.updatedAt, "month", currentTime)).length
  };
  const auditSummaryItems = [
    { label: "Document uploaded", value: jobs.length },
    { label: "Processing completed", value: completed },
    { label: "Recommendation prepared", value: recommendations.length },
    { label: "Review suggested", value: reviewSuggestedCount }
  ];
  const latestAuditBundles = operationalBundles.slice(0, 5);

  const showUploadNotice = (message: string, tone: "success" | "error" | "neutral", duration = 4200) => {
    if (uploadNoticeTimeout.current) {
      window.clearTimeout(uploadNoticeTimeout.current);
    }

    setUploadNotice({ message, tone });
    uploadNoticeTimeout.current = window.setTimeout(() => {
      setUploadNotice(undefined);
      uploadNoticeTimeout.current = undefined;
    }, duration);
  };

  const mergeJobsFromApi = (jobRecords: JobRecord[]) => {
    setJobs((currentJobs) => {
      const byId = new Map(currentJobs.map((job) => [job.id, job]));
      const nextJobs = jobRecords.map((job) => toOperationsJob(job, byId.get(job.id)));
      return nextJobs.length > 0 ? nextJobs : currentJobs;
    });
    setJobSource("Live DynamoDB read API");
    setLastRefreshedAt(nowIso());
  };

  const refreshJobsFromApi = async () => {
    const response = await listJobsRequest();
    mergeJobsFromApi(response.data.jobs);
    return response.data.jobs;
  };

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(
    () => () => {
      if (uploadNoticeTimeout.current) {
        window.clearTimeout(uploadNoticeTimeout.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isProjectFormOpen && !isGoalFormOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProjectFormOpen(false);
        setIsGoalFormOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGoalFormOpen, isProjectFormOpen]);

  useEffect(() => {
    if (!isRealMode()) {
      return;
    }

    let cancelled = false;

    const loadJobs = async () => {
      try {
        const response = await listJobsRequest();
        if (cancelled) {
          return;
        }

        mergeJobsFromApi(response.data.jobs);
      } catch (error) {
        setJobSource("Local fallback until read API is deployed");
        setUploadStatus(
          error instanceof Error
            ? `Read API unavailable; using local fallback (${error.message})`
            : "Read API unavailable; using local fallback"
        );
      }
    };

    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  const pollJobUntilTerminal = async (jobId: string) => {
    if (!isRealMode()) {
      return;
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const response = await getJobRequest(jobId);
      const updatedJob = response.data.job;

      setJobs((currentJobs) =>
        currentJobs.map((job) => (job.id === jobId ? toOperationsJob(updatedJob, job) : job))
      );
      setUploadStatus(
        updatedJob.status === "completed"
          ? "Document processed successfully."
          : updatedJob.status === "failed" || updatedJob.status === "review_required"
            ? "Document needs review."
            : "Document is being monitored."
      );

      if (isTerminalStatus(updatedJob.status)) {
        await refreshJobsFromApi();
        showUploadNotice("Saved to Archive", "success", 4200);
        return;
      }
    }

    setUploadStatus("Processing is still running. Refresh later to check the latest status.");
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const contentType = file.type || "application/pdf";
    setUploadStatus("Preparing upload...");

    try {
      const upload = await createUploadRequest({
        documentType: "invoice",
        fileName: file.name,
        contentType,
        sizeBytes: file.size
      });

      setUploadStatus("Uploading document...");
      await uploadFileToTarget(file, upload.data.uploadTarget.uploadUrl, contentType);
      showUploadNotice("Uploaded", "success", 1800);
      window.setTimeout(() => showUploadNotice("Processing", "neutral", 4200), 900);

      const uploadedAt = nowIso();
      const newJob = toOperationsJob(
        {
          ...upload.data.job,
          status: "queued",
          uploadedAt,
          updatedAt: uploadedAt,
          bucket: upload.data.uploadTarget.bucketName,
          objectKey: upload.data.uploadTarget.objectKey,
          processingMetadata: {
            source: "device_upload",
            extractionStrategy: "metadata_only",
            extractionProvider: "metadata_only",
            intelligenceReadiness: "metadata_only",
            phase: "queued"
          }
        },
        {
          ...upload.data.job,
          bucket: upload.data.uploadTarget.bucketName,
          objectKey: upload.data.uploadTarget.objectKey,
          findings: [],
          steps: stepsForStatus("queued"),
          uploadTarget: upload.data.uploadTarget,
          requestId: upload.requestId,
          audit: [
            { at: upload.data.job.createdAt, actor: "workflow", message: "Upload request created" },
            { at: uploadedAt, actor: "system", message: "File uploaded to S3 ingest bucket" },
            { at: uploadedAt, actor: "workflow", message: "Polling job status from DynamoDB" }
          ]
        }
      );

      setJobs((currentJobs) => [newJob, ...currentJobs.filter((job) => job.id !== newJob.id)]);
      setUploadStatus("Document uploaded. Monitoring processing.");
      void pollJobUntilTerminal(newJob.id);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
      showUploadNotice(error instanceof Error ? error.message : "Upload failed", "error", 6000);
    }

    event.target.value = "";
  };

  const primaryNavItems: Array<{ id: AppView; label: string; helper?: string }> = [
    { id: "documents", label: "Archive", helper: `${jobs.length}` }
  ];
  const contextNavItems: Array<{ id: AppView; label: string; helper?: string }> = [
    { id: "goals", label: "Goals", helper: `${goals.length} active` },
    { id: "sources", label: "Sources", helper: "Connectors" }
  ];
  const adminNavItems: Array<{ id: AppView; label: string; helper?: string }> = [
    { id: "developer", label: "Developer details", helper: "Demo" },
    { id: "system", label: "System console", helper: "Admin" }
  ];

  const renderNavSection = (
    label: string,
    items: Array<{ id: AppView; label: string; helper?: string }>
  ) => (
    <section className="sidebar-section" aria-label={label}>
      <p className="sidebar-section-label">{label}</p>
      <nav className="sidebar-nav" aria-label={`${label} navigation`}>
        {items.map((item) => (
          <button
            className={view === item.id ? "nav-item is-active" : "nav-item"}
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
          >
            <span>{item.label}</span>
            {item.helper ? <small>{item.helper}</small> : null}
          </button>
        ))}
      </nav>
    </section>
  );

  const handleNewChat = () => {
    const createdAt = nowIso();
    const session: ChatSession = {
      sessionId: `session_${Date.now()}`,
      title: "Untitled session",
      updatedAt: createdAt
    };

    setChatSessions((currentSessions) => [session, ...currentSessions]);
    setCurrentSessionTitle(session.title);
    setView("assistant");
    setSearchTerm("");
    window.setTimeout(() => assistantInputRef.current?.focus(), 50);
  };

  const handleCreateGoal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = newGoal.title.trim();
    if (!title) {
      return;
    }

    const goalId = `goal_manual_${Date.now()}`;
    setGoals((currentGoals) => [
      ...currentGoals,
      {
        goalId,
        title,
        category: newGoal.category,
        status: newGoal.status,
        priority: newGoal.priority,
        description: newGoal.description.trim() || "Local goal context for future assistant recommendations."
      }
    ]);
    setGoalHistory((currentHistory) => ({
      ...currentHistory,
      [goalId]: [goalHistoryItem("created", "Goal created locally.")]
    }));
    setNewGoal({
      title: "",
      category: "others",
      priority: "normal",
      status: "active",
      description: ""
    });
    setIsGoalFormOpen(false);
  };

  const startEditingGoal = (goal: UserGoal) => {
    setEditingGoalId(goal.goalId);
    setGoalDraft({
      title: goal.title,
      category: goal.category,
      priority: goal.priority,
      status: goal.status,
      description: goal.description
    });
  };

  const handleSaveGoal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingGoalId) {
      return;
    }

    const originalGoal = goals.find((goal) => goal.goalId === editingGoalId);
    const title = goalDraft.title.trim();
    if (!originalGoal || !title) {
      return;
    }

    const description = goalDraft.description.trim() || "Local goal context for future assistant recommendations.";
    const changes: GoalHistoryItem[] = [];

    if (originalGoal.title !== title || originalGoal.category !== goalDraft.category) {
      changes.push(goalHistoryItem("edited", "Goal title or category edited."));
    }

    if (originalGoal.priority !== goalDraft.priority) {
      changes.push(goalHistoryItem("priority_changed", `Priority changed from ${priorityView(originalGoal.priority).label} to ${priorityView(goalDraft.priority).label}.`));
    }

    if (originalGoal.description !== description) {
      changes.push(goalHistoryItem("notes_changed", "Notes / success criteria updated."));
    }

    if (originalGoal.status !== goalDraft.status) {
      changes.push(goalHistoryItem(goalDraft.status === "archived" ? "archived" : "edited", `Status changed to ${goalDraft.status}.`));
    }

    setGoals((currentGoals) =>
      currentGoals.map((goal) =>
        goal.goalId === editingGoalId
          ? {
              ...goal,
              title,
              category: goalDraft.category,
              priority: goalDraft.priority,
              status: goalDraft.status,
              description
            }
          : goal
      )
    );

    if (changes.length > 0) {
      setGoalHistory((currentHistory) => ({
        ...currentHistory,
        [editingGoalId]: [...(currentHistory[editingGoalId] ?? []), ...changes]
      }));
    }

    setEditingGoalId(undefined);
  };

  const archiveGoal = (goalId: string) => {
    setGoals((currentGoals) =>
      currentGoals.map((goal) => (goal.goalId === goalId ? { ...goal, status: "archived" } : goal))
    );
    setGoalHistory((currentHistory) => ({
      ...currentHistory,
      [goalId]: [...(currentHistory[goalId] ?? []), goalHistoryItem("archived", "Goal moved to archived.")]
    }));
  };

  const deleteGoal = (goalId: string) => {
    const goal = goals.find((item) => item.goalId === goalId);
    if (!goal || !window.confirm(`Delete goal "${goal.title}"? This is local-only for now.`)) {
      return;
    }

    setGoalHistory((currentHistory) => ({
      ...currentHistory,
      [goalId]: [...(currentHistory[goalId] ?? []), goalHistoryItem("deleted", "Goal deleted locally.")]
    }));
    setGoals((currentGoals) => currentGoals.filter((item) => item.goalId !== goalId));
    if (editingGoalId === goalId) {
      setEditingGoalId(undefined);
    }
  };

  const handleCreateProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = newProject.name.trim();
    if (!name) {
      return;
    }

    const projectId = `project_${Date.now()}`;
    setProjects((currentProjects) => [
      ...currentProjects,
      {
        projectId,
        name,
        description: newProject.description.trim() || undefined,
        category: newProject.category.trim() || undefined,
        archived: false,
        linkedSessionIds: []
      }
    ]);
    setSelectedProjectId(projectId);
    setView("project");
    setNewProject({ name: "", description: "", category: "" });
    setIsProjectFormOpen(false);
  };

  const handleCreateProjectChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    const createdAt = nowIso();
    const title = projectPrompt.trim() || `New chat in ${selectedProject.name}`;
    const session: ChatSession = {
      sessionId: `session_${Date.now()}`,
      title,
      updatedAt: createdAt,
      projectId: selectedProject.projectId
    };

    setChatSessions((currentSessions) => [session, ...currentSessions]);
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.projectId === selectedProject.projectId
          ? { ...project, linkedSessionIds: [session.sessionId, ...(project.linkedSessionIds ?? [])] }
          : project
      )
    );
    setCurrentSessionTitle(session.title);
    setProjectPrompt("");
  };

  const handleDeleteDocument = async (job: OperationsJob) => {
    if (!window.confirm("Delete this document from S3 and the archive record?")) {
      return;
    }

    setDeletingJobId(job.id);
    setArchiveNotice(undefined);

    try {
      await deleteJobRequest(job.id);
      setJobs((currentJobs) => currentJobs.filter((item) => item.id !== job.id));
      setArchiveNotice({ message: "Document deleted from archive.", tone: "success" });
    } catch (error) {
      setArchiveNotice({
        message: error instanceof Error ? error.message : "Delete failed.",
        tone: "error"
      });
    } finally {
      setDeletingJobId(undefined);
    }
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="DocOps360 navigation">
        <button className="brand brand-button" type="button" aria-label="DocOps360 assistant" onClick={() => setView("assistant")}>
          <span className="brand-mark">D360</span>
          <span>
            <strong>DocOps360</strong>
            <small>Personal Operations Intelligence</small>
          </span>
        </button>

	        <button
	          className="new-review-button"
	          type="button"
	          onClick={handleNewChat}
	        >
	          New chat
	        </button>

        <button className="sidebar-search" type="button" onClick={() => setIsChatSearchOpen((isOpen) => !isOpen)}>
          Search chats
        </button>
        {isChatSearchOpen ? (
          <section className="chat-search-panel" aria-label="Search chats">
            <input
              autoFocus
              placeholder="Search sessions..."
              type="search"
              value={chatSearchTerm}
              onChange={(event) => setChatSearchTerm(event.target.value)}
            />
            {filteredChatSessions.length > 0 ? (
              filteredChatSessions.map((session) => (
                <button className="chat-session-result" key={session.sessionId} type="button" onClick={() => setView("assistant")}>
                  <span>{session.title}</span>
                  <small>{formatDateTime(session.updatedAt)}</small>
                </button>
              ))
            ) : (
              <p>No saved chat sessions yet.</p>
            )}
          </section>
        ) : null}
        {uploadNotice ? <p className={`upload-notice ${uploadNotice.tone}`}>{uploadNotice.message}</p> : null}

        {renderNavSection("Primary", primaryNavItems)}
        {renderNavSection("Context", contextNavItems)}
        {renderNavSection("Demo/Admin", adminNavItems)}

	        <section className="sidebar-projects" aria-label="Projects">
	          <p className="sidebar-section-label">Projects</p>
	          <button className="project-item new-project-item" type="button" onClick={() => setIsProjectFormOpen(true)}>
	            New project
	          </button>
	          {projects.map((project) => (
	            <button
	              className={selectedProjectId === project.projectId && view === "project" ? "project-item is-active" : "project-item"}
	              key={project.projectId}
	              type="button"
	              onClick={() => {
	                setSelectedProjectId(project.projectId);
	                setView("project");
	              }}
	            >
	              <span>{project.name}</span>
	              {project.category ? <small>{project.category}</small> : null}
	            </button>
          ))}
          {projects.length === 0 && !isProjectFormOpen ? (
            <div className="project-placeholder">Create project folders for related chats and sessions.</div>
          ) : null}
        </section>

        <section className="sidebar-recent" aria-label="Recent sessions">
          <p className="sidebar-section-label">Recent</p>
          <div className="recent-placeholder">Recent sessions will appear here.</div>
        </section>

        <section className="account-menu" aria-label="User account menu">
          <details>
            <summary>User</summary>
            <button type="button">Profile</button>
            <button type="button">Settings</button>
            <button type="button">Help</button>
            <button disabled type="button">Logout</button>
          </details>
        </section>
	      </aside>

	      {isProjectFormOpen ? (
	        <div className="modal-backdrop" role="presentation" onClick={() => setIsProjectFormOpen(false)}>
	          <form
	            className="project-modal"
	            onClick={(event) => event.stopPropagation()}
	            onSubmit={handleCreateProject}
	            role="dialog"
	            aria-modal="true"
	            aria-labelledby="project-modal-title"
	          >
	            <button className="modal-close" type="button" aria-label="Close" onClick={() => setIsProjectFormOpen(false)}>
	              X
	            </button>
	            <div>
	              <h2 id="project-modal-title">Create project</h2>
	              <p>
	                Projects keep chats and sessions tidy. Documents and goals can link in later phases.
	              </p>
	            </div>
	            <label>
	              Project name
	              <input
	                autoFocus
	                placeholder="e.g. Copenhagen Trip"
	                value={newProject.name}
	                onChange={(event) => setNewProject((current) => ({ ...current, name: event.target.value }))}
	              />
	            </label>
	            <details className="advanced-fields">
	              <summary>Advanced</summary>
	              <label>
	                Short description
	                <textarea
	                  placeholder="Optional short description"
	                  value={newProject.description}
	                  onChange={(event) => setNewProject((current) => ({ ...current, description: event.target.value }))}
	                />
	              </label>
	              <label>
	                Category
	                <input
	                  placeholder="Optional category"
	                  value={newProject.category}
	                  onChange={(event) => setNewProject((current) => ({ ...current, category: event.target.value }))}
	                />
	              </label>
	            </details>
	            <button className="secondary-action" type="submit" disabled={newProject.name.trim().length === 0}>
	              Create project
	            </button>
	          </form>
	        </div>
	      ) : null}

	      {isGoalFormOpen ? (
	        <div className="modal-backdrop" role="presentation" onClick={() => setIsGoalFormOpen(false)}>
	          <form
	            className="project-modal"
	            onClick={(event) => event.stopPropagation()}
	            onSubmit={handleCreateGoal}
	            role="dialog"
	            aria-modal="true"
	            aria-labelledby="goal-modal-title"
	          >
	            <button className="modal-close" type="button" aria-label="Close" onClick={() => setIsGoalFormOpen(false)}>
	              X
	            </button>
	            <div>
	              <h2 id="goal-modal-title">Create goal</h2>
	              <p>Goals guide future document reviews, search, and recommendations.</p>
	            </div>
	            <label>
	              Goal name
	              <input
	                autoFocus
	                placeholder="e.g. Prepare for Germany trip"
	                value={newGoal.title}
	                onChange={(event) => setNewGoal((current) => ({ ...current, title: event.target.value }))}
	              />
	            </label>
	            <label>
	              Category
	              <select
	                value={newGoal.category}
	                onChange={(event) =>
	                  setNewGoal((current) => ({ ...current, category: event.target.value as UserGoal["category"] }))
	                }
	              >
	                <option value="family_admin">Family admin</option>
	                <option value="moving_travel">Travel</option>
	                <option value="bills_finance">Bills</option>
	                <option value="finance_investment">Finance / investment</option>
	                <option value="career">Work</option>
	                <option value="others">Others</option>
	                <option value="hobby">Hobby</option>
	                <option value="relationship">Relationship</option>
	              </select>
	            </label>
	            <label>
	              Priority
	              <select
	                value={newGoal.priority}
	                onChange={(event) =>
	                  setNewGoal((current) => ({ ...current, priority: event.target.value as SignalPriority }))
	                }
	              >
	                <option value="normal">Normal</option>
	                <option value="monitoring">Monitoring</option>
	                <option value="attention">Attention</option>
	                <option value="urgent">Urgent</option>
	              </select>
	            </label>
	            <label>
	              Status
	              <select
	                value={newGoal.status}
	                onChange={(event) => setNewGoal((current) => ({ ...current, status: event.target.value as UserGoal["status"] }))}
	              >
	                <option value="active">Active</option>
	                <option value="future">Future</option>
	                <option value="archived">Archived</option>
	              </select>
	            </label>
	            <label>
	              Notes / success criteria
	              <textarea
	                placeholder="What should the assistant understand about this goal?"
	                value={newGoal.description}
	                onChange={(event) => setNewGoal((current) => ({ ...current, description: event.target.value }))}
	              />
	            </label>
	            <div className="inline-actions">
	              <button className="secondary-action" type="submit" disabled={newGoal.title.trim().length === 0}>
	                Save goal
	              </button>
	              <button type="button" onClick={() => setIsGoalFormOpen(false)}>
	                Cancel
	              </button>
	            </div>
	          </form>
	        </div>
	      ) : null}

	      <section className="workspace">
        {view === "assistant" ? (
          <section className="top-summary-strip" aria-label="Today">
            <div>
              <strong>Today</strong>
              <span>{attention > 0 ? `${attention} item${attention === 1 ? "" : "s"} need attention` : "Nothing urgent right now."}</span>
            </div>
            <div>
              <strong>Suggested</strong>
              <span>{nextImportantRecommendation?.title ?? "Monitor processing status"}</span>
            </div>
            <dl>
              <div>
                <dt>Review</dt>
                <dd>{reviewSuggestedCount}</dd>
              </div>
              <div>
                <dt>Archive</dt>
                <dd>
                  <button className="inline-count-action" type="button" onClick={() => setView("documents")}>
                    {jobs.length}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Saved</dt>
                <dd>{operationalImpact.estimatedManualTimeSavedMinutes}m</dd>
              </div>
            </dl>
          </section>
        ) : null}

	        {view === "assistant" ? (
	          <section className="assistant-workspace" aria-labelledby="assistant-title">
            <div className="assistant-hero">
              <p className="eyebrow">DocOps360</p>
	              <h1 id="assistant-title">Personal Operations Intelligence</h1>
	              <p>
	                Ask about documents, decisions, deadlines, or next actions. AI is not connected yet; this is the workspace shell.
	              </p>
	              {currentSessionTitle ? <span className="session-pill">{currentSessionTitle}</span> : null}
	            </div>

            <div className="assistant-compose">
              <div className="assistant-input-shell">
                <label className="attachment-action" title="Upload document" aria-label="Upload document">
                  +
                  <input accept=".pdf,.png,.jpg,.jpeg,.tiff" type="file" onChange={handleUpload} />
                </label>
	                <input
	                  aria-label="Assistant prompt"
	                  ref={assistantInputRef}
	                  placeholder="Ask about your documents, decisions, deadlines, or next actions..."
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              {uploadNotice ? <p className={`upload-notice ${uploadNotice.tone}`}>{uploadNotice.message}</p> : null}
            </div>

            <div className="prompt-chips" aria-label="Example prompts">
              {[
                "What needs my attention today?",
                "Summarize my latest documents",
                "Show items needing review",
                "Find bills or invoices",
                "What should I review before making a decision?"
              ].map((prompt) => (
                <button className="prompt-chip" key={prompt} type="button" onClick={() => setSearchTerm(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            {hasSearch ? (
              <div className="search-results assistant-results">
                {visibleSignals.map((job) => {
                  const priority = priorityView(job.signal.priority);

                  return (
                    <article className="search-result" key={job.signal.signalId}>
                      <div>
                        <h3>{taskTitleForSignal(job)}</h3>
                        <p>{actionLabel(job.signal.recommendedAction)}</p>
                      </div>
                      <span className={`priority ${priority.className}`}>{priority.label}</span>
                      <span className={`status ${job.status}`}>{signalStatusLabel(job.signal.status)}</span>
                      <time>{formatTime(job.signal.updatedAt)}</time>
                    </article>
                  );
                })}
                {visibleSignals.length === 0 ? <p className="empty-state">No activity matches your search yet.</p> : null}
              </div>
            ) : null}

	          </section>
	        ) : null}

	        {view === "project" ? (
	          <section className="workspace-view project-workspace" aria-labelledby="project-title">
	            <p className="eyebrow">Project</p>
	            <h1 id="project-title">{selectedProject?.name ?? "Untitled project"}</h1>
	            <p className="hero-note">
	              Projects organize chats and sessions first. Files and goals can connect quietly in later phases.
	            </p>
	            <div className="project-view-tabs" aria-label="Project sections">
	              <button className="is-active" type="button">Chats</button>
	              <button type="button">Sources</button>
	            </div>
	            <form className="project-chat-panel panel" onSubmit={handleCreateProjectChat}>
	              <input
	                aria-label="Project chat prompt"
	                placeholder={`New chat in ${selectedProject?.name ?? "this project"}`}
	                value={projectPrompt}
	                onChange={(event) => setProjectPrompt(event.target.value)}
	              />
	              <button className="secondary-action" type="submit" disabled={!selectedProject}>
	                Start chat
	              </button>
	            </form>
	            <article className="project-simple-panel panel">
	              <div>
	                <h2>Recent chats</h2>
	                {selectedProject?.description ? <p>{selectedProject.description}</p> : null}
	              </div>
	              {projectChatSessions.length > 0 ? (
	                <div className="project-session-list">
	                  {projectChatSessions.map((session) => (
	                    <button className="chat-session-result" key={session.sessionId} type="button">
	                      <span>{session.title}</span>
	                      <small>{formatDateTime(session.updatedAt)}</small>
	                    </button>
	                  ))}
	                </div>
	              ) : (
	                <p className="empty-state">Chats in this project will appear here.</p>
	              )}
	            </article>
	          </section>
	        ) : null}

	        {view === "documents" ? (
          <section className="document-library workspace-view" aria-labelledby="library-title">
            <div className="library-header">
              <div>
                <p className="eyebrow">Archive</p>
                <h1 id="library-title">Document vault</h1>
                <p className="hero-note">
                  Stored evidence for device uploads and future connected sources. Technical storage details stay collapsed by default.
                </p>
              </div>
            </div>

            <section className="panel library-panel">
              <div className="archive-groups" aria-label="Archive groups">
                {archiveGroups.map((group) => (
                  <button
                    className={documentDateRange === group.value ? "is-active" : ""}
                    key={group.value}
                    type="button"
                    onClick={() => setDocumentDateRange(group.value)}
                  >
                    <span>{group.label}</span>
                    <small>{group.helper}</small>
                  </button>
                ))}
              </div>
	              <div className="library-controls" aria-label="Document filters">
                <label>
                  Search
                  <input
                    placeholder="Search by file name"
                    type="search"
                    value={documentSearchTerm}
                    onChange={(event) => setDocumentSearchTerm(event.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select value={documentStatusFilter} onChange={(event) => setDocumentStatusFilter(event.target.value as StatusFilter)}>
                    <option value="all">All statuses</option>
                    <option value="uploaded">Uploaded</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="review_required">Review required</option>
                    <option value="failed">Failed</option>
                  </select>
                </label>
                <label>
                  Source
                  <select
                    value={documentSourceFilter}
                    onChange={(event) => setDocumentSourceFilter(event.target.value as ArchiveSourceFilter)}
                  >
                    {archiveSourceOptions.map((source) => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date range
                  <select value={documentDateRange} onChange={(event) => setDocumentDateRange(event.target.value as DateRangeFilter)}>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="older">Older</option>
                    <option value="all">All documents</option>
                  </select>
	                </label>
	              </div>
	              {archiveNotice ? <p className={`archive-notice ${archiveNotice.tone}`}>{archiveNotice.message}</p> : null}

	              <div className="document-list">
                {filteredDocuments.map((job) => {
                  const priority = priorityView(job.signal.priority);
                  const metadata = job.signal.documentMetadata ?? documentMetadataFromJob(job);

                  return (
                    <article className="document-row" key={job.id}>
                      <div className="document-main">
                        <h3>{job.fileName}</h3>
                        <p>Source: Device upload</p>
                      </div>
                      <span>{job.documentType}</span>
                      <span className={`status ${job.status}`}>{job.status.replace("_", " ")}</span>
	                      <span className={`priority ${priority.className}`}>{priority.label}</span>
	                      <span>{formatDateTime(job.uploadedAt ?? job.createdAt)}</span>
	                      <span>{job.status.replace("_", " ")}</span>
	                      <button
	                        className="danger-action"
	                        type="button"
	                        disabled={deletingJobId === job.id}
	                        onClick={() => void handleDeleteDocument(job)}
	                      >
	                        {deletingJobId === job.id ? "Deleting..." : "Delete"}
	                      </button>
	                      <details className="document-details">
                        <summary>Technical details</summary>
                        <dl className="document-metadata">
                          <div>
                            <dt>Supplier</dt>
                            <dd>{metadata.supplier ?? "Pending extraction"}</dd>
                          </div>
                          <div>
                            <dt>Invoice number</dt>
                            <dd>{metadata.invoiceNumber ?? "Pending extraction"}</dd>
                          </div>
                          <div>
                            <dt>Total amount</dt>
                            <dd>{metadata.totalAmount ?? "Pending extraction"}</dd>
                          </div>
                          <div>
                            <dt>Due date</dt>
                            <dd>{metadata.dueDate ?? "Pending extraction"}</dd>
                          </div>
                          <div>
                            <dt>Document date</dt>
                            <dd>{metadata.documentDate ?? "Pending extraction"}</dd>
                          </div>
                          <div>
                            <dt>Extraction</dt>
                            <dd>Metadata-only processing is active. AI extraction is disabled.</dd>
                          </div>
                          <div>
                            <dt>Provider</dt>
                            <dd>{metadata.extractionProvider}</dd>
                          </div>
                          <div>
                            <dt>Confidence</dt>
                            <dd>{metadata.confidence ?? "Pending extraction"}</dd>
                          </div>
                          <div className="wide-field">
                            <dt>Bucket</dt>
                            <dd>{job.bucket}</dd>
                          </div>
                          <div className="wide-field">
                            <dt>Object key</dt>
                            <dd>{job.objectKey}</dd>
                          </div>
                        </dl>
                      </details>
                    </article>
                  );
                })}
                {filteredDocuments.length === 0 ? <p className="empty-state">No documents match the current filters.</p> : null}
              </div>
            </section>
          </section>
        ) : null}

        {view === "activity" ? (
          <section className="workspace-view" aria-labelledby="activity-title">
            <p className="eyebrow">Activity</p>
            <h1 id="activity-title">Activity</h1>
            <p className="hero-note">
              Current data flow from connected sources into the intelligence engine. Technical identifiers stay hidden unless opened.
            </p>
            <div className="activity-list">
              {operationalBundles.map((bundle) => (
                <article className="activity-card" key={bundle.recommendation.recommendationId}>
                  <div className="activity-card-header">
                    <div>
                      <h3>{taskTitleForSignal(bundle.job)}</h3>
                      <p>Source: Device upload</p>
                    </div>
                    <span className={`priority ${priorityView(bundle.recommendation.priority).className}`}>
                      {priorityView(bundle.recommendation.priority).label}
                    </span>
                  </div>
                  <ol className="activity-steps">
                    {activityItemsForBundle(bundle).map((item) => (
                      <li key={`${bundle.recommendation.recommendationId}-${item.title}`}>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                        <time>{formatTime(item.at)}</time>
                      </li>
                    ))}
                  </ol>
                  <details className="metadata-details">
                    <summary>Technical details</summary>
                    <dl className="metadata-grid">
                      <div>
                        <dt>Document</dt>
                        <dd>{bundle.job.fileName}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{bundle.job.status.replace("_", " ")}</dd>
                      </div>
                      <div>
                        <dt>Recommendation</dt>
                        <dd>{bundle.recommendation.recommendedAction}</dd>
                      </div>
                    </dl>
                  </details>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === "goals" ? (
          <section className="workspace-view" aria-labelledby="goals-title">
            <div className="view-header-row">
              <div>
                <p className="eyebrow">Context</p>
                <h1 id="goals-title">Goals</h1>
              </div>
              <button className="secondary-action" type="button" onClick={() => setIsGoalFormOpen((isOpen) => !isOpen)}>
                + Create goal
              </button>
	            </div>
	            <p className="hero-note">
	              Goals guide future document reviews, search, and recommendations.
	            </p>
	            <div className="goal-status-guide" aria-label="Goal status meaning">
	              <span><strong>Active</strong> used for intelligence</span>
	              <span><strong>Future</strong> saved but not active yet</span>
	              <span><strong>Archived</strong> retained but ignored by default</span>
	            </div>
	            <div className="goal-filter-tabs" aria-label="Goal filters">
	              {[
	                ["active", "Active"],
	                ["future", "Future"],
	                ["archived", "Archived"],
	                ["all", "All"]
	              ].map(([value, label]) => (
	                <button
	                  className={goalStatusFilter === value ? "is-active" : ""}
	                  key={value}
	                  type="button"
	                  onClick={() => setGoalStatusFilter(value as GoalStatusFilter)}
	                >
	                  {label}
	                </button>
	              ))}
	            </div>
	            <div className="goal-card-grid">
	              {filteredGoals.map((goal) => (
	                <article className="goal-card" key={goal.goalId}>
                  {editingGoalId === goal.goalId ? (
                    <form className="inline-edit-form" onSubmit={handleSaveGoal}>
                      <label>
                        Title
                        <input
                          value={goalDraft.title}
                          onChange={(event) => setGoalDraft((current) => ({ ...current, title: event.target.value }))}
                        />
                      </label>
                      <label>
                        Category
                        <select
                          value={goalDraft.category}
                          onChange={(event) =>
                            setGoalDraft((current) => ({ ...current, category: event.target.value as UserGoalCategory }))
                          }
                        >
                          <option value="family_admin">Family admin</option>
                          <option value="moving_travel">Travel</option>
                          <option value="bills_finance">Bills</option>
                          <option value="finance_investment">Finance / investment</option>
                          <option value="career">Work</option>
                          <option value="others">Others</option>
                          <option value="hobby">Hobby</option>
                          <option value="relationship">Relationship</option>
                        </select>
                      </label>
	                      <label>
	                        Priority
                        <select
                          value={goalDraft.priority}
                          onChange={(event) =>
                            setGoalDraft((current) => ({ ...current, priority: event.target.value as SignalPriority }))
                          }
                        >
                          <option value="normal">Normal</option>
                          <option value="monitoring">Monitoring</option>
                          <option value="attention">Attention</option>
                          <option value="urgent">Urgent</option>
	                        </select>
	                      </label>
	                      <label>
	                        Status
	                        <select
	                          value={goalDraft.status}
	                          onChange={(event) =>
	                            setGoalDraft((current) => ({ ...current, status: event.target.value as UserGoal["status"] }))
	                          }
	                        >
	                          <option value="active">Active</option>
	                          <option value="future">Future</option>
	                          <option value="archived">Archived</option>
	                        </select>
	                      </label>
	                      <label>
	                        Notes / success criteria
                        <textarea
                          value={goalDraft.description}
                          onChange={(event) => setGoalDraft((current) => ({ ...current, description: event.target.value }))}
                        />
                      </label>
                      <div className="inline-actions">
	                        <button className="secondary-action" type="submit">Save</button>
	                        <button type="button" onClick={() => setEditingGoalId(undefined)}>Cancel</button>
	                        <button className="danger-action" type="button" onClick={() => deleteGoal(goal.goalId)}>Delete</button>
	                      </div>
	                    </form>
                  ) : (
                    <>
                      <div className="goal-card-header">
                        <div>
                          <h3>{goal.title}</h3>
                          <small>{goalCategoryLabels[goal.category]}</small>
                        </div>
	                        <div className="inline-actions">
	                          <button type="button" onClick={() => startEditingGoal(goal)}>Edit</button>
	                          <button type="button" onClick={() => archiveGoal(goal.goalId)}>Archive</button>
	                          <button className="danger-action" type="button" onClick={() => deleteGoal(goal.goalId)}>Delete</button>
	                        </div>
	                      </div>
	                      <p>{goal.description}</p>
	                      <div className="goal-meta-row">
	                        <span className={`priority ${priorityView(goal.priority).className}`}>{priorityView(goal.priority).label}</span>
	                        <span className="status">{goal.status}</span>
	                        <time>Updated {formatDateTime((goalHistory[goal.goalId] ?? []).at(-1)?.at)}</time>
	                      </div>
	                    </>
	                  )}
                  <details className="goal-history">
                    <summary>Change history</summary>
                    <ol>
                      {(goalHistory[goal.goalId] ?? []).map((item) => (
                        <li key={item.historyId}>
                          <span>{item.message}</span>
                          <time>{formatDateTime(item.at)}</time>
                        </li>
                      ))}
                    </ol>
                  </details>
	                </article>
	              ))}
	              {filteredGoals.length === 0 ? <p className="empty-state">No goals in this view yet.</p> : null}
	            </div>
          </section>
        ) : null}

        {view === "sources" ? (
          <section className="workspace-view" aria-labelledby="sources-title">
            <p className="eyebrow">Sources</p>
            <h1 id="sources-title">Sources</h1>
            <p className="hero-note">
              Sources feed documents, events, and context into the intelligence engine. For now, only browser/device upload is active.
            </p>
            <div className="source-list panel">
              {intelligenceSources.map((source) => (
                <div className={source.status === "Active" ? "source-row is-active" : "source-row"} key={source.name}>
                  <span>{source.name}</span>
                  <small>{source.status}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {view === "system" ? (
          <section className="workspace-view system-console" aria-labelledby="system-title">
            <p className="eyebrow">Admin visibility</p>
            <h1 id="system-title">System console</h1>
            <p className="hero-note">
              UI-only operational visibility for demos and future admin use. It is derived from the current app state and does not connect directly to AWS monitoring yet.
            </p>

            <div className="system-grid">
              <article className="system-card">
                <h2>Runtime status</h2>
                <dl>
                  <div>
                    <dt>App mode</dt>
                    <dd>{getUploadMode()}</dd>
                  </div>
                  <div>
                    <dt>API status</dt>
                    <dd>{jobSource.includes("Live") ? "API connected" : "Fallback"}</dd>
                  </div>
                  <div>
                    <dt>Upload pipeline</dt>
                    <dd>Active</dd>
                  </div>
                  <div>
                    <dt>Archive delete</dt>
                    <dd>Active</dd>
                  </div>
	                  <div>
	                    <dt>Extraction strategy</dt>
	                    <dd>{EXTRACTION_STRATEGY}</dd>
	                  </div>
	                  <div>
	                    <dt>Bedrock</dt>
	                    <dd>Disabled</dd>
	                  </div>
                  <div>
                    <dt>MCP</dt>
                    <dd>Future-ready</dd>
                  </div>
                  <div>
                    <dt>Textract</dt>
                    <dd>Not used in MVP</dd>
                  </div>
                  <div>
                    <dt>Last refresh</dt>
                    <dd>{formatDateTime(lastRefreshedAt)}</dd>
                  </div>
                </dl>
              </article>

              <article className="system-card">
                <h2>Pipeline</h2>
                <dl>
                  <div>
                    <dt>Upload pipeline</dt>
                    <dd>Active presigned S3 upload</dd>
                  </div>
                  <div>
                    <dt>Archive documents</dt>
                    <dd>
                      <button className="inline-text-action" type="button" onClick={() => setView("documents")}>
                        {jobs.length} documents
                      </button>
                    </dd>
                  </div>
                  <div>
                    <dt>Signals</dt>
                    <dd>{jobs.length}</dd>
                  </div>
                  <div>
                    <dt>Goals</dt>
                    <dd>{goals.length}</dd>
                  </div>
                  <div>
                    <dt>Projects</dt>
                    <dd>{projects.length}</dd>
                  </div>
                  <div>
                    <dt>Review items</dt>
                    <dd>{reviewSuggestedCount} suggested</dd>
                  </div>
                  <div>
                    <dt>Sessions</dt>
                    <dd>{chatSessions.length}</dd>
                  </div>
                  <div>
                    <dt>Recommendations</dt>
                    <dd>{recommendations.length} prepared</dd>
                  </div>
                </dl>
              </article>

              <article className="system-card">
                <h2>Activity / Audit</h2>
                <div className="audit-window-grid" aria-label="Activity windows">
                  <span>Last hour <strong>{activityWindowCounts.lastHour}</strong></span>
                  <span>Today <strong>{activityWindowCounts.today}</strong></span>
                  <span>This week <strong>{activityWindowCounts.thisWeek}</strong></span>
                  <span>This month <strong>{activityWindowCounts.thisMonth}</strong></span>
                </div>
                <ul className="audit-summary-list">
                  {auditSummaryItems.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="system-card">
                <h2>Cost guardrails</h2>
                <dl>
                  <div>
                    <dt>Extraction strategy</dt>
                    <dd>{aiCostGuardrails.extractionStrategy}</dd>
                  </div>
                  <div>
                    <dt>Bedrock/Claude</dt>
                    <dd>{aiCostGuardrails.bedrockEnabled ? "Enabled" : "Disabled"}</dd>
                  </div>
                  <div>
                    <dt>Future model</dt>
                    <dd>{BEDROCK_MODEL_ID}</dd>
                  </div>
                  <div>
                    <dt>OpenAI</dt>
                    <dd>{aiCostGuardrails.openAiEnabled ? "Enabled" : "Disabled"}</dd>
                  </div>
                  <div>
                    <dt>Monthly AI budget</dt>
                    <dd>{aiCostGuardrails.monthlyBudgetLimit ? `${aiCostGuardrails.currency} ${aiCostGuardrails.monthlyBudgetLimit}` : "Not configured"}</dd>
                  </div>
                  <div>
                    <dt>Manual trigger required</dt>
                    <dd>{aiCostGuardrails.manualTriggerOnly ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Action-review layer</dt>
                    <dd>Future only</dd>
                  </div>
                </dl>
              </article>

              <article className="system-card">
                <h2>Future AWS visibility</h2>
                <ul className="system-placeholder-list">
                  {[
                    "CloudWatch logs",
                    "Lambda invocations",
                    "API Gateway requests",
                    "S3 object count",
                    "DynamoDB reads/writes"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <section className="panel audit-log-panel" aria-labelledby="audit-log-title">
              <h2 id="audit-log-title">Recent audit events</h2>
              <div className="activity-list compact">
                {latestAuditBundles.map((bundle) => (
                  <article className="activity-card" key={`system-${bundle.recommendation.recommendationId}`}>
                    <div className="activity-card-header">
                      <div>
                        <h3>{taskTitleForSignal(bundle.job)}</h3>
                        <p>Device upload source</p>
                      </div>
                      <span className={`priority ${priorityView(bundle.recommendation.priority).className}`}>
                        {priorityView(bundle.recommendation.priority).label}
                      </span>
                    </div>
                    <ol className="activity-steps">
                      {activityItemsForBundle(bundle).map((item) => (
                        <li key={`system-${bundle.recommendation.recommendationId}-${item.title}`}>
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                          <time>{formatTime(item.at)}</time>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {view === "developer" ? (
          <section className="workspace-view" aria-labelledby="developer-title">
            <p className="eyebrow">Developer details</p>
            <h1 id="developer-title">Technical architecture</h1>
            <p className="hero-note">
              Portfolio/demo view for the real upload pipeline, shared models, security posture, and future AI integration path.
            </p>
            <div className="pipeline panel">
              {pipelineStages.map((stage) => (
                <span key={stage}>
                  <i />
                  {stage}
                </span>
              ))}
            </div>
            <div className="developer-section-grid">
              <article className="system-card">
                <h2>Architecture flow</h2>
                <ul className="system-placeholder-list">
                  {[
                    "Browser app -> API Gateway -> Lambda",
                    "Lambda -> S3/DynamoDB",
                    "S3 event -> Worker Lambda -> DynamoDB",
                    "CloudWatch/IAM provide logs and access control"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="system-card">
                <h2>Current MVP</h2>
                <ul className="system-placeholder-list">
                  {[
                    "metadata_only extraction",
                    "No Textract",
                    "No Bedrock enabled",
                    "Upload/read/delete APIs active",
                    "Goals and projects stay local for now"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="system-card">
                <h2>Current deployed resources</h2>
                <ul className="system-placeholder-list">
                  {[
                    "API Gateway HTTP API",
                    "Upload Lambda",
                    "Processing worker Lambda",
                    "Jobs read Lambda",
                    "S3 archive bucket",
                    "DynamoDB jobs table",
                    "CloudWatch logs"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="system-card">
                <h2>Data model</h2>
                <ul className="system-placeholder-list">
                  {[
                    "JobRecord",
                    "SignalRecord",
                    "DocumentMetadata",
                    "ExtractionStrategy",
                    "ExtractedMetadata",
                    "EvidenceCitation",
                    "UserGoal",
                    "RecommendationRecord",
                    "ProjectRecord",
                    "ChatSession"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="system-card">
                <h2>Security design</h2>
                <ul className="system-placeholder-list">
                  {[
                    "Presigned S3 upload",
                    "Private bucket",
                    "Least-privilege IAM",
                    "No frontend AWS keys",
                    "Delete by jobId only",
                    "Confirmation for destructive actions",
                    "Technical metadata hidden from normal user view"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
	              <article className="system-card">
	                <h2>Future intelligence</h2>
                <ul className="system-placeholder-list">
                  {[
                    "ExtractionStrategy: metadata_only active",
                    "Bedrock Claude behind feature flag",
                    "Textract removed from MVP",
                    "MCP-ready internal tools later",
                    "Audit trail"
                  ].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
	                </ul>
	              </article>
	              <article className="system-card">
	                <h2>Future MCP tools</h2>
	                <ul className="system-placeholder-list">
	                  {[
	                    "search_archive",
	                    "get_document_metadata",
	                    "list_goals",
	                    "get_project_context",
	                    "summarize_recent_documents"
	                  ].map((item) => (
	                    <li key={item}>{item}</li>
	                  ))}
	                </ul>
	              </article>
	              <article className="system-card">
	                <h2>Delete flow / archive lifecycle</h2>
	                <ul className="system-placeholder-list">
	                  {[
	                    "DELETE /jobs/{jobId} prepared",
	                    "Lambda reads DynamoDB job first",
	                    "S3 delete uses stored bucket/object key only",
	                    "DynamoDB job record is removed after object delete",
	                    "Frontend requires confirmation before delete"
	                  ].map((item) => (
	                    <li key={item}>{item}</li>
	                  ))}
	                </ul>
	              </article>
	              <article className="system-card">
	                <h2>Goals / projects</h2>
	                <ul className="system-placeholder-list">
	                  {[
	                    "Goals provide prompt/context layer",
	                    "Projects group chats/sessions first",
	                    "Action-review layer can return later for agentic workflows",
	                    "Backend persistence deferred until UI is stable"
	                  ].map((item) => (
	                    <li key={item}>{item}</li>
	                  ))}
	                </ul>
	              </article>
	              <article className="system-card">
	                <h2>Guardrails</h2>
	                <ul className="system-placeholder-list">
	                  {[
	                    "No Textract in MVP",
	                    "No live Bedrock/Claude calls",
	                    "No auth or external connectors yet",
	                    "Manual review before sensitive actions",
	                    "Terraform apply required before Lambda runtime changes go live"
	                  ].map((item) => (
	                    <li key={item}>{item}</li>
	                  ))}
	                </ul>
	              </article>
	            </div>
            <div className="developer-metadata">
              <h2>Collapsed raw job metadata</h2>
              {jobs.slice(0, 5).map((job) => (
                <details className="metadata-details" key={job.id}>
                  <summary>{taskTitleForSignal(job)}</summary>
                  <dl className="metadata-grid">
                    <div>
                      <dt>Signal ID</dt>
                      <dd>{job.signal.signalId}</dd>
                    </div>
                    <div>
                      <dt>Linked job</dt>
                      <dd>{job.signal.linkedJobId}</dd>
                    </div>
                    {metadataEntries(job).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);

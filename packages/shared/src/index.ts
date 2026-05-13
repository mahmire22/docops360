export type DocumentType = "invoice" | "warranty_claim" | "service_report" | "dealer_document";

export type JobStatus =
  | "uploaded"
  | "queued"
  | "extracting"
  | "validating"
  | "review_required"
  | "completed"
  | "failed";

export interface DocumentJob {
  id: string;
  documentType: DocumentType;
  fileName: string;
  status: JobStatus;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
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
  name: "ingest" | "classify" | "extract" | "validate" | "review" | "persist";
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

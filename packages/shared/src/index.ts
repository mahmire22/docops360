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

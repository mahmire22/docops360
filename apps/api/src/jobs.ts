import type { ApiResponse, DocumentJob } from "@docops360/shared";

const mockJobs: DocumentJob[] = [
  {
    id: "job_1001",
    documentType: "invoice",
    fileName: "dealer-invoice-0426.pdf",
    status: "completed",
    confidence: 0.94,
    createdAt: "2026-05-13T08:20:00.000Z",
    updatedAt: "2026-05-13T08:22:14.000Z"
  },
  {
    id: "job_1002",
    documentType: "invoice",
    fileName: "parts-supplier-tax-invoice.pdf",
    status: "review_required",
    confidence: 0.71,
    createdAt: "2026-05-13T08:25:00.000Z",
    updatedAt: "2026-05-13T08:27:33.000Z",
    failureReason: "Gross amount confidence below review threshold"
  }
];

export const listJobs = (): ApiResponse<DocumentJob[]> => ({
  data: mockJobs,
  requestId: crypto.randomUUID()
});

export const getJob = (jobId: string): ApiResponse<DocumentJob | undefined> => ({
  data: mockJobs.find((job) => job.id === jobId),
  requestId: crypto.randomUUID()
});

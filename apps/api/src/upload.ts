import type { ApiResponse, CreateUploadRequest, CreateUploadResponse, JobRecord } from "@docops360/shared";

const documentBucketName = process.env.DOCOPS360_DOCUMENT_BUCKET ?? "docops360-dev-invoice-ingest-local";

const normaliseFileName = (fileName: string) =>
  fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");

const newRequestId = () => crypto.randomUUID();

export const createUpload = (request: CreateUploadRequest): ApiResponse<CreateUploadResponse> => {
  const now = new Date();
  const jobId = `job_${crypto.randomUUID()}`;
  const objectKey = `uploads/${request.documentType}/${jobId}/${normaliseFileName(request.fileName)}`;
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const job: JobRecord = {
    id: jobId,
    documentType: request.documentType,
    fileName: request.fileName,
    status: "uploaded",
    confidence: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    sourceBucket: documentBucketName,
    sourceObjectKey: objectKey
  };

  return {
    data: {
      job,
      uploadTarget: {
        method: "mock",
        bucketName: documentBucketName,
        objectKey,
        uploadUrl: `mock://s3/${documentBucketName}/${objectKey}`,
        expiresAt
      }
    },
    requestId: newRequestId()
  };
};

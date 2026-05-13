import type { ApiResponse, CreateUploadRequest, CreateUploadResponse } from "@docops360/shared";

const documentBucketName = "docops360-dev-invoice-ingest-local";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
const uploadMode = import.meta.env.VITE_UPLOAD_MODE ?? (apiBaseUrl ? "real" : "mock");

const normaliseFileName = (fileName: string) =>
  fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");

const createMockUploadRequest = async (
  request: CreateUploadRequest
): Promise<ApiResponse<CreateUploadResponse>> => {
  const now = new Date();
  const jobId = `job_${crypto.randomUUID()}`;
  const objectKey = `uploads/${request.documentType}/${jobId}/${normaliseFileName(request.fileName)}`;
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  return {
    data: {
      job: {
        id: jobId,
        documentType: request.documentType,
        fileName: request.fileName,
        status: "uploaded",
        confidence: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      uploadTarget: {
        method: "mock",
        bucketName: documentBucketName,
        objectKey,
        uploadUrl: `mock://s3/${documentBucketName}/${objectKey}`,
        expiresAt
      }
    },
    requestId: crypto.randomUUID()
  };
};

export const getUploadMode = () => uploadMode;

export const createUploadRequest = async (
  request: CreateUploadRequest
): Promise<ApiResponse<CreateUploadResponse>> => {
  if (uploadMode === "mock" || !apiBaseUrl) {
    return createMockUploadRequest(request);
  }

  const response = await fetch(`${apiBaseUrl}/uploads`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Upload request failed with ${response.status}: ${errorBody}`);
  }

  return response.json() as Promise<ApiResponse<CreateUploadResponse>>;
};

export const uploadFileToTarget = async (
  file: File,
  uploadUrl: string,
  contentType: string
): Promise<void> => {
  if (uploadUrl.startsWith("mock://")) {
    return;
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType
    },
    body: file
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed with ${response.status}: ${await response.text()}`);
  }
};

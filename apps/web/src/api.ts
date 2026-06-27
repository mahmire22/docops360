import type {
  ApiResponse,
  CreateGoalRequest,
  CreateUploadRequest,
  CreateGoalResponse,
  CreateUploadResponse,
  DeleteGoalResponse,
  DeleteJobResponse,
  GetJobResponse,
  JobRecord,
  ListGoalsResponse,
  UpdateGoalRequest,
  ListJobsResponse,
  UpdateGoalResponse
} from "@docops360/shared";

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

export const isRealMode = () => uploadMode !== "mock" && Boolean(apiBaseUrl);

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

export const listJobsRequest = async (): Promise<ApiResponse<ListJobsResponse>> => {
  if (!isRealMode()) {
    return {
      data: { jobs: [] },
      requestId: crypto.randomUUID()
    };
  }

  const response = await fetch(`${apiBaseUrl}/jobs`);
  if (!response.ok) {
    throw new Error(`List jobs failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<ListJobsResponse>>;
};

export const getJobRequest = async (jobId: string): Promise<ApiResponse<GetJobResponse>> => {
  if (!isRealMode()) {
    throw new Error("Job polling is disabled in mock mode.");
  }

  const response = await fetch(`${apiBaseUrl}/jobs/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    throw new Error(`Get job failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<GetJobResponse>>;
};

export const deleteJobRequest = async (jobId: string): Promise<ApiResponse<DeleteJobResponse>> => {
  if (!isRealMode()) {
    return {
      data: {
        jobId,
        deletedBucket: documentBucketName,
        deletedObjectKey: ""
      },
      requestId: crypto.randomUUID()
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      method: "DELETE"
    });
  } catch {
    throw new Error("Delete API is not deployed yet. Apply Terraform after review.");
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new Error("Delete API is not deployed yet. Apply Terraform after review.");
    }

    throw new Error(`Delete job failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<DeleteJobResponse>>;
};

export const listGoalsRequest = async (): Promise<ApiResponse<ListGoalsResponse>> => {
  if (!isRealMode()) {
    return {
      data: { goals: [] },
      requestId: crypto.randomUUID()
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/goals`);
  } catch {
    throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
    }

    throw new Error(`List goals failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<ListGoalsResponse>>;
};

export const createGoalRequest = async (
  request: CreateGoalRequest
): Promise<ApiResponse<CreateGoalResponse>> => {
  if (!isRealMode()) {
    const now = new Date().toISOString();
    return {
      data: {
        goal: {
          goalId: `goal_local_${crypto.randomUUID()}`,
          title: request.title,
          category: request.category ?? "others",
          status: request.status ?? "active",
          priority: request.priority ?? "normal",
          description: request.description ?? "",
          createdAt: now,
          updatedAt: now,
          archivedAt: request.status === "archived" ? now : undefined
        }
      },
      requestId: crypto.randomUUID()
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/goals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
  } catch {
    throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
    }

    throw new Error(`Create goal failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<CreateGoalResponse>>;
};

export const updateGoalRequest = async (
  goalId: string,
  request: UpdateGoalRequest
): Promise<ApiResponse<UpdateGoalResponse>> => {
  if (!isRealMode()) {
    const now = new Date().toISOString();
    return {
      data: {
        goal: {
          goalId,
          title: request.title ?? "Untitled goal",
          category: request.category ?? "others",
          status: request.status ?? "active",
          priority: request.priority ?? "normal",
          description: request.description ?? "",
          updatedAt: now,
          archivedAt: request.status === "archived" ? now : undefined
        }
      },
      requestId: crypto.randomUUID()
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/goals/${encodeURIComponent(goalId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request)
    });
  } catch {
    throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
    }

    throw new Error(`Update goal failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<UpdateGoalResponse>>;
};

export const deleteGoalRequest = async (goalId: string): Promise<ApiResponse<DeleteGoalResponse>> => {
  if (!isRealMode()) {
    return {
      data: { goalId },
      requestId: crypto.randomUUID()
    };
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/goals/${encodeURIComponent(goalId)}`, {
      method: "DELETE"
    });
  } catch {
    throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
  }

  if (!response.ok) {
    if (response.status === 404 || response.status === 405) {
      throw new Error("Goals API is not deployed yet. Apply Terraform after review.");
    }

    throw new Error(`Delete goal failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<ApiResponse<DeleteGoalResponse>>;
};

export const isTerminalStatus = (status: JobRecord["status"]) =>
  status === "completed" || status === "failed" || status === "review_required";

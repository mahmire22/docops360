import { DeleteItemCommand, DynamoDBClient, GetItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { ApiResponse, DeleteJobResponse, GetJobResponse, JobRecord, ListJobsResponse } from "@docops360/shared";

interface HttpApiEvent {
  routeKey?: string;
  pathParameters?: {
    jobId?: string;
  };
  requestContext?: {
    requestId?: string;
    http?: {
      method?: string;
      path?: string;
    };
  };
}

interface HttpApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const region = process.env.AWS_REGION ?? "us-east-1";
const jobsTableName = process.env.JOBS_TABLE_NAME;
const dynamodb = new DynamoDBClient({ region });
const s3 = new S3Client({ region });

const jsonHeaders = {
  "content-type": "application/json"
};

const response = (statusCode: number, body: unknown): HttpApiResponse => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body)
});

const requestIdFor = (event: HttpApiEvent) => event.requestContext?.requestId ?? crypto.randomUUID();

const toJobRecord = (item: Record<string, unknown>): JobRecord => ({
  id: String(item.jobId ?? item.id),
  documentType: item.documentType === "invoice" ? "invoice" : "dealer_document",
  fileName: String(item.fileName ?? "unknown-document"),
  status: typeof item.status === "string" ? (item.status as JobRecord["status"]) : "uploaded",
  confidence: typeof item.confidence === "number" ? item.confidence : null,
  createdAt: String(item.createdAt ?? item.uploadedAt ?? new Date(0).toISOString()),
  updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date(0).toISOString()),
  uploadedAt: item.uploadedAt ? String(item.uploadedAt) : undefined,
  processedAt: item.processedAt ? String(item.processedAt) : undefined,
  bucket: String(item.bucket ?? item.sourceBucket ?? ""),
  objectKey: String(item.objectKey ?? item.sourceObjectKey ?? ""),
  processingMetadata:
    item.processingMetadata && typeof item.processingMetadata === "object"
      ? (item.processingMetadata as JobRecord["processingMetadata"])
      : undefined,
  errorMessage: item.errorMessage ? String(item.errorMessage) : undefined,
  failureReason: item.failureReason ? String(item.failureReason) : undefined
});

const listJobs = async (): Promise<JobRecord[]> => {
  if (!jobsTableName) {
    throw new Error("JOBS_TABLE_NAME is required.");
  }

  const result = await dynamodb.send(
    new ScanCommand({
      TableName: jobsTableName,
      Limit: 50
    })
  );

  return (result.Items ?? [])
    .map((item) => toJobRecord(unmarshall(item)))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

const getJob = async (jobId: string): Promise<JobRecord | undefined> => {
  if (!jobsTableName) {
    throw new Error("JOBS_TABLE_NAME is required.");
  }

  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: jobsTableName,
      Key: {
        jobId: { S: jobId }
      }
    })
  );

  return result.Item ? toJobRecord(unmarshall(result.Item)) : undefined;
};

const deleteJob = async (job: JobRecord): Promise<DeleteJobResponse> => {
  if (!jobsTableName) {
    throw new Error("JOBS_TABLE_NAME is required.");
  }

  if (!job.bucket || !job.objectKey) {
    throw new Error("Job record is missing bucket or object key.");
  }

  if (!job.objectKey.startsWith("uploads/invoice/")) {
    throw new Error("Delete is only allowed for uploaded invoice objects.");
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: job.bucket,
      Key: job.objectKey
    })
  );

  await dynamodb.send(
    new DeleteItemCommand({
      TableName: jobsTableName,
      Key: {
        jobId: { S: job.id }
      }
    })
  );

  return {
    jobId: job.id,
    deletedBucket: job.bucket,
    deletedObjectKey: job.objectKey
  };
};

export const handler = async (event: HttpApiEvent): Promise<HttpApiResponse> => {
  const requestId = requestIdFor(event);

  try {
    const jobId = event.pathParameters?.jobId;

    console.log(
      JSON.stringify({
        level: "info",
        message: "Job read API request",
        requestId,
        routeKey: event.routeKey,
        jobId
      })
    );

    if (jobId) {
      const job = await getJob(jobId);
      if (!job) {
        return response(404, { message: "Job not found.", requestId });
      }

      if (event.requestContext?.http?.method === "DELETE") {
        console.log(
          JSON.stringify({
            level: "info",
            message: "Deleting job archive record and S3 object",
            requestId,
            jobId,
            objectKey: job.objectKey
          })
        );

        const body: ApiResponse<DeleteJobResponse> = {
          data: await deleteJob(job),
          requestId
        };

        return response(200, body);
      }

      const body: ApiResponse<GetJobResponse> = {
        data: { job },
        requestId
      };

      return response(200, body);
    }

    const body: ApiResponse<ListJobsResponse> = {
      data: {
        jobs: await listJobs()
      },
      requestId
    };

    return response(200, body);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Job read API failed",
        requestId,
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      })
    );

    return response(500, {
      message: error instanceof Error ? error.message : "Job read failed.",
      requestId
    });
  }
};

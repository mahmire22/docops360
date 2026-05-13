import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { CreateUploadRequest, CreateUploadResponse } from "@docops360/shared";

interface HttpApiEvent {
  body?: string | null;
  headers?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
  };
}

interface HttpApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const region = process.env.AWS_REGION ?? "us-east-1";
const documentBucketName = process.env.DOCUMENT_BUCKET_NAME;
const jobsTableName = process.env.JOBS_TABLE_NAME;
const uploadExpirySeconds = Number(process.env.UPLOAD_URL_EXPIRES_SECONDS ?? "600");

const s3 = new S3Client({ region });
const dynamodb = new DynamoDBClient({ region });

const jsonHeaders = {
  "content-type": "application/json"
};

const response = (statusCode: number, body: unknown): HttpApiResponse => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body)
});

const normaliseFileName = (fileName: string) =>
  fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-");

const parseRequest = (event: HttpApiEvent): CreateUploadRequest => {
  if (!event.body) {
    throw new Error("Request body is required.");
  }

  const parsed = JSON.parse(event.body) as Partial<CreateUploadRequest>;

  if (parsed.documentType !== "invoice") {
    throw new Error("Only invoice uploads are supported in this build slice.");
  }

  if (!parsed.fileName || !parsed.contentType || !parsed.sizeBytes) {
    throw new Error("fileName, contentType, and sizeBytes are required.");
  }

  if (parsed.sizeBytes > 10 * 1024 * 1024) {
    throw new Error("Maximum upload size is 10 MB for the dev environment.");
  }

  return {
    documentType: parsed.documentType,
    fileName: parsed.fileName,
    contentType: parsed.contentType,
    sizeBytes: parsed.sizeBytes
  };
};

export const handler = async (event: HttpApiEvent): Promise<HttpApiResponse> => {
  if (!documentBucketName || !jobsTableName) {
    return response(500, { message: "Upload handler is missing required environment configuration." });
  }

  try {
    const request = parseRequest(event);
    const now = new Date();
    const jobId = `job_${crypto.randomUUID()}`;
    const objectKey = `uploads/invoice/${jobId}/${normaliseFileName(request.fileName)}`;

    await dynamodb.send(
      new PutItemCommand({
        TableName: jobsTableName,
        Item: marshall({
          jobId,
          documentType: request.documentType,
          fileName: request.fileName,
          status: "uploaded",
          confidence: null,
          sourceBucket: documentBucketName,
          sourceObjectKey: objectKey,
          contentType: request.contentType,
          sizeBytes: request.sizeBytes,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
      })
    );

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: documentBucketName,
        Key: objectKey,
        ContentType: request.contentType,
        Metadata: {
          jobId,
          documentType: request.documentType
        }
      }),
      { expiresIn: uploadExpirySeconds }
    );

    const body: CreateUploadResponse = {
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
        method: "presigned_put",
        bucketName: documentBucketName,
        objectKey,
        uploadUrl,
        expiresAt: new Date(now.getTime() + uploadExpirySeconds * 1000).toISOString()
      }
    };

    return response(201, {
      data: body,
      requestId: event.requestContext?.requestId ?? crypto.randomUUID()
    });
  } catch (error) {
    return response(400, {
      message: error instanceof Error ? error.message : "Invalid upload request."
    });
  }
};

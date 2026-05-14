import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

interface S3EventRecord {
  eventTime: string;
  eventName: string;
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size?: number;
      eTag?: string;
    };
  };
}

interface S3Event {
  Records: S3EventRecord[];
}

const region = process.env.AWS_REGION ?? "us-east-1";
const jobsTableName = process.env.JOBS_TABLE_NAME;
const extractionStrategy = process.env.EXTRACTION_STRATEGY ?? "metadata_only";

const s3 = new S3Client({ region });
const dynamodb = new DynamoDBClient({ region });

const decodeS3Key = (key: string) => decodeURIComponent(key.replace(/\+/g, " "));

const parseJobIdFromKey = (objectKey: string) => {
  const parts = objectKey.split("/");
  if (parts.length < 4 || parts[0] !== "uploads" || parts[1] !== "invoice") {
    throw new Error(`Unsupported invoice object key: ${objectKey}`);
  }

  return parts[2];
};

const updateJobStatus = async (
  jobId: string,
  status: "queued" | "processing" | "completed" | "failed",
  values: Record<string, unknown>
) => {
  if (!jobsTableName) {
    throw new Error("JOBS_TABLE_NAME is required.");
  }

  const now = new Date().toISOString();

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: jobsTableName,
      Key: marshall({ jobId }),
      UpdateExpression:
        "SET #status = :status, updatedAt = :updatedAt, processingMetadata = :processingMetadata" +
        (values.processedAt ? ", processedAt = :processedAt" : "") +
        (values.errorMessage ? ", errorMessage = :errorMessage" : ""),
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: marshall(
        {
          ":status": status,
          ":updatedAt": now,
          ":processedAt": values.processedAt,
          ":errorMessage": values.errorMessage,
          ":processingMetadata": values.processingMetadata
        },
        { removeUndefinedValues: true }
      )
    })
  );
};

const processRecord = async (record: S3EventRecord) => {
  const bucket = record.s3.bucket.name;
  const objectKey = decodeS3Key(record.s3.object.key);
  const jobId = parseJobIdFromKey(objectKey);

  console.log(
    JSON.stringify({
      level: "info",
      message: "Invoice object received for processing",
      jobId,
      bucket,
      objectKey,
      eventName: record.eventName,
      eventTime: record.eventTime
    })
  );

  await updateJobStatus(jobId, "queued", {
    processingMetadata: {
      bucket,
      objectKey,
      phase: "queued",
      extractionStrategy,
      extractionProvider: "metadata_only",
      intelligenceReadiness: "metadata_only"
    }
  });

  await updateJobStatus(jobId, "processing", {
    processingMetadata: {
      bucket,
      objectKey,
      phase: "processing",
      extractionStrategy,
      extractionProvider: "metadata_only",
      summary: "Document stored successfully. AI extraction is disabled."
    }
  });

  const objectHead = await s3.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: objectKey
    })
  );

  const processedAt = new Date().toISOString();

  await updateJobStatus(jobId, "completed", {
    processedAt,
    processingMetadata: {
      bucket,
      objectKey,
      phase: "completed",
      contentLength: objectHead.ContentLength ?? record.s3.object.size ?? null,
      contentType: objectHead.ContentType ?? null,
      eTag: objectHead.ETag ?? record.s3.object.eTag ?? null,
      source: "device_upload",
      extractionStrategy,
      extractionProvider: "metadata_only",
      extractedTextAvailable: false,
      confidence: null,
      intelligenceReadiness: "metadata_only",
      summary: "Document stored successfully. AI extraction is disabled."
    }
  });

  console.log(
    JSON.stringify({
      level: "info",
      message: "Invoice object processing completed",
      jobId,
      bucket,
      objectKey,
      processedAt
    })
  );
};

export const handler = async (event: S3Event) => {
  const results = await Promise.allSettled(event.Records.map((record) => processRecord(record)));

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      const record = event.Records[index];
      const objectKey = decodeS3Key(record.s3.object.key);
      const jobId = objectKey.includes("/") ? objectKey.split("/")[2] : "unknown";
      const message = result.reason instanceof Error ? result.reason.message : "Unknown processing failure";

      console.error(
        JSON.stringify({
          level: "error",
          message: "Invoice object processing failed",
          jobId,
          bucket: record.s3.bucket.name,
          objectKey,
          errorMessage: message
        })
      );

      if (jobId !== "unknown") {
        await updateJobStatus(jobId, "failed", {
          errorMessage: message,
          processingMetadata: {
            phase: "failed",
            bucket: record.s3.bucket.name,
            objectKey
          }
        });
      }
    }
  }
};

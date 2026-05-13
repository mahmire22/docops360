import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AuditEvent, DocumentJob, InvoiceExtraction, JobRecord, ProcessingStep, UploadTarget, ValidationFinding } from "@docops360/shared";
import {
  createUploadRequest,
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
  uploadTarget?: UploadTarget;
  requestId?: string;
}

const lifecycleOrder: Array<ProcessingStep["name"]> = ["uploaded", "queued", "processing", "completed"];

const statusLabel = (status: DocumentJob["status"]) => status.replace("_", " ");

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

const toOperationsJob = (job: JobRecord, previous?: OperationsJob): OperationsJob => ({
  ...job,
  findings: previous?.findings ?? [],
  audit:
    previous?.audit ??
    [
      { at: job.createdAt, actor: "system", message: "Job loaded from DynamoDB" },
      { at: job.updatedAt, actor: "workflow", message: `Current lifecycle state: ${statusLabel(job.status)}` }
    ],
  steps: stepsForStatus(job.status),
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
      textractEnabled: false,
      textractSkipped: true,
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
      textractEnabled: false,
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
      textractEnabled: false,
      phase: "processing"
    }
  })
];

const formatTime = (value?: string) => (value ? new Date(value).toLocaleTimeString() : "Pending");

const metadataEntries = (job: OperationsJob) =>
  Object.entries(job.processingMetadata ?? {}).map(([key, value]) => [key, String(value)] as const);

function App() {
  const [jobs, setJobs] = useState<OperationsJob[]>(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState(initialJobs[0].id);
  const [uploadStatus, setUploadStatus] = useState(`Ready for invoice intake (${getUploadMode()} mode)`);
  const [jobSource, setJobSource] = useState(isRealMode() ? "Live job read API" : "Local mock mode");
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const completed = jobs.filter((job) => job.status === "completed").length;
  const review = jobs.filter((job) => job.status === "review_required").length;
  const processing = jobs.filter((job) => ["queued", "processing", "uploaded"].includes(job.status)).length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const averageConfidence = useMemo(() => {
    const scoredJobs = jobs.filter((job) => job.confidence !== null);
    if (scoredJobs.length === 0) {
      return "Pending";
    }

    const total = scoredJobs.reduce((sum, job) => sum + (job.confidence ?? 0), 0);
    return `${Math.round((total / scoredJobs.length) * 100)}%`;
  }, [jobs]);

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

        setJobs((currentJobs) => {
          const byId = new Map(currentJobs.map((job) => [job.id, job]));
          const nextJobs = response.data.jobs.map((job) => toOperationsJob(job, byId.get(job.id)));
          return nextJobs.length > 0 ? nextJobs : currentJobs;
        });
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
      setUploadStatus(`Job ${jobId} is ${statusLabel(updatedJob.status)}`);

      if (isTerminalStatus(updatedJob.status)) {
        return;
      }
    }

    setUploadStatus(`Polling paused for ${jobId}; refresh jobs to continue.`);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const contentType = file.type || "application/pdf";
    setUploadStatus("Creating upload request...");

    try {
      const upload = await createUploadRequest({
        documentType: "invoice",
        fileName: file.name,
        contentType,
        sizeBytes: file.size
      });

      setUploadStatus("Uploading file to ingest bucket...");
      await uploadFileToTarget(file, upload.data.uploadTarget.uploadUrl, contentType);

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
            textractEnabled: false,
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
      setSelectedJobId(newJob.id);
      setUploadStatus(`Uploaded invoice ${newJob.id}; waiting for worker`);
      void pollJobUntilTerminal(newJob.id);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
    }

    event.target.value = "";
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DocOps360</p>
          <h1>Document operations dashboard</h1>
          <p className="hero-note">{uploadStatus}</p>
        </div>
        <label className="upload-control">
          Upload invoice
          <input accept=".pdf,.png,.jpg,.jpeg,.tiff" type="file" onChange={handleUpload} />
        </label>
      </header>

      <section className="metrics" aria-label="Processing metrics">
        <article>
          <span>{jobs.length}</span>
          <p>Total jobs</p>
        </article>
        <article>
          <span>{completed}</span>
          <p>Completed</p>
        </article>
        <article>
          <span>{processing}</span>
          <p>Active</p>
        </article>
        <article>
          <span>{review}</span>
          <p>Needs review</p>
        </article>
        <article>
          <span>{failed}</span>
          <p>Failed</p>
        </article>
        <article>
          <span>{averageConfidence}</span>
          <p>Avg confidence</p>
        </article>
      </section>

      <div className="workspace-grid">
        <section className="panel" aria-labelledby="jobs-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Operations Queue</p>
              <h2 id="jobs-title">Invoice jobs</h2>
            </div>
            <p>{jobSource}</p>
          </div>

          <div className="job-list">
            {jobs.map((job) => (
              <button
                className={`job-row ${job.id === selectedJob.id ? "is-selected" : ""}`}
                key={job.id}
                type="button"
                onClick={() => setSelectedJobId(job.id)}
              >
                <div>
                  <h3>{job.fileName}</h3>
                  <p>{job.id}</p>
                </div>
                <span className={`status ${job.status}`}>{statusLabel(job.status)}</span>
                <span>{job.documentType}</span>
                <span>{formatTime(job.updatedAt)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel detail-panel" aria-labelledby="detail-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Job Detail</p>
              <h2 id="detail-title">{selectedJob.fileName}</h2>
            </div>
            <span className={`status ${selectedJob.status}`}>{statusLabel(selectedJob.status)}</span>
          </div>

          <div className="detail-section">
            <h3>Lifecycle</h3>
            <div className="timeline">
              {selectedJob.steps.map((step) => (
                <div className={`timeline-step ${step.status}`} key={`${selectedJob.id}-${step.name}`}>
                  <span>{step.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>Core fields</h3>
            <dl className="field-grid">
              <div>
                <dt>Job ID</dt>
                <dd>{selectedJob.id}</dd>
              </div>
              <div>
                <dt>Document type</dt>
                <dd>{selectedJob.documentType}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(selectedJob.status)}</dd>
              </div>
              <div>
                <dt>Textract</dt>
                <dd>{selectedJob.processingMetadata?.textractEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Uploaded</dt>
                <dd>{formatTime(selectedJob.uploadedAt)}</dd>
              </div>
              <div>
                <dt>Processed</dt>
                <dd>{formatTime(selectedJob.processedAt)}</dd>
              </div>
              <div className="wide-field">
                <dt>Bucket</dt>
                <dd>{selectedJob.bucket || selectedJob.uploadTarget?.bucketName || "Pending"}</dd>
              </div>
              <div className="wide-field">
                <dt>Object key</dt>
                <dd>{selectedJob.objectKey || selectedJob.uploadTarget?.objectKey || "Pending"}</dd>
              </div>
            </dl>
          </div>

          <div className="detail-section">
            <h3>Processing metadata</h3>
            {metadataEntries(selectedJob).length > 0 ? (
              <dl className="metadata-grid">
                {metadataEntries(selectedJob).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No processing metadata yet.</p>
            )}
          </div>

          <div className="detail-section">
            <h3>Upload status timeline</h3>
            <ol className="audit-list">
              {selectedJob.audit.map((event) => (
                <li key={`${event.at}-${event.message}`}>
                  <strong>{event.actor}</strong>
                  <span>{event.message}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);

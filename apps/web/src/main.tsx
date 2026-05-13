import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AuditEvent, DocumentJob, InvoiceExtraction, ProcessingStep, ValidationFinding } from "@docops360/shared";
import "./styles.css";

interface OperationsJob extends DocumentJob {
  extraction?: InvoiceExtraction;
  findings: ValidationFinding[];
  audit: AuditEvent[];
  steps: ProcessingStep[];
}

const initialJobs: OperationsJob[] = [
  {
    id: "job_1001",
    documentType: "invoice",
    fileName: "dealer-invoice-0426.pdf",
    status: "completed",
    confidence: 0.94,
    createdAt: "2026-05-13T08:20:00.000Z",
    updatedAt: "2026-05-13T08:22:14.000Z",
    extraction: {
      supplierName: "BYD Dealer Services NL",
      invoiceNumber: "INV-0426",
      invoiceDate: "2026-05-02",
      dueDate: "2026-06-01",
      currency: "EUR",
      netAmount: 1840,
      taxAmount: 386.4,
      grossAmount: 2226.4,
      confidence: 0.94
    },
    findings: [
      { field: "grossAmount", severity: "info", message: "Invoice total matched calculated net plus tax." }
    ],
    audit: [
      { at: "2026-05-13T08:20:00.000Z", actor: "user", message: "Document uploaded" },
      { at: "2026-05-13T08:20:08.000Z", actor: "workflow", message: "Queued extraction workflow" },
      { at: "2026-05-13T08:22:14.000Z", actor: "system", message: "Validated and stored invoice record" }
    ],
    steps: [
      { name: "ingest", status: "complete" },
      { name: "classify", status: "complete" },
      { name: "extract", status: "complete" },
      { name: "validate", status: "complete" },
      { name: "persist", status: "complete" }
    ]
  },
  {
    id: "job_1002",
    documentType: "invoice",
    fileName: "parts-supplier-tax-invoice.pdf",
    status: "review_required",
    confidence: 0.71,
    createdAt: "2026-05-13T08:25:00.000Z",
    updatedAt: "2026-05-13T08:27:33.000Z",
    failureReason: "Gross amount confidence below review threshold",
    extraction: {
      supplierName: "Parts Supplier Europe",
      invoiceNumber: "PSE-77814",
      invoiceDate: "2026-05-06",
      dueDate: "2026-05-30",
      currency: "EUR",
      netAmount: 1260,
      taxAmount: 264.6,
      grossAmount: 1524.6,
      confidence: 0.71
    },
    findings: [
      { field: "grossAmount", severity: "warning", message: "Total was extracted with low confidence." },
      { field: "invoiceNumber", severity: "info", message: "Potential duplicate check returned no match." }
    ],
    audit: [
      { at: "2026-05-13T08:25:00.000Z", actor: "user", message: "Document uploaded" },
      { at: "2026-05-13T08:26:48.000Z", actor: "system", message: "Low confidence extraction detected" },
      { at: "2026-05-13T08:27:33.000Z", actor: "workflow", message: "Routed to human review queue" }
    ],
    steps: [
      { name: "ingest", status: "complete" },
      { name: "classify", status: "complete" },
      { name: "extract", status: "complete" },
      { name: "validate", status: "blocked" },
      { name: "review", status: "running" },
      { name: "persist", status: "pending" }
    ]
  },
  {
    id: "job_1003",
    documentType: "invoice",
    fileName: "charging-network-invoice.pdf",
    status: "extracting",
    confidence: null,
    createdAt: "2026-05-13T08:33:00.000Z",
    updatedAt: "2026-05-13T08:34:10.000Z",
    findings: [],
    audit: [
      { at: "2026-05-13T08:33:00.000Z", actor: "user", message: "Document uploaded" },
      { at: "2026-05-13T08:34:10.000Z", actor: "workflow", message: "Textract extraction in progress" }
    ],
    steps: [
      { name: "ingest", status: "complete" },
      { name: "classify", status: "complete" },
      { name: "extract", status: "running" },
      { name: "validate", status: "pending" },
      { name: "persist", status: "pending" }
    ]
  }
];

const statusLabel = (status: DocumentJob["status"]) => status.replace("_", " ");

function App() {
  const [jobs, setJobs] = useState<OperationsJob[]>(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState(initialJobs[1].id);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const completed = jobs.filter((job) => job.status === "completed").length;
  const review = jobs.filter((job) => job.status === "review_required").length;
  const processing = jobs.filter((job) => ["queued", "extracting", "validating"].includes(job.status)).length;
  const averageConfidence = useMemo(() => {
    const scoredJobs = jobs.filter((job) => job.confidence !== null);
    if (scoredJobs.length === 0) {
      return "Pending";
    }

    const total = scoredJobs.reduce((sum, job) => sum + (job.confidence ?? 0), 0);
    return `${Math.round((total / scoredJobs.length) * 100)}%`;
  }, [jobs]);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const now = new Date().toISOString();
    const newJob: OperationsJob = {
      id: `job_${Math.floor(1000 + Math.random() * 9000)}`,
      documentType: "invoice",
      fileName: file.name,
      status: "queued",
      confidence: null,
      createdAt: now,
      updatedAt: now,
      findings: [],
      audit: [
        { at: now, actor: "user", message: "Document selected in local dashboard" },
        { at: now, actor: "workflow", message: "Mock job queued for AWS ingestion pipeline" }
      ],
      steps: [
        { name: "ingest", status: "complete" },
        { name: "classify", status: "pending" },
        { name: "extract", status: "pending" },
        { name: "validate", status: "pending" },
        { name: "persist", status: "pending" }
      ]
    };

    setJobs((currentJobs) => [newJob, ...currentJobs]);
    setSelectedJobId(newJob.id);
    event.target.value = "";
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DocOps360</p>
          <h1>Intelligent document operations</h1>
        </div>
        <label className="upload-control">
          Upload document
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
          <p>Processing</p>
        </article>
        <article>
          <span>{review}</span>
          <p>Needs review</p>
        </article>
        <article>
          <span>{averageConfidence}</span>
          <p>Average confidence</p>
        </article>
      </section>

      <div className="workspace-grid">
        <section className="panel" aria-labelledby="jobs-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Operations Queue</p>
              <h2 id="jobs-title">Invoice processing jobs</h2>
            </div>
            <p>Mock data now, AWS pipeline next.</p>
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
                  <p>{job.id} | {job.documentType}</p>
                </div>
                <span className={`status ${job.status}`}>{statusLabel(job.status)}</span>
                <span>{job.confidence === null ? "Pending" : `${Math.round(job.confidence * 100)}% confidence`}</span>
                <span>{new Date(job.updatedAt).toLocaleTimeString()}</span>
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
            <h3>Workflow</h3>
            <div className="step-list">
              {selectedJob.steps.map((step) => (
                <span className={`step ${step.status}`} key={`${selectedJob.id}-${step.name}`}>
                  {step.name}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>Extracted invoice fields</h3>
            {selectedJob.extraction ? (
              <dl className="field-grid">
                <div>
                  <dt>Supplier</dt>
                  <dd>{selectedJob.extraction.supplierName}</dd>
                </div>
                <div>
                  <dt>Invoice number</dt>
                  <dd>{selectedJob.extraction.invoiceNumber}</dd>
                </div>
                <div>
                  <dt>Gross amount</dt>
                  <dd>{selectedJob.extraction.currency} {selectedJob.extraction.grossAmount?.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Due date</dt>
                  <dd>{selectedJob.extraction.dueDate}</dd>
                </div>
              </dl>
            ) : (
              <p>Extraction fields will appear when the workflow reaches validation.</p>
            )}
          </div>

          <div className="detail-section">
            <h3>Validation findings</h3>
            {selectedJob.findings.length > 0 ? (
              <ul className="finding-list">
                {selectedJob.findings.map((finding) => (
                  <li className={finding.severity} key={`${finding.field}-${finding.message}`}>
                    <strong>{finding.field}</strong>
                    <span>{finding.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No validation findings yet.</p>
            )}
          </div>

          <div className="detail-section">
            <h3>Audit trail</h3>
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

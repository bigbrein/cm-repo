"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import {
  FileText,
  PenLine,
  Trash2,
  UploadCloud,
  Loader2,
  CheckCircle2,
  MinusCircle,
  XCircle,
  Check,
} from "lucide-react";
import { EmployeePicker, type EmployeeOption, type EmployeeExtractionSuggestion } from "@/components/employee-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useUploadBatch, getUploadBatchItems, type BatchItem } from "@/components/upload-batch-context";

interface DocumentTypeOption {
  id: string;
  name: string;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB — files larger than this use chunked upload (FR-UPL-10)
const DEFAULT_VALID_PERIOD_MONTHS = 6;
// How long a successfully-uploaded item stays visible (showing "Saved as
// ...") before it's cleared from the queue on its own.
const AUTO_CLEAR_DELAY_MS = 4000;
// Fade-out duration for both auto-clear and manual removal — must match the
// Tailwind `duration-*` class applied to the item wrapper below.
const REMOVE_FADE_MS = 200;

function nowForDateTimeLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function UploadForm({ documentTypes }: { documentTypes: DocumentTypeOption[] }) {
  const { items, addItems, updateItem, removeItem } = useUploadBatch();
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSummary, setSubmitSummary] = useState<{ succeeded: number; failed: number } | null>(null);
  const [showDashboardPrompt, setShowDashboardPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pendingClearTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timeouts = pendingClearTimeoutsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  function defaultDocumentTypeId() {
    return documentTypes[0]?.id ?? "";
  }

  async function addFiles(fileList: FileList | File[]) {
    setShowDashboardPrompt(false);
    const files = Array.from(fileList);
    const newItems: BatchItem[] = files.map((file) => ({
      clientId: nanoid(),
      mode: "file",
      file,
      bodyHtml: "",
      employee: null,
      documentTypeId: defaultDocumentTypeId(),
      validPeriodMonths: DEFAULT_VALID_PERIOD_MONTHS,
      dateIssued: nowForDateTimeLocal(),
      status: "pending",
      extractionStatus: "extracting",
    }));
    addItems(newItems);

    // FR-UPL-5: fire-and-forget metadata extraction per file — pre-populates
    // the CM Type when a confident match is found, auto-selects the employee
    // when the document names someone who already exists in the system, and
    // otherwise surfaces a non-blocking "add employee" suggestion. Never
    // auto-saves anything to the database on its own; extractionStatus/
    // extractionOutcome exist purely to show the user what happened (or
    // didn't) rather than fields silently changing with no explanation.
    for (const item of newItems) {
      const finish = (outcome: "full" | "partial" | "none", patch: Partial<BatchItem> = {}) => {
        updateItem(item.clientId, (i) => {
          // Never clobber an employee the user already picked manually
          // while extraction was still running in the background.
          const { employee, employeeSuggestion, ...rest } = patch;
          const employeePatch = i.employee
            ? {}
            : {
                ...(employee !== undefined ? { employee } : {}),
                ...(employeeSuggestion !== undefined ? { employeeSuggestion } : {}),
              };
          return { extractionStatus: "done", extractionOutcome: outcome, ...rest, ...employeePatch };
        });
      };

      const formData = new FormData();
      formData.set("file", item.file!);
      fetch("/api/uploads/extract-metadata", { method: "POST", body: formData })
        .then((r) => r.json())
        .then(async (data) => {
          const suggestion = data?.suggestion as
            | {
                documentTypeCode: string | null;
                employee: EmployeeExtractionSuggestion | null;
                documentDetails: { dateIssued: string | null; validPeriodMonths: number | null } | null;
              }
            | undefined;
          if (!suggestion) {
            finish("none");
            return;
          }

          let documentTypeId: string | null = null;
          if (suggestion.documentTypeCode) {
            const code = suggestion.documentTypeCode;
            documentTypeId = documentTypes.find((dt) => dt.name.toUpperCase().startsWith(code.slice(0, 4)))?.id ?? null;
          }

          // Same best-effort pre-fill as CM Type above — only ever overwrites
          // the field's default, never something the user has already typed
          // over it (extraction resolves well before that's realistic).
          const details = suggestion.documentDetails;
          const detailsPatch: Partial<BatchItem> = {};
          if (details?.dateIssued) detailsPatch.dateIssued = `${details.dateIssued}T00:00`;
          if (details?.validPeriodMonths) detailsPatch.validPeriodMonths = details.validPeriodMonths;
          const hasDetails = Object.keys(detailsPatch).length > 0;

          const candidate = suggestion.employee;
          if (!candidate || (!candidate.fullName && !candidate.employeeId)) {
            finish(documentTypeId || hasDetails ? "partial" : "none", {
              ...(documentTypeId ? { documentTypeId } : {}),
              ...detailsPatch,
            });
            return;
          }

          // A real match auto-selects the employee (nothing is created —
          // it's exactly the same as picking them from search). Otherwise
          // this genuinely isn't in the system yet, which always leaves
          // something for the user to do, however complete the extracted
          // fields are.
          const q = candidate.employeeId ?? candidate.fullName!;
          const searchRes = await fetch(`/api/employees/search?q=${encodeURIComponent(q)}`).catch(() => null);
          const searchData = searchRes ? await searchRes.json().catch(() => null) : null;
          const match = ((searchData?.employees ?? []) as EmployeeOption[]).find(
            (e) =>
              (candidate.employeeId && e.employeeId.toLowerCase() === candidate.employeeId.toLowerCase()) ||
              (candidate.fullName && e.fullName.toLowerCase() === candidate.fullName.toLowerCase())
          );

          if (match) {
            finish(documentTypeId ? "full" : "partial", {
              ...(documentTypeId ? { documentTypeId } : {}),
              ...detailsPatch,
              employee: match,
            });
          } else {
            finish("partial", {
              ...(documentTypeId ? { documentTypeId } : {}),
              ...detailsPatch,
              employeeSuggestion: candidate,
            });
          }
        })
        .catch(() => finish("none"));
    }
  }

  function addRichTextItem() {
    setShowDashboardPrompt(false);
    addItems([
      {
        clientId: nanoid(),
        mode: "richtext",
        bodyHtml: "",
        employee: null,
        documentTypeId: defaultDocumentTypeId(),
        validPeriodMonths: DEFAULT_VALID_PERIOD_MONTHS,
        dateIssued: nowForDateTimeLocal(),
        status: "pending",
      },
    ]);
  }

  function handleClearAll() {
    if (items.length === 0) return;
    if (!window.confirm(`Remove all ${items.length} queued document${items.length === 1 ? "" : "s"}?`)) return;
    fadeOutAndRemove(items.map((i) => i.clientId));
  }

  async function uploadFileChunked(file: File): Promise<string> {
    const uploadId = nanoid();
    for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
      const chunk = file.slice(offset, offset + CHUNK_SIZE);
      const formData = new FormData();
      formData.set("uploadId", uploadId);
      formData.set("chunk", chunk);
      const res = await fetch("/api/uploads/chunk", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Chunk upload failed");
    }
    return uploadId;
  }

  // Shared submit core — used by the "upload all", "upload ready", and
  // per-item upload actions alike, so they all share the same session
  // grouping and status-tracking behavior. Doesn't validate completeness
  // itself; callers decide which items are eligible.
  async function submitItems(targetItems: BatchItem[]) {
    if (targetItems.length === 0) return;

    setSubmitting(true);
    setSubmitSummary(null);

    const sessionRes = await fetch("/api/uploads/session", { method: "POST" });
    const sessionData = await sessionRes.json().catch(() => ({}));
    const uploadSessionId: string | undefined = sessionData.uploadSessionId;

    let succeeded = 0;
    let failed = 0;
    const succeededClientIds: string[] = [];

    // FR-UPL-6: process and submit items in upload order.
    for (const item of targetItems) {
      updateItem(item.clientId, { status: "uploading" });
      try {
        const formData = new FormData();
        formData.set("employeeId", item.employee!.id);
        formData.set("documentTypeId", item.documentTypeId);
        formData.set("validPeriodMonths", String(item.validPeriodMonths));
        formData.set("dateIssued", new Date(item.dateIssued).toISOString());
        if (uploadSessionId) formData.set("uploadSessionId", uploadSessionId);

        if (item.mode === "richtext") {
          formData.set("bodyHtml", item.bodyHtml);
        } else if (item.file) {
          if (item.file.size > CHUNK_SIZE) {
            const tempUploadId = await uploadFileChunked(item.file);
            formData.set("tempUploadId", tempUploadId);
            formData.set("fileName", item.file.name);
            formData.set("fileMimeType", item.file.type || "application/octet-stream");
          } else {
            formData.set("file", item.file);
          }
        }

        const res = await fetch("/api/uploads/items", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");

        updateItem(item.clientId, { status: "done", resultDocumentName: data.document?.documentName });
        succeeded++;
        succeededClientIds.push(item.clientId);
      } catch (error) {
        updateItem(item.clientId, {
          status: "error",
          errorMessage: error instanceof Error ? error.message : "Upload failed",
        });
        failed++;
      }
    }

    setSubmitSummary({ succeeded, failed });
    setSubmitting(false);

    // Successfully-uploaded items clear themselves out of the queue on
    // their own after a short delay — long enough to see the "Saved as
    // ..." confirmation. Anything that failed stays put for the user to
    // retry. Once the queue empties out as a result, prompt to head to the
    // dashboard rather than silently leaving an empty upload page.
    if (succeededClientIds.length > 0) {
      const timeoutId = setTimeout(() => {
        succeededClientIds.forEach((clientId) => updateItem(clientId, { removing: true }));
        const fadeTimeoutId = setTimeout(() => {
          succeededClientIds.forEach((clientId) => removeItem(clientId));
          if (getUploadBatchItems().length === 0) {
            setShowDashboardPrompt(true);
          }
        }, REMOVE_FADE_MS);
        pendingClearTimeoutsRef.current.push(fadeTimeoutId);
      }, AUTO_CLEAR_DELAY_MS);
      pendingClearTimeoutsRef.current.push(timeoutId);
    }
  }

  // Shared by the per-item trash button and "Clear all" — marks the item(s)
  // as removing so the fade-out transition plays, then drops them from the
  // queue once it's finished.
  function fadeOutAndRemove(clientIds: string[]) {
    clientIds.forEach((clientId) => updateItem(clientId, { removing: true }));
    const timeoutId = setTimeout(() => {
      clientIds.forEach((clientId) => removeItem(clientId));
    }, REMOVE_FADE_MS);
    pendingClearTimeoutsRef.current.push(timeoutId);
  }

  async function submitBatch() {
    const invalid = items.find((i) => !i.employee || !i.documentTypeId || !i.validPeriodMonths || !i.dateIssued);
    if (invalid) {
      updateItem(invalid.clientId, { status: "error", errorMessage: "Please complete all required fields." });
      return;
    }
    await submitItems(items);
  }

  // Submits only the items that are already fully filled in, leaving
  // anything still incomplete untouched in the queue — lets a reviewer push
  // finished CMs through without waiting on the rest of the batch.
  async function submitReadyItems() {
    await submitItems(items.filter(isReadyToSubmit));
  }

  const readyCount = items.filter(isReadyToSubmit).length;

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-primary bg-surface-muted" : "border-border"
        }`}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Drag and drop CM documents here, or</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Choose files
          </button>
          <button
            type="button"
            onClick={addRichTextItem}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-1.5 text-sm font-medium hover:bg-surface-muted"
          >
            <PenLine className="h-3.5 w-3.5" />
            Compose letter instead
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html,application/rtf,text/rtf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {showDashboardPrompt ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            All documents uploaded successfully. View them on the dashboard?
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDashboardPrompt(false)}
              className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-medium hover:bg-emerald-100 dark:border-emerald-800 dark:hover:bg-emerald-900"
            >
              Stay here
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
            >
              Go to dashboard
            </button>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm font-medium text-muted-foreground hover:underline"
              >
                + Add more files
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleClearAll}
                className="text-sm font-medium text-muted-foreground hover:text-red-600 hover:underline disabled:opacity-50"
              >
                Clear all
              </button>
            </div>

            {/* On the right, away from "Clear all" on the left — the
                per-item remove button (far below, at the bottom of each
                card) is the one kept clear of upload actions. */}
            <div className="flex items-center gap-2">
              {readyCount > 0 && readyCount < items.length ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitReadyItems}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
                >
                  Upload {readyCount} ready document{readyCount === 1 ? "" : "s"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={submitting}
                onClick={submitBatch}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Uploading...
                  </>
                ) : (
                  `Upload ${items.length} document${items.length === 1 ? "" : "s"}`
                )}
              </button>
            </div>
          </div>

          {items.map((item, index) => (
            <div
              key={item.clientId}
              className={`transition-opacity duration-200 ${
                item.removing ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <BatchItemCard
                index={index}
                item={item}
                documentTypes={documentTypes}
                submitting={submitting}
                onChange={(patch) => updateItem(item.clientId, patch)}
                onRemove={() => fadeOutAndRemove([item.clientId])}
                onUpload={() => submitItems([item])}
              />
            </div>
          ))}

          {submitSummary ? (
            <div
              className={`rounded-md px-4 py-3 text-sm ${
                submitSummary.failed === 0
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              {submitSummary.succeeded} uploaded successfully
              {submitSummary.failed > 0 ? `, ${submitSummary.failed} failed — see details above.` : "."}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BatchItemCard({
  index,
  item,
  documentTypes,
  submitting,
  onChange,
  onRemove,
  onUpload,
}: {
  index: number;
  item: BatchItem;
  documentTypes: DocumentTypeOption[];
  submitting: boolean;
  onChange: (patch: Partial<BatchItem>) => void;
  onRemove: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-muted text-xs text-muted-foreground">
            {index + 1}
          </span>
          {item.mode === "file" ? (
            <FileText className="h-4 w-4 text-muted-foreground" />
          ) : (
            <PenLine className="h-4 w-4 text-muted-foreground" />
          )}
          {item.mode === "file" ? item.file?.name : "Composed letter"}
          {item.mode === "file" ? <ExtractionIndicator item={item} /> : null}
          {item.status === "done" ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Saved as {item.resultDocumentName}
            </span>
          ) : null}
          {item.status === "uploading" ? <span className="text-xs text-muted-foreground">Uploading...</span> : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-red-600"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {item.errorMessage ? (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
          {item.errorMessage}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Employee</label>
          <div className="mt-1">
            <EmployeePicker
              value={item.employee}
              onChange={(employee) => onChange({ employee })}
              suggestion={item.employeeSuggestion}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">CM Type</label>
          <select
            value={item.documentTypeId}
            onChange={(e) => onChange({ documentTypeId: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {documentTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Valid Period (Months)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={item.validPeriodMonths}
            onChange={(e) => onChange({ validPeriodMonths: Number(e.target.value) })}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Date Issued</label>
          <input
            type="datetime-local"
            value={item.dateIssued}
            onChange={(e) => onChange({ dateIssued: e.target.value })}
            className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      {item.mode === "richtext" ? (
        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground">Letter content</label>
          <div className="mt-1">
            <RichTextEditor value={item.bodyHtml} onChange={(bodyHtml) => onChange({ bodyHtml })} />
          </div>
        </div>
      ) : null}

      {/* Deliberately far from the remove button above — a single click
          here should only ever upload this item, never risk landing on
          delete. */}
      {item.status !== "done" ? (
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <button
            type="button"
            disabled={submitting || !isReadyToSubmit(item)}
            onClick={onUpload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {item.status === "uploading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" aria-hidden />
            )}
            {item.status === "uploading" ? "Uploading..." : item.status === "error" ? "Retry upload" : "Upload this document"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Same required fields submitBatch checks — once these are all set (however
// they got set: extraction, a suggestion, or the user picking manually),
// the item is ready to submit.
function isItemComplete(item: BatchItem): boolean {
  return Boolean(item.employee && item.documentTypeId && item.validPeriodMonths && item.dateIssued);
}

// Complete, and not already mid-upload or already saved — what "Upload
// ready documents" and each item's own upload button actually submit.
function isReadyToSubmit(item: BatchItem): boolean {
  return isItemComplete(item) && item.status !== "done" && item.status !== "uploading";
}

// FR-UPL-5: visible feedback for the background extraction pass — a spinner
// while it's running, then a result indicator so the user knows how much
// (if anything) actually got auto-filled. Once every required field is
// actually filled in — whether that came from extraction or the user
// finishing the job by hand — this switches to a filled green tick showing
// the item is ready to submit, rather than staying frozen on whatever the
// extraction alone managed.
function ExtractionIndicator({ item }: { item: BatchItem }) {
  if (item.extractionStatus === "extracting") {
    return (
      <Loader2
        className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
        aria-label="Extracting details from document..."
      >
        <title>Extracting details from document...</title>
      </Loader2>
    );
  }

  if (isItemComplete(item)) {
    return (
      <span
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500"
        aria-label="Ready to submit"
      >
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        <title>All required fields are filled in — ready to submit</title>
      </span>
    );
  }

  if (item.extractionStatus !== "done" || !item.extractionOutcome) return null;

  if (item.extractionOutcome === "full") {
    return (
      <CheckCircle2
        className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
        aria-label="Auto-filled from document"
      >
        <title>Auto-filled from document — employee and CM type detected</title>
      </CheckCircle2>
    );
  }
  if (item.extractionOutcome === "partial") {
    return (
      <MinusCircle
        className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-label="Partially auto-filled"
      >
        <title>
          Partially auto-filled — some details couldn&apos;t be extracted, or the employee isn&apos;t in the system yet
        </title>
      </MinusCircle>
    );
  }
  return (
    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-label="Nothing auto-filled">
      <title>Couldn&apos;t auto-fill anything from this document — fill in the details below</title>
    </XCircle>
  );
}

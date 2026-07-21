"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DocumentTypeOption {
  id: string;
  name: string;
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function EditForm({
  documentId,
  documentTypes,
  initial,
  isCorrection,
}: {
  documentId: string;
  documentTypes: DocumentTypeOption[];
  initial: { documentTypeId: string; validPeriodMonths: number; dateIssued: string };
  isCorrection: boolean;
}) {
  const router = useRouter();
  const [documentTypeId, setDocumentTypeId] = useState(initial.documentTypeId);
  const [validPeriodMonths, setValidPeriodMonths] = useState(initial.validPeriodMonths);
  const [dateIssued, setDateIssued] = useState(toDateTimeLocal(initial.dateIssued));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTypeId,
          validPeriodMonths,
          dateIssued: new Date(dateIssued).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save changes");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-4">
      {isCorrection ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          The standard edit window has passed. Saving this will be recorded as an administrator correction (FR-REC-4).
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-medium text-muted-foreground">CM Type</label>
        <select
          value={documentTypeId}
          onChange={(e) => setDocumentTypeId(e.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-surface"
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
          value={validPeriodMonths}
          onChange={(e) => setValidPeriodMonths(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-surface"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Date Issued</label>
        <input
          type="datetime-local"
          value={dateIssued}
          onChange={(e) => setDateIssued(e.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-surface"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Expiry Date is recalculated automatically (Date Issued + Valid Period) — it isn&apos;t directly editable.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

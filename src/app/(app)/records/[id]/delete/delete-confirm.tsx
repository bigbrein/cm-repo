"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteConfirm({ documentId, documentName }: { documentId: string; documentName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete record");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 max-w-md space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        This removes <span className="font-mono">{documentName}</span> from the dashboard, search, and reports. The
        record and its audit trail are retained for compliance, but the action itself is permanent from a user
        perspective.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={handleDelete}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? "Deleting..." : "Delete record"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

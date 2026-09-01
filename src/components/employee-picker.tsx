"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, X, Loader2, Sparkles } from "lucide-react";

export interface EmployeeOption {
  id: string;
  employeeId: string;
  fullName: string;
  employmentStatus: "ACTIVE" | "TERMINATED" | "ON_LEAVE";
  department: { id: string; name: string; code: string };
}

// FR-UPL-5: candidate employee identity detected from the uploaded CM's own
// text (see lib/metadata-extraction.ts) when it doesn't match anyone
// already in the system. Every field is a best-effort suggestion only.
export interface EmployeeExtractionSuggestion {
  fullName: string | null;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}

// 3.2 SAP SuccessFactors Integration — FR-SF-1/2/6/7: employee lookup with
// type-ahead search, recently-selected surfacing, and a manual-entry
// fallback when SuccessFactors search can't find the employee.
export function EmployeePicker({
  value,
  onChange,
  suggestion,
}: {
  value: EmployeeOption | null;
  onChange: (employee: EmployeeOption | null) => void;
  suggestion?: EmployeeExtractionSuggestion | null;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EmployeeOption[]>([]);
  const [recent, setRecent] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/employees/recent")
      .then((r) => r.json())
      .then((data) => setRecent(data.employees ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/employees/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setResults(data.employees ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const listToShow = query.trim() ? results : recent.length > 0 ? recent : results;
  const hasSuggestion = Boolean(suggestion && (suggestion.fullName || suggestion.employeeId));

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-surface-muted px-3 py-2 text-sm">
        <div>
          <div className="font-medium">{value.fullName}</div>
          <div className="text-xs text-muted-foreground">
            ID {value.employeeId} · {value.department.name}
            {value.employmentStatus === "TERMINATED" ? (
              <span className="ml-1 font-semibold text-red-600 dark:text-red-400">· Terminated</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-1 text-muted-foreground hover:bg-surface-muted"
          aria-label="Clear selected employee"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or employee ID..."
          className="w-full rounded-md border border-border py-2 pl-8 pr-3 text-sm bg-surface"
        />
      </div>

      {open ? (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          {!query.trim() && recent.length > 0 ? (
            <div className="border-b border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recently selected
            </div>
          ) : null}
          <ul className="max-h-64 overflow-y-auto py-1">
            {loading ? <li className="px-3 py-2 text-sm text-muted-foreground">Searching...</li> : null}
            {!loading && listToShow.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No employees found.</li>
            ) : null}
            {listToShow.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(e);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-surface-muted"
                >
                  <span className="font-medium">{e.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    ID {e.employeeId} · {e.department.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border p-2">
            <button
              type="button"
              onClick={() => {
                setShowManualEntry(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Can&apos;t find them? Enter employee manually
            </button>
          </div>
        </div>
      ) : null}

      {/* FR-UPL-5: non-blocking suggestion — deliberately not a dialog, so it
          can't collide with dialogs from other items in the same batch.
          Only opens the (existing) manual-entry dialog on explicit click. */}
      {hasSuggestion && !open ? (
        <button
          type="button"
          onClick={() => setShowManualEntry(true)}
          className="mt-1.5 flex w-full items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-left text-xs hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            Detected from document:{" "}
            <span className="font-medium text-foreground">
              {[suggestion!.fullName, suggestion!.employeeId].filter(Boolean).join(" · ")}
            </span>
            {" — not in the system"}
          </span>
          <span className="shrink-0 font-medium text-primary">Add employee</span>
        </button>
      ) : null}

      {showManualEntry ? (
        <ManualEntryModal
          initial={hasSuggestion ? suggestion! : undefined}
          onClose={() => setShowManualEntry(false)}
          onCreated={(employee) => {
            onChange(employee);
            setShowManualEntry(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ManualEntryModal({
  initial,
  onClose,
  onCreated,
}: {
  initial?: EmployeeExtractionSuggestion;
  onClose: () => void;
  onCreated: (employee: EmployeeOption) => void;
}) {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data: { departments?: DepartmentOption[] }) => {
        const list = data.departments ?? [];
        setDepartments(list);
        // Best-effort match against the extracted department name — the
        // CM's own wording rarely matches a lookup value exactly, so this
        // is only ever a convenience; the user can still change it.
        if (initial?.department) {
          const needle = initial.department.trim().toLowerCase();
          const match = list.find(
            (d) => d.name.toLowerCase() === needle || d.name.toLowerCase().includes(needle) || needle.includes(d.name.toLowerCase())
          );
          if (match) setDepartmentId(match.id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { firstName: initialFirstName, lastName: initialLastName } = initial?.fullName
    ? splitFullName(initial.fullName)
    : { firstName: "", lastName: "" };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const body = {
      employeeId: String(formData.get("employeeId") ?? ""),
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      departmentId: String(formData.get("departmentId") ?? ""),
      email: String(formData.get("email") ?? ""),
      jobTitle: String(formData.get("jobTitle") ?? ""),
    };

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create employee");
        return;
      }
      onCreated({
        id: data.employee.id,
        employeeId: data.employee.employeeId,
        fullName: data.employee.fullName,
        employmentStatus: data.employee.employmentStatus,
        department: data.employee.department,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Manual employee entry</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {initial
            ? "Fields below were pre-filled from the uploaded document — check them and edit anything that's wrong before adding."
            : "Use this only when the employee can't be located via SuccessFactors search (FR-SF-7)."}
        </p>
        {error ? (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">First name</label>
              <input
                name="firstName"
                required
                defaultValue={initialFirstName}
                className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Last name</label>
              <input
                name="lastName"
                required
                defaultValue={initialLastName}
                className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Employee ID</label>
            <input
              name="employeeId"
              required
              defaultValue={initial?.employeeId ?? ""}
              className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Department</label>
            <select
              name="departmentId"
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"
            >
              <option value="">Select a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Job title (optional)</label>
            <input
              name="jobTitle"
              defaultValue={initial?.jobTitle ?? ""}
              className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Email (optional)</label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-sm bg-surface"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Adding...
                </>
              ) : (
                "Add employee"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

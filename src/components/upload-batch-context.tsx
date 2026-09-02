"use client";

import { useSyncExternalStore } from "react";
import type { EmployeeOption, EmployeeExtractionSuggestion } from "@/components/employee-picker";

export interface BatchItem {
  clientId: string;
  mode: "file" | "richtext";
  file?: File;
  bodyHtml: string;
  employee: EmployeeOption | null;
  employeeSuggestion?: EmployeeExtractionSuggestion | null;
  // FR-UPL-5: extraction is best-effort and runs in the background per file —
  // these track its progress/result so the user can see something is
  // happening, and how much of it actually worked, rather than fields
  // silently changing (or not) with no explanation.
  extractionStatus?: "extracting" | "done";
  extractionOutcome?: "full" | "partial" | "none";
  documentTypeId: string;
  validPeriodMonths: number;
  dateIssued: string; // datetime-local value
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
  resultDocumentName?: string;
}

// A plain module-level store rather than React Context: this app's Next.js
// version doesn't preserve component state across sibling-route navigation
// the way hoisting to a shared layout normally would (that requires the
// Cache Components flag, which is its own large migration — out of scope
// just for this). A module singleton survives regardless, since navigating
// between client-rendered routes doesn't re-evaluate the module — only a
// hard reload does, same as the File objects themselves.
let items: BatchItem[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return items;
}

function addItems(newItems: BatchItem[]) {
  items = [...items, ...newItems];
  notify();
}

function updateItem(clientId: string, patch: Partial<BatchItem> | ((prev: BatchItem) => Partial<BatchItem>)) {
  items = items.map((i) =>
    i.clientId === clientId ? { ...i, ...(typeof patch === "function" ? patch(i) : patch) } : i
  );
  notify();
}

function removeItem(clientId: string) {
  items = items.filter((i) => i.clientId !== clientId);
  notify();
}

function clearAll() {
  items = [];
  notify();
}

export function useUploadBatch() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { items: snapshot, addItems, updateItem, removeItem, clearAll };
}

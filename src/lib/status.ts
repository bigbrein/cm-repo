import { gte, lt, type SQL } from "drizzle-orm";
import { cmDocuments } from "@/db/schema";

// 3.5 Status Logic
// -----------------------------------------------------------------------
// FR-STAT-1/2/3: status is never stored, never user-editable — it is
// always derived from Expiry Date at query/render time (FR-STAT-4's
// "query-time calculation" option), so it can never drift out of sync.

export type CmStatus = "ACTIVE" | "EXPIRED";

export function getCmStatus(expiryDate: Date, asOf: Date = new Date()): CmStatus {
  return asOf.getTime() <= expiryDate.getTime() ? "ACTIVE" : "EXPIRED";
}

/** Drizzle `where` fragment for FR-SRCH-3 (filter by Active). */
export function activeStatusWhere(asOf: Date = new Date()): SQL {
  return gte(cmDocuments.expiryDate, asOf);
}

/** Drizzle `where` fragment for FR-SRCH-4 (filter by Expired). */
export function expiredStatusWhere(asOf: Date = new Date()): SQL {
  return lt(cmDocuments.expiryDate, asOf);
}

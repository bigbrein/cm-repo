import type { Prisma } from "@/generated/prisma/client";

// 3.5 Status Logic
// -----------------------------------------------------------------------
// FR-STAT-1/2/3: status is never stored, never user-editable — it is
// always derived from Expiry Date at query/render time (FR-STAT-4's
// "query-time calculation" option), so it can never drift out of sync.

export type CmStatus = "ACTIVE" | "EXPIRED";

export function getCmStatus(expiryDate: Date, asOf: Date = new Date()): CmStatus {
  return asOf.getTime() <= expiryDate.getTime() ? "ACTIVE" : "EXPIRED";
}

/** Prisma `where` fragment for FR-SRCH-3 (filter by Active). */
export function activeStatusWhere(asOf: Date = new Date()): Prisma.CmDocumentWhereInput {
  return { expiryDate: { gte: asOf } };
}

/** Prisma `where` fragment for FR-SRCH-4 (filter by Expired). */
export function expiredStatusWhere(asOf: Date = new Date()): Prisma.CmDocumentWhereInput {
  return { expiryDate: { lt: asOf } };
}

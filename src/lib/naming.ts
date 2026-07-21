import "server-only";
import { nanoid } from "nanoid";
import { addMonths } from "date-fns";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// 3.4 Document Metadata & Naming Convention
// -----------------------------------------------------------------------
// Format: CM-{EmployeeInitials}{EmployeeID}-{MMYY}{Sequence}
// Example: CM-JD12345-0526001  (FR-MD-2)

export function computeMonthKey(dateIssued: Date): string {
  const mm = String(dateIssued.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(dateIssued.getUTCFullYear() % 100).padStart(2, "0");
  return `${mm}${yy}`;
}

export function computeExpiryDate(dateIssued: Date, validPeriodMonths: number): Date {
  // BR-2: Expiry Date is always Date Issued + Valid Period (Months).
  return addMonths(dateIssued, validPeriodMonths);
}

/**
 * FR-MD-3 / 6.2: the per-month sequence counter is incremented with a
 * single atomic `INSERT ... ON CONFLICT ... DO UPDATE` statement. Postgres
 * guarantees this is race-free under concurrent callers without the
 * application needing to take an explicit row lock — two uploaders hitting
 * the same month simultaneously will always be handed distinct,
 * monotonically increasing values.
 */
async function nextSequenceForMonth(
  monthKey: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const rows = await client.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "DocumentSequence" ("monthKey", "lastValue")
    VALUES (${monthKey}, 1)
    ON CONFLICT ("monthKey")
    DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1
    RETURNING "lastValue"
  `;
  return rows[0]!.lastValue;
}

function formatDocumentName(initials: string, employeeId: string, monthKey: string, sequence: number): string {
  const paddedSequence = String(sequence).padStart(3, "0");
  return `CM-${initials}${employeeId}-${monthKey}${paddedSequence}`;
}

export interface DocumentIdentity {
  documentId: string;
  documentName: string;
}

/**
 * Generates the system Document ID (FR-MD-1) and the formatted Document
 * Name (FR-MD-2), retrying the sequence draw if the composed name somehow
 * collides with an existing record (FR-MD-4). A true collision should be
 * structurally impossible given the sequence is unique per month, but the
 * retry loop is kept as a defensive backstop.
 *
 * Must be called with a transaction client when used alongside the
 * CmDocument insert, so a failed insert doesn't leave the identity
 * "claimed" by a half-completed upload for longer than the transaction.
 */
export async function generateDocumentIdentity(
  client: Prisma.TransactionClient | typeof prisma,
  params: { initials: string; employeeId: string; dateIssued: Date }
): Promise<DocumentIdentity> {
  const monthKey = computeMonthKey(params.dateIssued);
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const sequence = await nextSequenceForMonth(monthKey, client);
    const documentName = formatDocumentName(params.initials, params.employeeId, monthKey, sequence);
    const existing = await client.cmDocument.findUnique({ where: { documentName }, select: { id: true } });
    if (!existing) {
      return { documentId: `DOC-${nanoid(10)}`, documentName };
    }
    // Defensive path only — see comment above.
  }

  throw new Error("Failed to generate a unique document name after multiple attempts");
}

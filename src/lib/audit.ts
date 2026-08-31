import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/db/schema";
import type { AuditAction } from "@/db/schema";

// 3.9 Audit Logging — append-only (FR-AUD-4 / BR-6).
//
// This is the *only* sanctioned write path to the AuditLog table. No other
// module should call `.update()` / `.delete()` on audit_log — those are
// intentionally never called anywhere in the codebase. There is nothing at
// the database level (yet) revoking UPDATE/DELETE from the app's Postgres
// role; enforcing that too is a follow-up (see README "Known limitations").

export interface WriteAuditLogInput {
  action: AuditAction;
  actorUserId?: string | null;
  actorEmail?: string | null;
  cmDocumentId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  await db.insert(auditLogs).values({
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    actorEmail: input.actorEmail ?? null,
    cmDocumentId: input.cmDocumentId ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? undefined,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

/** Best-effort request metadata extraction (FR-AUD-1: IP + user agent). */
export function requestMetadata(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]!.trim() : (request.headers.get("x-real-ip") ?? null);
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}

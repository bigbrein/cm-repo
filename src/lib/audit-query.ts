import "server-only";
import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users, cmDocuments } from "@/db/schema";
import type { AuditAction } from "@/db/schema";

export interface AuditLogQueryParams {
  action?: AuditAction;
  actorQuery?: string;
  from?: string; // ISO date
  to?: string; // ISO date
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 30;

// 3.9 Audit Logging — read path for the Administrator/Auditor viewer.
// AuditLog rows are never scoped by department: compliance/audit review
// intentionally spans the whole organization (see SRS §2.3, Auditor class).
export async function queryAuditLogs(params: AuditLogQueryParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  const where = and(
    params.action ? eq(auditLogs.action, params.action) : undefined,
    params.actorQuery ? ilike(auditLogs.actorEmail, `%${params.actorQuery}%`) : undefined,
    params.from ? gte(auditLogs.createdAt, new Date(params.from)) : undefined,
    params.to ? lte(auditLogs.createdAt, new Date(params.to)) : undefined
  );

  const [rawRows, [totalRow]] = await Promise.all([
    db
      .select({ auditLog: auditLogs, actor: { name: users.name, email: users.email }, cmDocument: { documentName: cmDocuments.documentName } })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .leftJoin(cmDocuments, eq(auditLogs.cmDocumentId, cmDocuments.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs).where(where),
  ]);

  const total = totalRow?.total ?? 0;
  const rows = rawRows.map((r) => ({
    ...r.auditLog,
    actor: r.actor?.name != null || r.actor?.email != null ? r.actor : null,
    cmDocument: r.cmDocument?.documentName != null ? r.cmDocument : null,
  }));

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

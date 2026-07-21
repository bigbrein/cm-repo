import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, AuditAction } from "@/generated/prisma/client";

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

  const where: Prisma.AuditLogWhereInput = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.actorQuery ? { actorEmail: { contains: params.actorQuery, mode: "insensitive" } } : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from ? { gte: new Date(params.from) } : {}),
            ...(params.to ? { lte: new Date(params.to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } }, cmDocument: { select: { documentName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

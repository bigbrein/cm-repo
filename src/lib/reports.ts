import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { cmDocumentScopeWhere } from "@/lib/cm-documents";
import { activeStatusWhere, expiredStatusWhere } from "@/lib/status";

// 3.10 Reporting & Analytics — every query here starts from the same
// department-scoped, non-deleted base `where` as the dashboard (FR-REP-8:
// reports respect the same RBAC/department restrictions).

function baseWhere(user: CurrentUser, departmentId?: string): Prisma.CmDocumentWhereInput {
  return {
    isDeleted: false,
    ...cmDocumentScopeWhere(user),
    ...(departmentId ? { employee: { departmentId } } : {}),
  };
}

const REPORT_ROW_LIMIT = 200;

/** FR-REP-1/2: Active or Expired CMs, org-wide or filtered by department. */
export async function getStatusReport(user: CurrentUser, status: "ACTIVE" | "EXPIRED", departmentId?: string) {
  return prisma.cmDocument.findMany({
    where: { ...baseWhere(user, departmentId), ...(status === "ACTIVE" ? activeStatusWhere() : expiredStatusWhere()) },
    include: { employee: { include: { department: true } }, documentType: true },
    orderBy: { dateIssued: "desc" },
    take: REPORT_ROW_LIMIT,
  });
}

/** FR-REP-6: CMs approaching expiry within a configurable window. */
export async function getExpiringSoonReport(user: CurrentUser, days: number, departmentId?: string) {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return prisma.cmDocument.findMany({
    where: { ...baseWhere(user, departmentId), expiryDate: { gte: now, lte: horizon } },
    include: { employee: { include: { department: true } }, documentType: true },
    orderBy: { expiryDate: "asc" },
    take: REPORT_ROW_LIMIT,
  });
}

/** FR-REP-3: CMs by Type breakdown. */
export async function getCountByType(user: CurrentUser, departmentId?: string) {
  const grouped = await prisma.cmDocument.groupBy({
    by: ["documentTypeId"],
    where: baseWhere(user, departmentId),
    _count: { _all: true },
  });
  const types = await prisma.documentType.findMany({ where: { id: { in: grouped.map((g) => g.documentTypeId) } } });
  const byId = new Map(types.map((t) => [t.id, t.name]));
  return grouped
    .map((g) => ({ label: byId.get(g.documentTypeId) ?? "Unknown", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

/**
 * FR-REP-4/5: CMs by Department and Documents Uploaded by User. Prisma's
 * groupBy can't group by a related record's field directly, and the
 * dataset size for an MVP doesn't warrant a raw SQL join — a bounded
 * select + in-memory tally is simpler and still fast at this scale.
 */
export async function getCountByDepartment(user: CurrentUser) {
  const docs = await prisma.cmDocument.findMany({
    where: baseWhere(user),
    select: { employee: { select: { department: { select: { name: true } } } } },
  });
  const counts = new Map<string, number>();
  for (const d of docs) counts.set(d.employee.department.name, (counts.get(d.employee.department.name) ?? 0) + 1);
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export async function getCountByUploader(user: CurrentUser, departmentId?: string) {
  const docs = await prisma.cmDocument.findMany({
    where: baseWhere(user, departmentId),
    select: { uploadedBy: { select: { name: true, email: true } } },
  });
  const counts = new Map<string, number>();
  for (const d of docs) {
    const label = d.uploadedBy.name || d.uploadedBy.email;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** FR-REP-7: Monthly Upload Trends over the trailing N months. */
export async function getMonthlyTrends(user: CurrentUser, monthsBack = 12, departmentId?: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const docs = await prisma.cmDocument.findMany({
    where: { ...baseWhere(user, departmentId), dateIssued: { gte: since } },
    select: { dateIssued: true },
  });

  const counts = new Map<string, number>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    counts.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const doc of docs) {
    const key = `${doc.dateIssued.getFullYear()}-${String(doc.dateIssued.getMonth() + 1).padStart(2, "0")}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts, ([month, count]) => ({ month, count }));
}

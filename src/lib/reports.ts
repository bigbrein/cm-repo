import "server-only";
import { and, asc, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmDocuments, employees, departments, documentTypes, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/session";
import { cmDocumentScopeWhere } from "@/lib/cm-documents";
import { activeStatusWhere, expiredStatusWhere } from "@/lib/status";

// 3.10 Reporting & Analytics — every query here starts from the same
// department-scoped, non-deleted base `where` as the dashboard (FR-REP-8:
// reports respect the same RBAC/department restrictions).

function baseWhere(user: CurrentUser, departmentId?: string) {
  return and(
    eq(cmDocuments.isDeleted, false),
    cmDocumentScopeWhere(user),
    departmentId ? eq(employees.departmentId, departmentId) : undefined
  );
}

const REPORT_ROW_LIMIT = 200;

function reportRowsQuery() {
  return db
    .select({ cmDocument: cmDocuments, employee: employees, department: departments, documentType: documentTypes })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(documentTypes, eq(cmDocuments.documentTypeId, documentTypes.id));
}

function toReportRow(r: Awaited<ReturnType<typeof reportRowsQuery>>[number]) {
  return { ...r.cmDocument, employee: { ...r.employee, department: r.department }, documentType: r.documentType };
}

/** FR-REP-1/2: Active or Expired CMs, org-wide or filtered by department. */
export async function getStatusReport(user: CurrentUser, status: "ACTIVE" | "EXPIRED", departmentId?: string) {
  const rows = await reportRowsQuery()
    .where(and(baseWhere(user, departmentId), status === "ACTIVE" ? activeStatusWhere() : expiredStatusWhere()))
    .orderBy(desc(cmDocuments.dateIssued))
    .limit(REPORT_ROW_LIMIT);
  return rows.map(toReportRow);
}

/** FR-REP-6: CMs approaching expiry within a configurable window. */
export async function getExpiringSoonReport(user: CurrentUser, days: number, departmentId?: string) {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const rows = await reportRowsQuery()
    .where(and(baseWhere(user, departmentId), gte(cmDocuments.expiryDate, now), lte(cmDocuments.expiryDate, horizon)))
    .orderBy(asc(cmDocuments.expiryDate))
    .limit(REPORT_ROW_LIMIT);
  return rows.map(toReportRow);
}

/** FR-REP-3: CMs by Type breakdown. */
export async function getCountByType(user: CurrentUser, departmentId?: string) {
  const grouped = await db
    .select({ label: documentTypes.name, count: count() })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .innerJoin(documentTypes, eq(cmDocuments.documentTypeId, documentTypes.id))
    .where(baseWhere(user, departmentId))
    .groupBy(documentTypes.id, documentTypes.name);
  return grouped.sort((a, b) => b.count - a.count);
}

/** FR-REP-4/5: CMs by Department and Documents Uploaded by User. */
export async function getCountByDepartment(user: CurrentUser) {
  const grouped = await db
    .select({ label: departments.name, count: count() })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .where(baseWhere(user))
    .groupBy(departments.id, departments.name);
  return grouped.sort((a, b) => b.count - a.count);
}

export async function getCountByUploader(user: CurrentUser, departmentId?: string) {
  const rows = await db
    .select({ name: users.name, email: users.email, count: count() })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .innerJoin(users, eq(cmDocuments.uploadedById, users.id))
    .where(baseWhere(user, departmentId))
    .groupBy(users.id, users.name, users.email);
  return rows
    .map((r) => ({ label: r.name || r.email, count: r.count }))
    .sort((a, b) => b.count - a.count);
}

/** FR-REP-7: Monthly Upload Trends over the trailing N months. */
export async function getMonthlyTrends(user: CurrentUser, monthsBack = 12, departmentId?: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const docs = await db
    .select({ dateIssued: cmDocuments.dateIssued })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .where(and(baseWhere(user, departmentId), gte(cmDocuments.dateIssued, since)));

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

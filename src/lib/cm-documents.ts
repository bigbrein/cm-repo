import "server-only";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmDocuments, employees, departments, documentTypes } from "@/db/schema";
import type { CurrentUser } from "@/lib/session";
import { activeStatusWhere, expiredStatusWhere } from "@/lib/status";

export type StatusFilter = "ACTIVE" | "EXPIRED" | "ALL";

export type SortColumn = "dateIssued" | "expiryDate" | "employeeName" | "employeeId" | "cmType" | "documentName";
export type SortDirection = "asc" | "desc";

export interface DashboardQueryParams {
  q?: string;
  status?: StatusFilter;
  sort?: SortColumn;
  direction?: SortDirection;
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * BR-7 / FR-AUTH-5: same department-scoping rule as employees.ts, applied
 * to CM Documents via the Employee relation.
 */
export function cmDocumentScopeWhere(user: CurrentUser) {
  if (user.permissions.isDepartmentScoped && user.departmentId) {
    return eq(employees.departmentId, user.departmentId);
  }
  return undefined;
}

function sortToOrderBy(sort: SortColumn | undefined, direction: SortDirection) {
  const dir = direction === "asc" ? asc : desc;
  switch (sort) {
    case "employeeName":
      return dir(employees.lastName);
    case "employeeId":
      return dir(employees.employeeId);
    case "cmType":
      return dir(documentTypes.name);
    case "documentName":
      return dir(cmDocuments.documentName);
    case "expiryDate":
      return dir(cmDocuments.expiryDate);
    case "dateIssued":
    default:
      return dir(cmDocuments.dateIssued); // FR-DASH-3 default
  }
}

/** FR-DASH-1/2/3 + 3.7 Search & Filtering, in one query builder shared by the dashboard and reports. */
export async function queryCmDocuments(user: CurrentUser, params: DashboardQueryParams) {
  const status = params.status ?? "ACTIVE"; // FR-DASH-1: Active by default
  const direction = params.direction ?? "desc"; // FR-DASH-3: Date Issued, descending
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const q = params.q?.trim();

  const statusWhere = status === "ACTIVE" ? activeStatusWhere() : status === "EXPIRED" ? expiredStatusWhere() : undefined;

  const searchWhere = q
    ? or(
        ilike(employees.fullName, `%${q}%`), // FR-SRCH-1
        ilike(employees.employeeId, `%${q}%`), // FR-SRCH-2
        ilike(cmDocuments.documentName, `%${q}%`),
        ilike(cmDocuments.documentId, `%${q}%`)
      )
    : undefined;

  const where = and(eq(cmDocuments.isDeleted, false), cmDocumentScopeWhere(user), statusWhere, searchWhere);

  const rowsQuery = db
    .select({ cmDocument: cmDocuments, employee: employees, department: departments, documentType: documentTypes })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(documentTypes, eq(cmDocuments.documentTypeId, documentTypes.id))
    .where(where)
    .orderBy(sortToOrderBy(params.sort, direction))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countQuery = db
    .select({ total: count() })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .where(where);

  const [rawRows, [totalRow]] = await Promise.all([rowsQuery, countQuery]);
  const total = totalRow?.total ?? 0;

  const rows = rawRows.map((r) => ({
    ...r.cmDocument,
    employee: { ...r.employee, department: r.department },
    documentType: r.documentType,
  }));

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

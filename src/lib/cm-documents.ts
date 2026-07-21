import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
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
export function cmDocumentScopeWhere(user: CurrentUser): Prisma.CmDocumentWhereInput {
  if (user.permissions.isDepartmentScoped && user.departmentId) {
    return { employee: { departmentId: user.departmentId } };
  }
  return {};
}

function sortToOrderBy(
  sort: SortColumn | undefined,
  direction: SortDirection
): Prisma.CmDocumentOrderByWithRelationInput {
  switch (sort) {
    case "employeeName":
      return { employee: { lastName: direction } };
    case "employeeId":
      return { employee: { employeeId: direction } };
    case "cmType":
      return { documentType: { name: direction } };
    case "documentName":
      return { documentName: direction };
    case "expiryDate":
      return { expiryDate: direction };
    case "dateIssued":
    default:
      return { dateIssued: direction }; // FR-DASH-3 default
  }
}

/** FR-DASH-1/2/3 + 3.7 Search & Filtering, in one query builder shared by the dashboard and reports. */
export async function queryCmDocuments(user: CurrentUser, params: DashboardQueryParams) {
  const status = params.status ?? "ACTIVE"; // FR-DASH-1: Active by default
  const direction = params.direction ?? "desc"; // FR-DASH-3: Date Issued, descending
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const q = params.q?.trim();

  const statusWhere: Prisma.CmDocumentWhereInput =
    status === "ACTIVE" ? activeStatusWhere() : status === "EXPIRED" ? expiredStatusWhere() : {};

  const searchWhere: Prisma.CmDocumentWhereInput = q
    ? {
        OR: [
          { employee: { fullName: { contains: q, mode: "insensitive" } } }, // FR-SRCH-1
          { employee: { employeeId: { contains: q, mode: "insensitive" } } }, // FR-SRCH-2
          { documentName: { contains: q, mode: "insensitive" } },
          { documentId: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.CmDocumentWhereInput = {
    isDeleted: false,
    ...cmDocumentScopeWhere(user),
    ...statusWhere,
    ...searchWhere,
  };

  const [rows, total] = await Promise.all([
    prisma.cmDocument.findMany({
      where,
      include: { employee: { include: { department: true } }, documentType: true },
      orderBy: sortToOrderBy(params.sort, direction),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cmDocument.count({ where }),
  ]);

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

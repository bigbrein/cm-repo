import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";

/**
 * BR-7 / FR-AUTH-5: department-scoped roles only ever see employees (and,
 * by extension, CM records) in their assigned department. Every employee
 * and CM-document query in the app should build its `where` through this
 * helper rather than querying Employee/CmDocument directly, so the scoping
 * rule can't be accidentally bypassed in one call site.
 */
export function employeeScopeWhere(user: CurrentUser): Prisma.EmployeeWhereInput {
  if (user.permissions.isDepartmentScoped && user.departmentId) {
    return { departmentId: user.departmentId };
  }
  return {};
}

/** FR-SF-6: type-ahead search, alphabetical default ordering. */
export async function searchEmployees(user: CurrentUser, query: string, limit = 20) {
  const trimmed = query.trim();
  return prisma.employee.findMany({
    where: {
      ...employeeScopeWhere(user),
      ...(trimmed
        ? {
            OR: [
              { fullName: { contains: trimmed, mode: "insensitive" } },
              { employeeId: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { department: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limit,
  });
}

/** FR-SF-6: surfacing of recently selected employees, scoped per-user. */
export async function getRecentEmployeesForUser(user: CurrentUser, limit = 5) {
  const recentDocs = await prisma.cmDocument.findMany({
    where: { uploadedById: user.id, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { employeeId: true },
  });

  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const doc of recentDocs) {
    if (!seen.has(doc.employeeId)) {
      seen.add(doc.employeeId);
      orderedIds.push(doc.employeeId);
    }
    if (orderedIds.length >= limit) break;
  }
  if (orderedIds.length === 0) return [];

  const employees = await prisma.employee.findMany({
    where: { id: { in: orderedIds }, ...employeeScopeWhere(user) },
    include: { department: true },
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  return orderedIds.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
}

/** FR-SF-7: manual entry fallback when an employee can't be found via SuccessFactors search. */
export async function createManualEmployee(input: {
  employeeId: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  email?: string | null;
  jobTitle?: string | null;
}) {
  const fullName = `${input.firstName} ${input.lastName}`;
  const initials = `${input.firstName[0] ?? ""}${input.lastName[0] ?? ""}`.toUpperCase();
  return prisma.employee.create({
    data: {
      employeeId: input.employeeId,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName,
      initials,
      email: input.email ?? null,
      jobTitle: input.jobTitle ?? null,
      departmentId: input.departmentId,
      employmentStatus: "ACTIVE",
      sourceSystem: "Manual",
      lastSyncedAt: new Date(),
    },
    include: { department: true },
  });
}

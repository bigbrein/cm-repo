import "server-only";
import { and, eq, or, ilike, inArray, desc, asc, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, departments, cmDocuments } from "@/db/schema";
import type { CurrentUser } from "@/lib/session";

/**
 * BR-7 / FR-AUTH-5: department-scoped roles only ever see employees (and,
 * by extension, CM records) in their assigned department. Every employee
 * and CM-document query in the app should build its `where` through this
 * helper rather than querying Employee/CmDocument directly, so the scoping
 * rule can't be accidentally bypassed in one call site.
 */
export function employeeScopeWhere(user: CurrentUser): SQL | undefined {
  if (user.permissions.isDepartmentScoped && user.departmentId) {
    return eq(employees.departmentId, user.departmentId);
  }
  return undefined;
}

/** FR-SF-6: type-ahead search, alphabetical default ordering. */
export async function searchEmployees(user: CurrentUser, query: string, limit = 20) {
  const trimmed = query.trim();
  const rows = await db
    .select({ employee: employees, department: departments })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(
      and(
        employeeScopeWhere(user),
        trimmed
          ? or(
              ilike(employees.fullName, `%${trimmed}%`),
              ilike(employees.employeeId, `%${trimmed}%`),
              ilike(employees.email, `%${trimmed}%`)
            )
          : undefined
      )
    )
    .orderBy(asc(employees.lastName), asc(employees.firstName))
    .limit(limit);
  return rows.map((r) => ({ ...r.employee, department: r.department! }));
}

/** FR-SF-6: surfacing of recently selected employees, scoped per-user. */
export async function getRecentEmployeesForUser(user: CurrentUser, limit = 5) {
  const recentDocs = await db
    .select({ employeeId: cmDocuments.employeeId })
    .from(cmDocuments)
    .where(and(eq(cmDocuments.uploadedById, user.id), eq(cmDocuments.isDeleted, false)))
    .orderBy(desc(cmDocuments.createdAt))
    .limit(50);

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

  const rows = await db
    .select({ employee: employees, department: departments })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(inArray(employees.id, orderedIds), employeeScopeWhere(user)));
  const byId = new Map(rows.map((r) => [r.employee.id, { ...r.employee, department: r.department! }]));
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
  const [employee] = await db
    .insert(employees)
    .values({
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
    })
    .returning();
  const [department] = await db.select().from(departments).where(eq(departments.id, input.departmentId)).limit(1);
  return { ...employee!, department: department! };
}

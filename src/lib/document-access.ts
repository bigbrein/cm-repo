import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cmDocuments, employees, departments, documentTypes } from "@/db/schema";
import type { CurrentUser } from "@/lib/session";

/**
 * NFR-SEC-2 / BR-7: shared department-scope + soft-delete check used by
 * every record-level route (download, edit, delete). Returns null for
 * both "doesn't exist" and "not in your scope" so unauthorized requests
 * can't distinguish the two (no existence leakage).
 */
export async function getAccessibleDocument(user: CurrentUser, documentId: string) {
  const [row] = await db
    .select({ cmDocument: cmDocuments, employee: employees, department: departments, documentType: documentTypes })
    .from(cmDocuments)
    .innerJoin(employees, eq(cmDocuments.employeeId, employees.id))
    .innerJoin(departments, eq(employees.departmentId, departments.id))
    .innerJoin(documentTypes, eq(cmDocuments.documentTypeId, documentTypes.id))
    .where(eq(cmDocuments.id, documentId))
    .limit(1);

  if (!row || row.cmDocument.isDeleted) return null;
  if (user.permissions.isDepartmentScoped && user.departmentId && row.employee.departmentId !== user.departmentId) {
    return null;
  }

  return { ...row.cmDocument, employee: { ...row.employee, department: row.department }, documentType: row.documentType };
}

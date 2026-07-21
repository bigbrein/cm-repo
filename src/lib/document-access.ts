import "server-only";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

/**
 * NFR-SEC-2 / BR-7: shared department-scope + soft-delete check used by
 * every record-level route (download, edit, delete). Returns null for
 * both "doesn't exist" and "not in your scope" so unauthorized requests
 * can't distinguish the two (no existence leakage).
 */
export async function getAccessibleDocument(user: CurrentUser, documentId: string) {
  const doc = await prisma.cmDocument.findUnique({
    where: { id: documentId },
    include: { employee: { include: { department: true } }, documentType: true },
  });

  if (!doc || doc.isDeleted) return null;
  if (user.permissions.isDepartmentScoped && user.departmentId && doc.employee.departmentId !== user.departmentId) {
    return null;
  }

  return doc;
}

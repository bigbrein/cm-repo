"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const UpdateUserSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMINISTRATOR", "HR_REVIEWER", "MANAGER_READONLY", "AUDITOR"]),
  departmentId: z.string().min(1).nullable(),
  isActive: z.boolean(),
});

// FR-AUTH-4/5: Administrator-only role & department-scoping management.
export async function updateUserAction(formData: FormData): Promise<void> {
  const actor = await requirePermission("canManageUsers");

  const parsed = UpdateUserSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return;

  const { userId, role, departmentId, isActive } = parsed.data;
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role, departmentId, isActive },
  });

  if (before.role !== role) {
    await writeAuditLog({
      action: "USER_ROLE_CHANGED",
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetType: "User",
      targetId: userId,
      metadata: { from: before.role, to: role },
    });
  }

  revalidatePath("/admin/users");
}

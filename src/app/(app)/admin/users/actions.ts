"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
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
  const [before] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!before) return;

  await db.update(users).set({ role, departmentId, isActive }).where(eq(users.id, userId));

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

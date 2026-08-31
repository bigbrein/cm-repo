"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, max } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { db } from "@/lib/db";
import { documentTypes } from "@/db/schema";

// FR-MD-7: CM Type is a configurable lookup list, not hard-coded, so new
// types can be added without a code change.

const CreateSchema = z.object({
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, or underscores"),
});

export async function createDocumentTypeAction(formData: FormData): Promise<void> {
  await requirePermission("canManageLookups");
  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
  });
  if (!parsed.success) return;

  const [{ maxSortOrder }] = await db.select({ maxSortOrder: max(documentTypes.sortOrder) }).from(documentTypes);
  await db.insert(documentTypes).values({
    name: parsed.data.name,
    code: parsed.data.code,
    sortOrder: (maxSortOrder ?? 0) + 1,
  });
  revalidatePath("/admin/document-types");
}

const ToggleSchema = z.object({
  id: z.string().min(1),
  isActive: z.enum(["true", "false"]),
});

// Explicit true/false hidden field rather than a checkbox — unchecked
// checkboxes simply don't appear in FormData, which would make "turn off"
// indistinguishable from "field omitted".
export async function toggleDocumentTypeAction(formData: FormData): Promise<void> {
  await requirePermission("canManageLookups");
  const parsed = ToggleSchema.safeParse({
    id: formData.get("id"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return;

  await db
    .update(documentTypes)
    .set({ isActive: parsed.data.isActive === "true" })
    .where(eq(documentTypes.id, parsed.data.id));
  revalidatePath("/admin/document-types");
}

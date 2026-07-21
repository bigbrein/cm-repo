"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";

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

  const maxSort = await prisma.documentType.aggregate({ _max: { sortOrder: true } });
  await prisma.documentType.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
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

  await prisma.documentType.update({
    where: { id: parsed.data.id },
    data: { isActive: parsed.data.isActive === "true" },
  });
  revalidatePath("/admin/document-types");
}

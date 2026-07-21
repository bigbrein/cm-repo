"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { syncEmployeesFromSuccessFactors } from "@/lib/successfactors/sync";

export async function triggerSyncAction(): Promise<void> {
  const user = await requirePermission("canManageIntegrations");
  await syncEmployeesFromSuccessFactors(user.id);
  revalidatePath("/admin/employees");
}

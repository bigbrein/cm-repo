import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AdminIndexPage() {
  const user = await getCurrentUser();
  if (user?.permissions.canManageIntegrations) redirect("/admin/employees");
  if (user?.permissions.canManageLookups) redirect("/admin/document-types");
  if (user?.permissions.canManageUsers) redirect("/admin/users");
  redirect("/dashboard");
}

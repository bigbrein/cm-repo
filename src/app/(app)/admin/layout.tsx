import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canAccessAdmin =
    user.permissions.canManageUsers || user.permissions.canManageLookups || user.permissions.canManageIntegrations;
  if (!canAccessAdmin) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        You don&apos;t have access to the Admin area.
      </div>
    );
  }

  const tabs = [
    { href: "/admin/employees", label: "Employees / SuccessFactors", show: user.permissions.canManageIntegrations },
    { href: "/admin/document-types", label: "CM Types", show: user.permissions.canManageLookups },
    { href: "/admin/users", label: "Users", show: user.permissions.canManageUsers },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold">Admin</h1>
      <nav className="mt-3 flex gap-1 border-b border-border">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted"
            >
              {t.label}
            </Link>
          ))}
      </nav>
      <div className="mt-4">{children}</div>
    </div>
  );
}

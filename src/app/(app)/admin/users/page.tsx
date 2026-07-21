import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import type { UserRole } from "@/generated/prisma/enums";
import { AccessDenied } from "@/components/access-denied";
import { updateUserAction } from "./actions";

const ROLES: UserRole[] = ["ADMINISTRATOR", "HR_REVIEWER", "MANAGER_READONLY", "AUDITOR"];

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canManageUsers) return <AccessDenied />;

  const [users, departments] = await Promise.all([
    prisma.user.findMany({ include: { department: true }, orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {/* Each row's inputs are associated with a standalone <form> via the
 `form` attribute rather than nesting <form> inside <tr>, which is
 invalid HTML (tr may only contain td/th) and gets silently
 mangled by the browser's parser. */}
      {users.map((u) => (
        <form key={u.id} id={`user-form-${u.id}`} action={updateUserAction} />
      ))}
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Department scope</th>
            <th className="px-4 py-2">Active</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => {
            const formId = `user-form-${u.id}`;
            return (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <input type="hidden" name="userId" value={u.id} form={formId} />
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-2">
                  <select
                    name="role"
                    form={formId}
                    defaultValue={u.role}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select
                    name="departmentId"
                    form={formId}
                    defaultValue={u.departmentId ?? ""}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
                  >
                    <option value="">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    form={formId}
                    defaultChecked={u.isActive}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    type="submit"
                    form={formId}
                    className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted"
                  >
                    Save
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

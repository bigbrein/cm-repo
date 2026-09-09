import { redirect } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users as usersTable, departments as departmentsTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";
import { AccessDenied } from "@/components/access-denied";
import { Pagination } from "@/components/pagination";
import { PageSizeField } from "@/components/page-size-field";
import { resolvePageSize } from "@/lib/resolve-page-size";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination-prefs";
import { updateUserAction } from "./actions";

const ROLES: UserRole[] = ["ADMINISTRATOR", "HR_REVIEWER", "MANAGER_READONLY", "AUDITOR"];

interface AdminUsersSearchParams {
  page?: string;
  pageSize?: string;
}

function buildHref(current: AdminUsersSearchParams, overrides: Partial<AdminUsersSearchParams>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  if (merged.pageSize && merged.pageSize !== String(DEFAULT_PAGE_SIZE)) params.set("pageSize", merged.pageSize);
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<AdminUsersSearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canManageUsers) return <AccessDenied />;

  const sp = await searchParams;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const pageSize = await resolvePageSize(sp.pageSize);
  const spWithPageSize = { ...sp, pageSize: String(pageSize) };

  const [userRows, [totalRow], departments] = await Promise.all([
    db
      .select({ user: usersTable, department: departmentsTable })
      .from(usersTable)
      .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
      .orderBy(asc(usersTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(usersTable),
    db.select().from(departmentsTable).orderBy(asc(departmentsTable.name)),
  ]);
  const users = userRows.map((r) => ({ ...r.user, department: r.department }));
  const total = totalRow?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <form method="GET" className="flex items-end justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {total} user{total === 1 ? "" : "s"}
        </span>
        <div className="flex items-end gap-3">
          <PageSizeField defaultValue={pageSize} />
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Apply
          </button>
        </div>
      </form>

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

      <Pagination page={page} pageCount={pageCount} hrefForPage={(p) => buildHref(spWithPageSize, { page: String(p) })} />
    </div>
  );
}

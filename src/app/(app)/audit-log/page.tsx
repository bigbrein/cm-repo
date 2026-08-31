import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { queryAuditLogs } from "@/lib/audit-query";
import { auditActionEnum } from "@/db/schema";
import { AccessDenied } from "@/components/access-denied";

// 3.9 Audit Logging — Administrator/Auditor viewer over the append-only
// audit_log table (see lib/audit.ts for the write path and
// drizzle/0001_audit_log_immutability.sql for the DB-level enforcement of
// FR-AUD-4 / BR-6).

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Login succeeded",
  LOGIN_FAILURE: "Login failed",
  LOGOUT: "Logout",
  ACCESS_DENIED: "Access denied",
  DOCUMENT_UPLOAD: "Document uploaded",
  DOCUMENT_EDIT: "Document edited",
  DOCUMENT_CORRECTION: "Document corrected (post-window)",
  DOCUMENT_DOWNLOAD: "Document downloaded",
  DOCUMENT_DELETE: "Document deleted",
  EMPLOYEE_SYNC: "SuccessFactors sync",
  USER_CREATED: "User created",
  USER_ROLE_CHANGED: "User role changed",
};

interface AuditSearchParams {
  action?: string;
  actor?: string;
  from?: string;
  to?: string;
  page?: string;
}

function buildHref(current: AuditSearchParams, overrides: Partial<AuditSearchParams>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.action) params.set("action", merged.action);
  if (merged.actor) params.set("actor", merged.actor);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/audit-log?${qs}` : "/audit-log";
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<AuditSearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canViewAuditLog) return <AccessDenied />;

  const sp = await searchParams;

  const validAction = auditActionEnum.enumValues.includes(sp.action as never)
    ? (sp.action as (typeof auditActionEnum.enumValues)[number])
    : undefined;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;

  const { rows, total, pageCount } = await queryAuditLogs({
    action: validAction,
    actorQuery: sp.actor,
    from: sp.from,
    to: sp.to,
    page,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <span className="text-sm text-muted-foreground">
          {total} entr{total === 1 ? "y" : "ies"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Append-only record of logins and document activity (FR-AUD-1/2). Entries can never be edited or removed,
        including by an administrator.
      </p>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="action" className="block text-xs font-medium text-muted-foreground">
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={sp.action ?? ""}
            className="mt-1 rounded-md border border-border px-3 py-2 text-sm bg-surface"
          >
            <option value="">All actions</option>
            {auditActionEnum.enumValues.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="actor" className="block text-xs font-medium text-muted-foreground">
            Actor email contains
          </label>
          <input
            id="actor"
            name="actor"
            defaultValue={sp.actor ?? ""}
            className="mt-1 rounded-md border border-border px-3 py-2 text-sm bg-surface"
          />
        </div>
        <div>
          <label htmlFor="from" className="block text-xs font-medium text-muted-foreground">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={sp.from ?? ""}
            className="mt-1 rounded-md border border-border px-3 py-2 text-sm bg-surface"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-xs font-medium text-muted-foreground">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={sp.to ?? ""}
            className="mt-1 rounded-md border border-border px-3 py-2 text-sm bg-surface"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Apply
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">IP Address</th>
              <th className="px-4 py-2">User Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                  {log.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </span>
                </td>
                <td className="px-4 py-2">{log.actor?.email ?? log.actorEmail ?? "system"}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {log.cmDocument?.documentName ?? (log.targetType ? `${log.targetType}:${log.targetId}` : "—")}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{log.ipAddress ?? "—"}</td>
                <td
                  className="max-w-[220px] truncate px-4 py-2 text-xs text-muted-foreground"
                  title={log.userAgent ?? undefined}
                >
                  {log.userAgent ?? "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildHref(sp, { page: String(p) })}
              className={`rounded-md px-3 py-1 ${
                p === page ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

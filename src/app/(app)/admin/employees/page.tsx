import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees as employeesTable, departments, auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { AccessDenied } from "@/components/access-denied";
import { triggerSyncAction } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  TERMINATED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  ON_LEAVE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default async function AdminEmployeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canManageIntegrations) return <AccessDenied />;

  const [employeeRows, [lastSync]] = await Promise.all([
    db
      .select({ employee: employeesTable, department: departments })
      .from(employeesTable)
      .innerJoin(departments, eq(employeesTable.departmentId, departments.id))
      .orderBy(asc(employeesTable.lastName), asc(employeesTable.firstName)),
    db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "EMPLOYEE_SYNC"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1),
  ]);
  const employees = employeeRows.map((r) => ({ ...r.employee, department: r.department }));

  const sfMode = process.env.SF_MODE === "odata" ? "Live SuccessFactors OData" : "Mock (demo data)";
  const summary = lastSync?.metadata as
    | {
        fetched: number;
        created: number;
        updated: number;
        unchanged: number;
        newlyTerminated: string[];
      }
    | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
        <div>
          <h2 className="text-sm font-semibold">SAP SuccessFactors sync</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Mode:{""}
            <span className="font-medium text-foreground">{sfMode}</span>
            {" ·"}
            Last run:{""}
            <span className="font-medium text-foreground">
              {lastSync ? lastSync.createdAt.toLocaleString() : "never"}
            </span>
            {summary ? (
              <>
                {" ·"}
                {summary.fetched} fetched, {summary.created} created,{""}
                {summary.updated} updated, {summary.newlyTerminated.length}
                {""}
                newly terminated
              </>
            ) : null}
          </p>
        </div>
        <form action={triggerSyncAction}>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Sync now
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Employee ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Job Title</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Source</th>
              <th className="px-4 py-2">Last synced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {employees.map((e) => (
              <tr
                key={e.id}
                className={e.employmentStatus === "TERMINATED" ? "bg-red-50/50 dark:bg-red-950/20" : undefined}
              >
                <td className="px-4 py-2 font-mono text-xs">{e.employeeId}</td>
                <td className="px-4 py-2">{e.fullName}</td>
                <td className="px-4 py-2">{e.department.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.jobTitle ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.employmentStatus]}`}>
                    {e.employmentStatus.replace("_", "")}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{e.sourceSystem}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.lastSyncedAt.toLocaleString()}</td>
              </tr>
            ))}
            {employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No employees cached yet. Click &quot;Sync now&quot; to pull from SuccessFactors.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

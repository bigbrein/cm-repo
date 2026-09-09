import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { departments as departmentsTable } from "@/db/schema";
import { getCmStatus } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { AccessDenied } from "@/components/access-denied";
import { BarList } from "@/components/bar-list";
import { Pagination } from "@/components/pagination";
import { PageSizeField } from "@/components/page-size-field";
import { resolvePageSize } from "@/lib/resolve-page-size";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination-prefs";
import {
  getStatusReport,
  getExpiringSoonReport,
  getCountByType,
  getCountByDepartment,
  getCountByUploader,
  getMonthlyTrends,
} from "@/lib/reports";

// 3.10 Reporting & Analytics

const REPORT_TYPES = [
  { key: "active", label: "Active CMs" }, // FR-REP-1
  { key: "expired", label: "Expired CMs" }, // FR-REP-2
  { key: "expiringSoon", label: "Expiring Soon" }, // FR-REP-6
  { key: "byType", label: "By CM Type" }, // FR-REP-3
  { key: "byDepartment", label: "By Department" }, // FR-REP-4
  { key: "byUploader", label: "By Uploader" }, // FR-REP-5
  { key: "monthlyTrends", label: "Monthly Upload Trends" }, // FR-REP-7
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["key"];

const EXPIRING_SOON_DAYS = Number(process.env.EXPIRING_SOON_DAYS ?? 30);

interface ReportSearchParams {
  type?: string;
  departmentId?: string;
  page?: string;
  pageSize?: string;
}

// The three status-table report types are the only ones with per-row data
// to paginate — the "By ..." reports are already-aggregated bar charts
// (one bar per category, not a page-able list of rows).
const PAGINATED_TYPES = new Set<ReportType>(["active", "expired", "expiringSoon"]);

function buildHref(current: ReportSearchParams, overrides: Partial<ReportSearchParams>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.type && merged.type !== "active") params.set("type", merged.type);
  if (merged.departmentId) params.set("departmentId", merged.departmentId);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  if (merged.pageSize && merged.pageSize !== String(DEFAULT_PAGE_SIZE)) params.set("pageSize", merged.pageSize);
  const qs = params.toString();
  return qs ? `/reports?${qs}` : "/reports";
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canViewReports) return <AccessDenied />;

  const sp = await searchParams;
  const type = (REPORT_TYPES.some((r) => r.key === sp.type) ? sp.type : "active") as ReportType;
  // Department filter is only meaningful for unscoped roles (Administrator,
  // Auditor) — department-scoped roles already only ever see their own
  // department via cmDocumentScopeWhere (FR-REP-8).
  const departmentId = !user.permissions.isDepartmentScoped ? sp.departmentId : undefined;
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const pageSize = await resolvePageSize(sp.pageSize);
  const spWithPageSize = { ...sp, pageSize: String(pageSize) };

  const departments = !user.permissions.isDepartmentScoped
    ? await db.select().from(departmentsTable).orderBy(asc(departmentsTable.name))
    : [];

  // Only one of these ever actually runs per request (the other two
  // branches are `null`), but computing it once up front — rather than
  // inline in the JSX below — means both the table and the Pagination
  // component read the same result instead of the report re-running twice.
  const statusReport =
    type === "active" || type === "expired"
      ? await getStatusReport(user, type === "active" ? "ACTIVE" : "EXPIRED", departmentId, { page, pageSize })
      : type === "expiringSoon"
        ? await getExpiringSoonReport(user, EXPIRING_SOON_DAYS, departmentId, { page, pageSize })
        : null;

  return (
    <div>
      <h1 className="text-xl font-semibold">Reports</h1>

      <nav className="mt-4 flex flex-wrap gap-1 border-b border-border">
        {REPORT_TYPES.map((r) => (
          <Link
            key={r.key}
            // Switching report type always starts back at page 1 — a page
            // number from a different report's pagination isn't meaningful
            // here (see the buildHref default-page comment above).
            href={buildHref(spWithPageSize, { type: r.key, page: "1" })}
            className={`rounded-t-md px-3 py-2 text-sm font-medium ${
              type === r.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      {!user.permissions.isDepartmentScoped || PAGINATED_TYPES.has(type) ? (
        <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="type" value={type} />
          {!user.permissions.isDepartmentScoped ? (
            <div>
              <label htmlFor="departmentId" className="block text-xs font-medium text-muted-foreground">
                Department
              </label>
              <select
                id="departmentId"
                name="departmentId"
                defaultValue={departmentId ?? ""}
                className="mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {PAGINATED_TYPES.has(type) ? <PageSizeField defaultValue={pageSize} /> : null}
          <button
            type="submit"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Apply
          </button>
        </form>
      ) : null}

      <div className="mt-6">
        {(type === "active" || type === "expired") && statusReport ? <StatusReportTable rows={statusReport.rows} /> : null}
        {type === "expiringSoon" && statusReport ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              CMs expiring within the next {EXPIRING_SOON_DAYS} days.
            </p>
            <StatusReportTable rows={statusReport.rows} />
          </>
        ) : null}
        {type === "byType" ? <BarList data={await getCountByType(user, departmentId)} /> : null}
        {type === "byDepartment" ? <BarList data={await getCountByDepartment(user)} /> : null}
        {type === "byUploader" ? <BarList data={await getCountByUploader(user, departmentId)} /> : null}
        {type === "monthlyTrends" ? <MonthlyTrendsChart data={await getMonthlyTrends(user, 12, departmentId)} /> : null}
      </div>

      {statusReport ? (
        <Pagination
          page={page}
          pageCount={statusReport.pageCount}
          hrefForPage={(p) => buildHref(spWithPageSize, { page: String(p) })}
        />
      ) : null}
    </div>
  );
}

type StatusReportRow = Awaited<ReturnType<typeof getStatusReport>>["rows"][number];

function StatusReportTable({ rows }: { rows: StatusReportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Document Name</th>
            <th className="px-4 py-2">Employee</th>
            <th className="px-4 py-2">Department</th>
            <th className="px-4 py-2">CM Type</th>
            <th className="px-4 py-2">Date Issued</th>
            <th className="px-4 py-2">Expiry Date</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((doc) => (
            <tr key={doc.id}>
              <td className="px-4 py-2 font-mono text-xs">{doc.documentName}</td>
              <td className="px-4 py-2">{doc.employee.fullName}</td>
              <td className="px-4 py-2 text-muted-foreground">{doc.employee.department.name}</td>
              <td className="px-4 py-2">{doc.documentType.name}</td>
              <td className="px-4 py-2">{doc.dateIssued.toLocaleDateString()}</td>
              <td className="px-4 py-2">{doc.expiryDate.toLocaleDateString()}</td>
              <td className="px-4 py-2">
                <StatusBadge status={getCmStatus(doc.expiryDate)} />
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                No records for this report.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// Bar height is computed in px, not as a CSS `%` — a percentage height only
// resolves against a parent with an explicit height, and each column here
// is an auto-sized flex item (sized by its own label + bar + label content),
// so a `%` height on the bar was resolving to 0 against it.
const CHART_BAR_MAX_PX = 140;

function MonthlyTrendsChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-48 items-end gap-2 rounded-lg border border-border p-4">
      {data.map((d) => (
        <div key={d.month} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div className="text-xs font-medium tabular-nums">{d.count}</div>
          <div
            className="w-full rounded-t bg-primary"
            style={{ height: `${Math.max(4, Math.round((d.count / max) * CHART_BAR_MAX_PX))}px` }}
          />
          <div className="text-[10px] text-muted-foreground">{d.month.slice(2)}</div>
        </div>
      ))}
    </div>
  );
}

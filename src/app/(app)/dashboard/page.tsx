import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { queryCmDocuments, type SortColumn, type StatusFilter } from "@/lib/cm-documents";
import { getCmStatus } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { RecordActionsMenu } from "@/components/record-actions-menu";
import { AccessDenied } from "@/components/access-denied";

// 3.6 Home Dashboard + 3.7 Search & Filtering

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: "documentName", label: "Document Name" },
  { key: "employeeName", label: "Employee Name" },
  { key: "employeeId", label: "Employee ID" },
  { key: "cmType", label: "CM Type" },
  { key: "dateIssued", label: "Date Issued" },
  { key: "expiryDate", label: "Expiry Date" },
];

interface DashboardSearchParams {
  q?: string;
  status?: string;
  sort?: string;
  direction?: string;
  page?: string;
  pageSize?: string;
}

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = 10;

function buildHref(current: DashboardSearchParams, overrides: Partial<DashboardSearchParams>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status && merged.status !== "ACTIVE") params.set("status", merged.status);
  if (merged.sort) params.set("sort", merged.sort);
  if (merged.direction) params.set("direction", merged.direction);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  if (merged.pageSize && merged.pageSize !== String(DEFAULT_PAGE_SIZE)) params.set("pageSize", merged.pageSize);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.permissions.canViewDashboard) return <AccessDenied />;

  const sp = await searchParams;

  const status = (sp.status === "EXPIRED" || sp.status === "ALL" ? sp.status : "ACTIVE") as StatusFilter;
  const sort = (COLUMNS.some((c) => c.key === sp.sort) ? sp.sort : "dateIssued") as SortColumn;
  const direction = sp.direction === "asc" ? "asc" : "desc";
  const page = Number(sp.page) > 0 ? Number(sp.page) : 1;
  const pageSize = Number(sp.pageSize) > 0
    ? Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(Number(sp.pageSize))))
    : DEFAULT_PAGE_SIZE;

  const { rows, total, pageCount } = await queryCmDocuments(user, { q: sp.q, status, sort, direction, page, pageSize });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-sm text-muted-foreground">
          {total} record{total === 1 ? "" : "s"}
        </span>
      </div>

      {/* FR-SRCH-1/2/3/4: search by employee name/ID, filter by status */}
      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="q" className="block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Employee name, employee ID, or document name..."
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-surface"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 rounded-md border border-border px-3 py-2 text-sm bg-surface"
          >
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <div>
          <label htmlFor="pageSize" className="block text-xs font-medium text-muted-foreground">
            Per page
          </label>
          <input
            id="pageSize"
            name="pageSize"
            type="number"
            min={MIN_PAGE_SIZE}
            max={MAX_PAGE_SIZE}
            step={1}
            defaultValue={pageSize}
            className="mt-1 w-20 rounded-md border border-border px-3 py-2 text-sm bg-surface"
          />
        </div>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="direction" value={direction} />
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
              {COLUMNS.map((col) => {
                const isActive = sort === col.key;
                const nextDirection = isActive && direction === "asc" ? "desc" : "asc";
                return (
                  <th key={col.key} className="px-4 py-2">
                    <Link
                      href={buildHref(sp, { sort: col.key, direction: nextDirection, page: "1" })}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.label}
                      {isActive ? <span aria-hidden>{direction === "asc" ? "▲" : "▼"}</span> : null}
                    </Link>
                  </th>
                );
              })}
              <th className="px-4 py-2">Document ID</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((doc) => {
              const cmStatus = getCmStatus(doc.expiryDate);
              const isTerminated = doc.employee.employmentStatus === "TERMINATED";
              return (
                <tr
                  key={doc.id}
                  // FR-DASH-6: terminated-employee highlight, visually distinct
                  // from the Active/Expired status badge in its own column.
                  className={isTerminated ? "bg-red-50/70 dark:bg-red-950/30" : undefined}
                >
                  <td className="px-4 py-2 font-mono text-xs">{doc.documentName}</td>
                  <td className="px-4 py-2">
                    {doc.employee.fullName}
                    {isTerminated ? (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                        Terminated
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">{doc.employee.employeeId}</td>
                  <td className="px-4 py-2">{doc.documentType.name}</td>
                  <td className="px-4 py-2">{doc.dateIssued.toLocaleDateString()}</td>
                  <td className="px-4 py-2">{doc.expiryDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{doc.documentId}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={cmStatus} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <RecordActionsMenu
                      documentId={doc.id}
                      documentName={doc.documentName}
                      canEdit={user.permissions.canEditDocuments}
                      canDelete={user.permissions.canDeleteDocuments}
                      canDownload={user.permissions.canDownloadDocuments}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  No CM records match your filters.
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

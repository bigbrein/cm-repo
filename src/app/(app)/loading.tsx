// Suspense fallback for every route under (app) — shown while navigating
// to a new page, or while the current page re-renders with new search
// params (e.g. the dashboard/reports/audit-log filter forms). The sidebar
// (in the parent layout) stays mounted and interactive throughout.
export default function Loading() {
  return <div className="top-loading-bar" role="status" aria-label="Loading" />;
}

// Shared "Per page" bounds/default across every paginated table (dashboard,
// audit log, reports, admin users/employees) — one set of numbers so the
// control means the same thing everywhere, and one cookie so a value picked
// on any of those pages carries over to the others. Deliberately has no
// server-only imports: this file is shared by both the server pages
// (reading/clamping the value) and the client PageSizeField (writing the
// cookie), so it can't depend on `next/headers`.
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 30;
export const PAGE_SIZE_COOKIE = "cm_page_size";

export function clampPageSize(value: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(value)));
}

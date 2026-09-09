import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_COOKIE, clampPageSize } from "@/lib/pagination-prefs";

// Explicit `?pageSize=` in the URL wins (so a link/pagination click that
// carries it forward stays exact); otherwise falls back to the viewer's
// last-chosen value (written client-side by PageSizeField, see
// components/page-size-field.tsx), then the hard default.
export async function resolvePageSize(explicit: string | undefined): Promise<number> {
  const explicitValue = Number(explicit);
  if (explicitValue > 0) return clampPageSize(explicitValue);

  const cookieStore = await cookies();
  const cookieValue = Number(cookieStore.get(PAGE_SIZE_COOKIE)?.value);
  if (cookieValue > 0) return clampPageSize(cookieValue);

  return DEFAULT_PAGE_SIZE;
}

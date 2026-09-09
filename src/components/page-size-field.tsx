"use client";

import { MIN_PAGE_SIZE, MAX_PAGE_SIZE, PAGE_SIZE_COOKIE } from "@/lib/pagination-prefs";

const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

// Writes the chosen value to a cookie on every change, independent of the
// surrounding <form>'s own GET submission — that's what makes it "stick"
// across a sidebar navigation to a completely different paginated page
// (dashboard -> reports, say), not just a resubmit of this same form. The
// server reads it back via resolvePageSize() (lib/resolve-page-size.ts) as
// the fallback when a page's URL doesn't carry its own `?pageSize=`.
export function PageSizeField({ defaultValue }: { defaultValue: number }) {
  return (
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
        defaultValue={defaultValue}
        onChange={(e) => {
          const value = Math.trunc(Number(e.target.value));
          if (value > 0) {
            document.cookie = `${PAGE_SIZE_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
          }
        }}
        className="mt-1 w-20 rounded-md border border-border px-3 py-2 text-sm bg-surface"
      />
    </div>
  );
}

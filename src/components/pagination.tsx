import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

const WINDOW_SIZE = 5;

// Shared page picker for the dashboard and audit log: shows at most
// WINDOW_SIZE page numbers, centered on the current page (clamped so the
// window never runs off either edge), plus jump-to-first/jump-to-last
// buttons for reaching the extremes of a large result set without paging
// through every number in between.
export function Pagination({
  page,
  pageCount,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const start = Math.max(1, Math.min(page - Math.floor(WINDOW_SIZE / 2), pageCount - WINDOW_SIZE + 1));
  const end = Math.min(pageCount, start + WINDOW_SIZE - 1);
  const pageNumbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
      <ExtremeLink href={hrefForPage(1)} disabled={page === 1} label="First page">
        <ChevronsLeft className="h-4 w-4" />
      </ExtremeLink>
      {pageNumbers.map((p) => (
        <Link
          key={p}
          href={hrefForPage(p)}
          className={`rounded-md px-3 py-1 ${
            p === page ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted"
          }`}
        >
          {p}
        </Link>
      ))}
      <ExtremeLink href={hrefForPage(pageCount)} disabled={page === pageCount} label="Last page">
        <ChevronsRight className="h-4 w-4" />
      </ExtremeLink>
    </div>
  );
}

function ExtremeLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md p-1 text-muted-foreground/40" aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className="rounded-md p-1 hover:bg-surface-muted">
      {children}
    </Link>
  );
}

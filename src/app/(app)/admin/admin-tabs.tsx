"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex gap-1 border-b border-border">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

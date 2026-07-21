"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UploadCloud, BarChart3, ScrollText, ShieldCheck, Menu, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/session";
import { signOutAction } from "@/app/(app)/actions";
import { ThemeToggle } from "@/components/theme-toggle";

const ICONS = {
  "/dashboard": LayoutDashboard,
  "/upload": UploadCloud,
  "/reports": BarChart3,
  "/audit-log": ScrollText,
  "/admin": ShieldCheck,
} as const;

function SidebarNav({
  links,
  pathname,
  onNavigate,
}: {
  links: { href: keyof typeof ICONS; label: string }[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex-1 space-y-0.5 px-2">
      {links.map((l) => {
        const Icon = ICONS[l.href];
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ user }: { user: CurrentUser }) {
  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs leading-tight">
          <div className="truncate font-medium text-foreground">{user.name ?? user.email}</div>
          <div className="text-muted-foreground">{ROLE_LABELS[user.role]}</div>
        </div>
        <ThemeToggle />
      </div>
      <form action={signOutAction} className="mt-3">
        <button
          type="submit"
          className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links: { href: keyof typeof ICONS; label: string; show: boolean }[] = [
    { href: "/dashboard", label: "Dashboard", show: user.permissions.canViewDashboard },
    { href: "/upload", label: "Upload CM", show: user.permissions.canUploadDocuments },
    { href: "/reports", label: "Reports", show: user.permissions.canViewReports },
    { href: "/audit-log", label: "Audit Log", show: user.permissions.canViewAuditLog },
    { href: "/admin", label: "Admin", show: user.permissions.canManageUsers || user.permissions.canManageLookups },
  ];
  const visibleLinks = links.filter((l) => l.show);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — always mounted, hidden below the `sm` breakpoint */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface sm:flex">
        <div className="px-4 py-4">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight text-foreground">
            CM Repository
          </Link>
        </div>
        <SidebarNav links={visibleLinks} pathname={pathname} onNavigate={() => {}} />
        <SidebarFooter user={user} />
      </aside>

      {/* Mobile slide-in sidebar — only mounted while open */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex sm:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative flex w-64 flex-col border-r border-border bg-surface">
            <div className="flex items-center justify-between px-4 py-4">
              <Link href="/dashboard" className="text-base font-semibold tracking-tight text-foreground">
                CM Repository
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav links={visibleLinks} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter user={user} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">CM Repository</span>
          <ThemeToggle />
        </div>

        <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

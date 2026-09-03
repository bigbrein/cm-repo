import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UploadCloud, ShieldCheck, ScrollText, FileCheck2, BarChart3, RefreshCw, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  keywords: [
    "consequence management software",
    "HR compliance repository",
    "employee disciplinary records",
    "SAP SuccessFactors integration",
    "HR document management",
    "audit log software",
    "written warning tracking",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

const FEATURES = [
  {
    icon: UploadCloud,
    title: "Upload & auto-extract",
    description:
      "Drop a PDF, Word, plain text, Markdown, HTML, or RTF letter and the system pulls out the employee, CM type, issue date, and validity period on its own.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description:
      "Administrators, HR reviewers, read-only managers, and auditors each see exactly what their role — and department scope — should allow, and nothing more.",
  },
  {
    icon: ScrollText,
    title: "Immutable audit log",
    description:
      "Every view, download, and edit is recorded in an append-only log that can't be altered after the fact — built for compliance, not just convenience.",
  },
  {
    icon: FileCheck2,
    title: "Always-PDF records",
    description:
      "Whatever format a CM document arrives in, it's converted, stored, and downloaded as a single consistent PDF — no format sprawl in the archive.",
  },
  {
    icon: BarChart3,
    title: "Reports built in",
    description: "Track consequence management activity across departments and employees without exporting to a spreadsheet.",
  },
  {
    icon: RefreshCw,
    title: "SAP SuccessFactors sync",
    description:
      "Employee identity, department, and job title stay in sync with SuccessFactors as the single authoritative source of truth.",
  },
] as const;

const DEMO_ACCOUNTS = [
  { email: "admin@cmrepo.demo", role: "Administrator", scope: "Org-wide" },
  { email: "hr.dist@cmrepo.demo", role: "HR Reviewer / Uploader", scope: "Distribution Center" },
  { email: "manager@cmrepo.demo", role: "Manager / Read-only", scope: "Customer Support" },
  { email: "auditor@cmrepo.demo", role: "Auditor", scope: "Org-wide" },
] as const;

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          <span className="text-base font-semibold tracking-tight text-foreground">{SITE_NAME}</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:px-8 sm:pt-24 sm:pb-28">
          <Link
            href="#demo"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Live demo — seeded with sample data
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Consequence management,
            <br className="hidden sm:block" /> done right.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">{SITE_DESCRIPTION}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover sm:w-auto"
            >
              Sign in
            </Link>
            <Link
              href="#demo"
              className="w-full rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted sm:w-auto"
            >
              Try a demo account
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-surface/50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Everything HR needs to keep records straight
              </h2>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo accounts */}
        <section id="demo" className="scroll-mt-16 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Try it yourself</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                This deployment runs on seeded, fictional data — no real employee records. Sign in with any account
                below; the password is the same for all of them.
              </p>
            </div>

            <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full min-w-120 text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 sm:px-5">Email</th>
                    <th className="px-4 py-3 sm:px-5">Role</th>
                    <th className="px-4 py-3 sm:px-5">Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_ACCOUNTS.map((account, i) => (
                    <tr key={account.email} className={i < DEMO_ACCOUNTS.length - 1 ? "border-b border-border" : ""}>
                      <td className="px-4 py-3 font-mono text-xs text-foreground sm:px-5 sm:text-sm">{account.email}</td>
                      <td className="px-4 py-3 text-foreground sm:px-5">{account.role}</td>
                      <td className="px-4 py-3 text-muted-foreground sm:px-5">{account.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Password: <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">Password123!</code> for
              every account above.
            </p>

            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Go to sign in
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:flex-row sm:px-8">
          <span>© {new Date().getFullYear()} {SITE_NAME} — a demo project, not for production use.</span>
          <a href="https://github.com/bigbrein/cm-repo" target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
            View source
          </a>
        </div>
      </footer>
    </div>
  );
}

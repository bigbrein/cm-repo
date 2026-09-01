import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { credentialsLoginAction, microsoftLoginAction } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const ERROR_MESSAGES: Record<string, string> = {
  SessionExpired: "Your session expired after a period of inactivity. Please sign in again.",
  AccountLocked:
    "This account is temporarily locked after repeated failed sign-in attempts. Try again in a few minutes.",
  AccountInactive: "This account has been deactivated. Contact your administrator.",
  InvalidCredentials: "Invalid email or password.",
  CredentialsSignin: "Invalid email or password.",
  AccessDenied: "You don't have access to that resource.",
  Configuration: "Sign-in is not configured correctly. Contact your administrator.",
};

const DEV_LOGIN_ENABLED = process.env.ENABLE_DEV_LOGIN !== "false";
const ENTRA_ID_ENABLED = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const { error, code, callbackUrl } = await searchParams;

  if (session?.user && session.error !== "SessionExpired") {
    redirect(callbackUrl || "/dashboard");
  }

  // `code` is the specific reason (set by our own AuthError subclasses, see
  // src/auth.ts); `error` is Auth.js's generic error type. Prefer the more
  // specific one so account-lockout / inactive-account conditions
  // (FR-AUTH-6) surface even when NextAuth's default callback redirect is
  // hit directly rather than via our server action.
  const resolvedError = (code && ERROR_MESSAGES[code] ? code : error) ?? null;
  const errorMessage = resolvedError ? (ERROR_MESSAGES[resolvedError] ?? "Sign-in failed. Please try again.") : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">CM Repository</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consequence Management document repository, synced with SAP SuccessFactors.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              {errorMessage}
            </div>
          ) : null}

          {ENTRA_ID_ENABLED ? (
            <form action={microsoftLoginAction} className="mb-4">
              <SubmitButton className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-muted">
                Sign in with Microsoft
              </SubmitButton>
            </form>
          ) : null}

          {ENTRA_ID_ENABLED && DEV_LOGIN_ENABLED ? (
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>
          ) : null}

          {DEV_LOGIN_ENABLED ? (
            <form action={credentialsLoginAction} className="space-y-3">
              <input type="hidden" name="callbackUrl" value={callbackUrl || "/dashboard"} />
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none bg-surface"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none bg-surface"
                  placeholder="••••••••"
                />
              </div>
              <SubmitButton className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover">
                Sign in
              </SubmitButton>
            </form>
          ) : null}

          {!ENTRA_ID_ENABLED && !DEV_LOGIN_ENABLED ? (
            <p className="text-sm text-muted-foreground">
              No sign-in method is configured. Contact your administrator.
            </p>
          ) : null}

          {DEV_LOGIN_ENABLED ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Need an internal account?{""}
              <Link href="/register" className="underline hover:text-foreground">
                Register
              </Link>
            </p>
          ) : null}
        </div>

        {DEV_LOGIN_ENABLED ? (
          <p className="text-center text-xs text-muted-foreground">
            Demo mode: internal accounts authenticate locally. Configure AUTH_MICROSOFT_ENTRA_ID_* to enable your
            enterprise identity provider (FR-AUTH-8).
          </p>
        ) : null}
      </div>
    </div>
  );
}

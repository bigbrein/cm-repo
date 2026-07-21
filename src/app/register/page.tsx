import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  InvalidInput: "Please check your name, email, and password (minimum 8 characters).",
  EmailInUse: "An account with that email already exists.",
  Configuration: "Self-service registration is disabled. Contact your administrator.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (process.env.ENABLE_DEV_LOGIN === "false") {
    redirect("/login");
  }

  const { error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Registration failed.") : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Register an internal account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            New accounts start with read-only access. An administrator can grant additional permissions.
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

          <form action={registerAction} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                minLength={2}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none bg-surface"
              />
            </div>
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
                minLength={8}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none bg-surface"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover"
            >
              Create account
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Already have an account?{""}
            <Link href="/login" className="underline hover:text-foreground">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import "server-only";
import { auth } from "@/auth";
import { permissionsForRole, type RolePermissions } from "@/lib/rbac";
import type { UserRole } from "@/db/schema";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface CurrentUser {
  id: string;
  role: UserRole;
  departmentId: string | null;
  name?: string | null;
  email?: string | null;
  permissions: RolePermissions;
}

/**
 * Server-side session accessor. NFR-SEC-2 requires RBAC to be enforced at
 * the API layer on every endpoint, not only via `proxy.ts` — Next.js 16's
 * own docs for Proxy warn explicitly against relying on it alone (a matcher
 * change can silently remove coverage), so every route handler and server
 * page in this app calls one of these helpers directly.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user || session.error === "SessionExpired") return null;
  return {
    id: session.user.id,
    role: session.user.role,
    departmentId: session.user.departmentId,
    name: session.user.name,
    email: session.user.email,
    permissions: permissionsForRole(session.user.role),
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

export async function requirePermission<K extends keyof RolePermissions>(permission: K): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions[permission]) throw new ForbiddenError(`Missing permission: ${permission}`);
  return user;
}

/** Convenience wrapper for Route Handlers: converts auth errors to Responses. */
export async function withApiAuth<T>(
  fn: (user: CurrentUser) => Promise<T>,
  options?: { permission?: keyof RolePermissions }
): Promise<T | Response> {
  try {
    const user = options?.permission ? await requirePermission(options.permission) : await requireUser();
    return await fn(user);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return Response.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
}

import NextAuth, { CredentialsSignin } from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcryptjs";
import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";

// 3.1 Authentication & Authorization
// -----------------------------------------------------------------------
// FR-AUTH-1/8: the primary, production-intended path is the Microsoft
// Entra ID (Azure AD) provider below, which Auth.js drives through the
// OAuth 2.0 Authorization Code flow with PKCE automatically — no custom
// PKCE handling is needed here. It only activates when the org supplies
// AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER, which is exactly the point of
// FR-AUTH-8: adding the real enterprise IdP is an env-var change, not a
// redesign.
//
// Because this MVP has no live enterprise tenant to integrate against, a
// "dev credentials" provider is included as a runnable stand-in (gated by
// ENABLE_DEV_LOGIN, on by default outside production). It authenticates
// against seeded internal accounts (see src/db/seed.ts) rather than any
// SuccessFactors/IdP data, and is the provider FR-AUTH-7's basic
// registration page creates accounts for.

const IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? 30) * 60_000;
const ABSOLUTE_TIMEOUT_SECONDS = Number(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS ?? 12) * 3600;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

class AccountLockedError extends CredentialsSignin {
  code = "AccountLocked";
}
class AccountInactiveError extends CredentialsSignin {
  code = "AccountInactive";
}
class InvalidCredentialsError extends CredentialsSignin {
  code = "InvalidCredentials";
}

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    })
  );
}

if (process.env.ENABLE_DEV_LOGIN !== "false") {
  providers.push(
    Credentials({
      id: "dev-credentials",
      name: "Internal Account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const { ipAddress, userAgent } = requestMeta(request);

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user || !user.passwordHash) {
          await writeAuditLog({
            action: "LOGIN_FAILURE",
            actorEmail: email,
            ipAddress,
            userAgent,
            metadata: { reason: "no_such_account" },
          });
          throw new InvalidCredentialsError();
        }

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          await writeAuditLog({
            action: "LOGIN_FAILURE",
            actorUserId: user.id,
            actorEmail: email,
            ipAddress,
            userAgent,
            metadata: { reason: "locked" },
          });
          throw new AccountLockedError();
        }

        if (!user.isActive) {
          await writeAuditLog({
            action: "LOGIN_FAILURE",
            actorUserId: user.id,
            actorEmail: email,
            ipAddress,
            userAgent,
            metadata: { reason: "inactive" },
          });
          throw new AccountInactiveError();
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
          await db.update(users).set({ failedLoginAttempts: attempts, lockedUntil }).where(eq(users.id, user.id));
          await writeAuditLog({
            action: "LOGIN_FAILURE",
            actorUserId: user.id,
            actorEmail: email,
            ipAddress,
            userAgent,
            metadata: { reason: "bad_password", attempts },
          });
          throw new (lockedUntil ? AccountLockedError : InvalidCredentialsError)();
        }

        await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          departmentId: user.departmentId,
          isActive: user.isActive,
        };
      },
    })
  );
}

function requestMeta(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]!.trim() : (request.headers.get("x-real-ip") ?? null);
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: "jwt",
    maxAge: ABSOLUTE_TIMEOUT_SECONDS, // FR-AUTH-3: absolute session timeout
    updateAge: 5 * 60, // re-issue the session cookie every 5 min of activity
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      const now = Date.now();

      if (user) {
        // Fresh sign-in.
        token.uid = user.id;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.lastActivity = now;
        token.idleTimedOut = false;
      } else if (token.uid) {
        // FR-AUTH-3: idle-timeout policy. If the gap since the last request
        // exceeds the configured idle window, flag the token so `session()`
        // can surface it as an expired session rather than silently
        // extending access.
        const idleFor = now - (token.lastActivity ?? now);
        if (idleFor > IDLE_TIMEOUT_MS) {
          token.idleTimedOut = true;
        } else {
          token.lastActivity = now;
        }
      }

      if (account) {
        // FR-AUTH-2: short-lived access token + refresh token from the IdP.
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.idleTimedOut) {
        session.error = "SessionExpired";
        return session;
      }
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.departmentId = token.departmentId;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      await writeAuditLog({
        action: "LOGIN_SUCCESS",
        actorUserId: user.id ?? null,
        actorEmail: user.email ?? null,
        metadata: { provider: account?.provider ?? "unknown" },
      });
    },
    async signOut(message) {
      const userId = "token" in message ? message.token?.uid : undefined;
      await writeAuditLog({ action: "LOGOUT", actorUserId: userId ?? null });
    },
    async createUser({ user }) {
      // First account ever provisioned becomes Administrator (bootstrap);
      // everything after defaults to the least-privileged role, per the
      // least-privilege mitigation in Appendix A. An admin can promote
      // users afterwards from the Admin > Users screen.
      const [{ userCount }] = await db.select({ userCount: count() }).from(users);
      const role = (userCount ?? 0) <= 1 ? "ADMINISTRATOR" : "MANAGER_READONLY";
      await db.update(users).set({ role }).where(eq(users.id, user.id));
      await writeAuditLog({
        action: "USER_CREATED",
        actorUserId: user.id ?? null,
        actorEmail: user.email ?? null,
        metadata: { role, provisionedVia: "oauth" },
      });
    },
  },
});

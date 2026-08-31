import type { UserRole } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      departmentId: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    /** Set when the idle-timeout (FR-AUTH-3) has elapsed since last activity. */
    error?: "SessionExpired";
  }

  interface User {
    id: string;
    role: UserRole;
    departmentId: string | null;
    isActive: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid: string;
    role: UserRole;
    departmentId: string | null;
    /** Epoch ms of last-seen activity, used for idle-timeout (FR-AUTH-3). */
    lastActivity: number;
    idleTimedOut?: boolean;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

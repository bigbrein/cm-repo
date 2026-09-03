import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (the `middleware` export
// is deprecated in favor of `proxy`). This is a coarse first line of
// defense — redirect unauthenticated visitors away from protected pages —
// but it is NOT the source of truth for authorization. Every Route Handler
// and server page independently calls requireUser()/requirePermission()
// from lib/session.ts (see that file's comment; Next's own proxy docs warn
// against relying on Proxy alone since a matcher change can silently drop
// coverage while a Server Function still executes).
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth",
  // SEO/crawler file conventions (app/robots.ts, app/sitemap.ts,
  // app/opengraph-image.tsx) — unauthenticated crawlers and social-media
  // link-preview bots need these to actually resolve, not the login redirect.
  "/robots.txt",
  "/sitemap.xml",
  "/opengraph-image",
  "/twitter-image",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/";

  if (isPublic) return NextResponse.next();

  if (!req.auth?.user || req.auth.error === "SessionExpired") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    if (req.auth?.error === "SessionExpired") {
      loginUrl.searchParams.set("error", "SessionExpired");
    }
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

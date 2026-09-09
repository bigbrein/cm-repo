import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimitBuckets } from "@/db/schema";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

// Fixed-window rate limiter backed by Postgres rather than an in-memory
// counter — a serverless deployment (Vercel) runs multiple instances with
// no shared memory, so only a shared DB row is actually correct across
// them. The upsert's `count = count + 1` happens inside Postgres itself, so
// concurrent requests for the same key/window can't race each other.
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  if (row!.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

// Route-handler convenience: returns a ready-to-return 429 Response, or null
// when the request is within its limit and should proceed as normal.
export async function rateLimitOrResponse(key: string, limit: number, windowMs: number): Promise<Response | null> {
  const result = await checkRateLimit(key, limit, windowMs);
  if (result.allowed) return null;
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}

// For the one write endpoint that runs before a user is authenticated
// (self-service registration) — keyed by the caller's IP via the headers
// Vercel/most proxies set, since there's no user id yet to key on. Accepts
// anything with a Headers-like `.get()` so it works from both a Route
// Handler's `request.headers` and a Server Action's `await headers()`.
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

import type { NextRequest } from "next/server";
import { resetDemoData } from "@/lib/demo-reset";

// Triggered on a schedule (vercel.json's `crons` entry, or any external
// scheduler pointed at this URL) rather than by a logged-in user — auth here
// is a shared secret, not a session. Vercel's own Cron Jobs automatically
// send `Authorization: Bearer $CRON_SECRET` when that env var is set, which
// this checks directly; anything else (GitHub Actions, cron-job.org, etc.)
// just needs to send the same header.
//
// CRON_SECRET is optional only so the route doesn't 500 in an environment
// that hasn't set it up yet — but an unset secret means this endpoint is
// wide open, so treat setting it as required before actually relying on
// this in production.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await resetDemoData();
    console.log("Demo reset complete:", result);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Demo reset failed:", error);
    return Response.json({ ok: false, error: "Reset failed" }, { status: 500 });
  }
}

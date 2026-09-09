"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// FR-AUTH-7 (Could): basic registration page for provisioning internal
// accounts where self-service registration is enabled (ENABLE_DEV_LOGIN).
// New accounts default to the least-privileged role; an Administrator
// promotes them afterwards. This path is entirely separate from the
// enterprise SSO flow (FR-AUTH-8) and only exists to make the MVP runnable
// without a live IdP tenant.

const RegisterSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function registerAction(formData: FormData): Promise<void> {
  if (process.env.ENABLE_DEV_LOGIN === "false") {
    redirect("/login?error=Configuration");
  }

  // Self-service account creation, gated by IP rather than a user id —
  // there's no authenticated user yet at this point in the flow. Public-demo
  // abuse protection (spam accounts), not a real production auth control.
  const ip = clientIp(await headers());
  const rateLimit = await checkRateLimit(`register:${ip}`, 5, 60 * 60_000);
  if (!rateLimit.allowed) {
    redirect("/register?error=TooManyRequests");
  }

  const parsed = RegisterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/register?error=InvalidInput");
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    redirect("/register?error=EmailInUse");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [{ userCount }] = await db.select({ userCount: count() }).from(users);

  const [user] = await db
    .insert(users)
    .values({
      name,
      email: normalizedEmail,
      passwordHash,
      role: (userCount ?? 0) === 0 ? "ADMINISTRATOR" : "MANAGER_READONLY",
    })
    .returning();

  await writeAuditLog({
    action: "USER_CREATED",
    actorUserId: user!.id,
    actorEmail: user!.email,
    metadata: { provisionedVia: "self-service-registration" },
  });

  redirect("/login?registered=1");
}

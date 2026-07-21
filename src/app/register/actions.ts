"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

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

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    redirect("/register?error=EmailInUse");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userCount = await prisma.user.count();

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: userCount === 0 ? "ADMINISTRATOR" : "MANAGER_READONLY",
    },
  });

  await writeAuditLog({
    action: "USER_CREATED",
    actorUserId: user.id,
    actorEmail: user.email,
    metadata: { provisionedVia: "self-service-registration" },
  });

  redirect("/login?registered=1");
}

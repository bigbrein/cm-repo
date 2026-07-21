"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function credentialsLoginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  try {
    await signIn("dev-credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      const cause = error as unknown as { type?: string; code?: string; cause?: { err?: { code?: string } } };
      const code = cause.cause?.err?.code ?? cause.code ?? cause.type ?? "InvalidCredentials";
      redirect(`/login?error=${encodeURIComponent(code)}`);
    }
    throw error;
  }
}

export async function microsoftLoginAction(): Promise<void> {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}

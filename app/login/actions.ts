"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { DEMO_PASSWORD, isDemoEmail } from "@/lib/demo-accounts";
import { signIn } from "@/server/auth";
import { env } from "@/server/env";

export type LoginState = { error?: string; code?: string; email?: string };

const messages: Record<string, string> = {
  invalid_credentials: "Неверный email или пароль",
  email_not_verified: "Email не подтверждён. Проверьте почту или запросите письмо ещё раз.",
  rate_limited: "Слишком много попыток входа. Попробуйте через 15 минут.",
};

export async function loginAction(_: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "");
  const next = String(fd.get("next") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: String(fd.get("password") ?? ""),
      redirectTo: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard",
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code ?? "invalid_credentials";
      return { error: messages[code] ?? messages.invalid_credentials, code, email };
    }
    throw e; // NEXT_REDIRECT
  }
}

/** One-click sign-in to a seeded demo account; refused outside DEMO_MODE. */
export async function demoLoginAction(fd: FormData) {
  const email = String(fd.get("email") ?? "");
  if (!env().DEMO_MODE || !isDemoEmail(email)) redirect("/login");
  try {
    await signIn("credentials", { email, password: DEMO_PASSWORD, redirectTo: "/dashboard" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/login");
    throw e; // NEXT_REDIRECT
  }
}

export async function keycloakAction() {
  await signIn("keycloak", { redirectTo: "/dashboard" });
}

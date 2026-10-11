import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { DemoAccounts } from "@/components/layout/demo-accounts";
import { keycloakEnabled } from "@/server/auth";
import { env } from "@/server/env";
import { keycloakAction } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="С возвращением" />
      <LoginForm next={next} />
      {keycloakEnabled() && (
        <form action={keycloakAction} className="mt-4">
          <button type="submit" className={buttonClass("secondary", "lg", "w-full")}>
            Войти через ФСП ID
          </button>
        </form>
      )}
      {env().DEMO_MODE && <DemoAccounts className="mt-8" />}
    </div>
  );
}

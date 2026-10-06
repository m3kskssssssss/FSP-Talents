import type { Metadata } from "next";
import { PageTitle } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
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
      {env().DEMO_MODE && (
        <div className="mt-6 rounded-xl border border-dashed border-accent/40 p-4 text-sm text-muted">
          <p className="label-mono mb-2">Демо-аккаунты</p>
          <p>
            candidate@demo.ru · strong@demo.ru · employer@demo.ru · admin@demo.ru — пароль <span className="font-mono">Demo12345</span>
          </p>
        </div>
      )}
    </div>
  );
}

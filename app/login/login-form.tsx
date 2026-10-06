"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [resent, setResent] = useState<string | null>(null);

  async function resend() {
    const r = await api<{ verifyUrl?: string }>("/api/v1/auth/resend", { body: { email: state.email } });
    setResent(r.verifyUrl ?? "sent");
  }

  return (
    <form action={action} className="blank flex flex-col gap-5 p-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={state.email} required />
      </Field>
      <Field label="Пароль" htmlFor="password">
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <Notice tone="error">
          {state.error}
          {state.code === "email_not_verified" && !resent && (
            <>
              {" "}
              <button type="button" onClick={resend} className="link">
                Отправить письмо ещё раз
              </button>
            </>
          )}
        </Notice>
      )}
      {resent && (
        <Notice>
          Письмо отправлено.{" "}
          {resent !== "sent" && (
            <a className="link" href={resent}>
              Подтвердить (демо-режим)
            </a>
          )}
        </Notice>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Входим…" : "Войти"}
      </Button>
      <p className="text-center text-sm text-muted">
        Нет аккаунта?{" "}
        <Link className="link" href="/register">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}

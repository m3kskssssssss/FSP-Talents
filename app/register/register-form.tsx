"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { api, ApiError, fieldErrors } from "@/lib/api-client";

type Role = "candidate" | "employer";

export function RegisterForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verifyUrl?: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api<{ verifyUrl?: string }>("/api/v1/auth/register", {
        body: {
          role,
          email: fd.get("email"),
          password: fd.get("password"),
          fullName: fd.get("fullName") || undefined,
          companyName: fd.get("companyName") || undefined,
          consents: {
            pd_processing: fd.get("pd") === "on",
            privacy_policy: fd.get("privacy") === "on",
            marketing: fd.get("marketing") === "on",
          },
        },
      });
      setDone(res);
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(err instanceof ApiError ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="blank flex flex-col gap-4 p-6">
        <p className="label-mono">Почти готово</p>
        <p className="text-lg">Мы отправили письмо со ссылкой для подтверждения email.</p>
        {done.verifyUrl && (
          <Notice>
            Демо-режим: письмо не отправляется на реальный адрес.{" "}
            <a className="link" href={done.verifyUrl}>
              Подтвердить email
            </a>
          </Notice>
        )}
        <Link className="link" href="/login">
          Перейти ко входу
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="blank flex flex-col gap-5 p-6" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Кто вы</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(
            [
              ["candidate", "Кандидат"],
              ["employer", "Работодатель"],
            ] as const
          ).map(([v, l]) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm transition-colors",
                role === v ? "border-violet bg-violet-50 text-violet" : "border-gray hover:border-violet/50",
              )}
            >
              <input type="radio" name="role" value={v} checked={role === v} onChange={() => setRole(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      {role === "candidate" ? (
        <Field label="Имя и фамилия" htmlFor="fullName" error={errors.fullName}>
          <input id="fullName" name="fullName" className="input" autoComplete="name" />
        </Field>
      ) : (
        <Field label="Название компании" htmlFor="companyName" error={errors.companyName}>
          <input id="companyName" name="companyName" className="input" autoComplete="organization" required aria-invalid={!!errors.companyName} />
        </Field>
      )}
      <Field label="Email" htmlFor="email" error={errors.email}>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Пароль" htmlFor="password" hint="Минимум 8 символов, буквы и цифры" error={errors.password}>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required aria-invalid={!!errors.password} />
      </Field>
      <div className="flex flex-col gap-2.5 text-sm">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="pd" className="mt-0.5 size-4 accent-violet" required />
          <span>
            Даю согласие на обработку персональных данных в соответствии с{" "}
            <Link className="link" href="/privacy" target="_blank">
              политикой
            </Link>{" "}
            (152-ФЗ)
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="privacy" className="mt-0.5 size-4 accent-violet" required />
          <span>Ознакомлен(а) с политикой конфиденциальности</span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="marketing" className="mt-0.5 size-4 accent-violet" />
          <span className="text-muted">Получать новости ФСП (необязательно)</span>
        </label>
        {errors["consents.pd_processing"] && <p className="text-xs text-red-700">{errors["consents.pd_processing"]}</p>}
      </div>
      {formError && <Notice tone="error">{formError}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Создаём…" : "Зарегистрироваться"}
      </Button>
      <p className="text-center text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link className="link" href="/login">
          Войти
        </Link>
      </p>
    </form>
  );
}

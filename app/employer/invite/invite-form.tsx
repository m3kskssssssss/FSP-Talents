"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";

type Defaults = { title: string; description: string; salaryFrom: string; salaryTo: string; format: string };

export function InviteForm({ profileId, needId, defaults }: { profileId: string; needId: string | null; defaults: Defaults }) {
  const router = useRouter();
  const [v, setV] = useState(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (p: Partial<Defaults>) => setV((x) => ({ ...x, ...p }));
  const num = (s: string) => (s.trim() ? Number(s.replace(/\s/g, "")) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setError(null);
    try {
      const r = await api<{ id: string }>("/api/v1/invitations", {
        body: { profileId, needId, title: v.title, description: v.description, salaryFrom: num(v.salaryFrom), salaryTo: num(v.salaryTo), format: v.format || null },
      });
      router.push(`/employer/invitations/${r.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "Не удалось отправить");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="blank flex flex-col gap-4 p-5" noValidate>
      <Field label="Должность" htmlFor="title" error={errors.title}>
        <input id="title" className="input" value={v.title} onChange={(e) => set({ title: e.target.value })} required aria-invalid={!!errors.title} />
      </Field>
      <Field label="Описание задачи" htmlFor="desc" error={errors.description} hint="Что предстоит делать, команда, условия">
        <textarea id="desc" className="input min-h-32" value={v.description} onChange={(e) => set({ description: e.target.value })} required aria-invalid={!!errors.description} />
      </Field>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1.5 text-sm font-medium">Вилка зарплаты, ₽ в месяц — обязательно</legend>
        <Field label="От" htmlFor="sf" error={errors.salaryFrom}>
          <input id="sf" className="input font-mono" inputMode="numeric" value={v.salaryFrom} onChange={(e) => set({ salaryFrom: e.target.value })} required aria-invalid={!!errors.salaryFrom} />
        </Field>
        <Field label="До" htmlFor="st" error={errors.salaryTo}>
          <input id="st" className="input font-mono" inputMode="numeric" value={v.salaryTo} onChange={(e) => set({ salaryTo: e.target.value })} required aria-invalid={!!errors.salaryTo} />
        </Field>
      </fieldset>
      <Field label="Формат" htmlFor="format">
        <select id="format" className="input" value={v.format} onChange={(e) => set({ format: e.target.value })}>
          <option value="">Не указан</option>
          <option value="remote">Удалённо</option>
          <option value="hybrid">Гибрид</option>
          <option value="office">Офис</option>
        </select>
      </Field>
      <Notice>Кандидат увидит компанию, суть задачи и вилку. Его контакты откроются вам, только если он примет приглашение.</Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Отправляем…" : "Отправить приглашение"}
      </Button>
    </form>
  );
}

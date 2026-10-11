"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StackInput } from "@/components/employer/stack-input";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";

export function VacancyForm() {
  const router = useRouter();
  const [v, setV] = useState({ title: "", description: "", specialization: "backend", grade: "middle", salaryFrom: "", salaryTo: "", format: "", city: "" });
  const [stack, setStack] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const num = (s: string) => (s.trim() ? Number(s.replace(/\s/g, "")) : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setErr(null);
    try {
      await api("/api/v1/vacancies", { body: { ...v, stack, salaryFrom: num(v.salaryFrom), salaryTo: num(v.salaryTo), format: v.format || null, city: v.city || null } });
      setV({ ...v, title: "", description: "", salaryFrom: "", salaryTo: "" });
      router.refresh();
    } catch (x) {
      setErrors(fieldErrors(x));
      setErr(x instanceof ApiError ? x.message : "Ошибка");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <Field label="Название" htmlFor="v-title" error={errors.title}>
          <input id="v-title" className="input" value={v.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
      </div>
      <Field label="Специализация" htmlFor="v-spec">
        <select id="v-spec" className="input" value={v.specialization} onChange={(e) => set({ specialization: e.target.value })}>
          <option value="backend">Backend</option>
          <option value="frontend">Frontend</option>
          <option value="data">Data / ML</option>
          <option value="qa">QA</option>
        </select>
      </Field>
      <Field label="Грейд" htmlFor="v-grade">
        <select id="v-grade" className="input" value={v.grade} onChange={(e) => set({ grade: e.target.value })}>
          <option value="junior">Junior</option>
          <option value="middle">Middle</option>
          <option value="senior">Senior</option>
        </select>
      </Field>
      <Field label="Зарплата от, ₽ до НДФЛ (обязательно)" htmlFor="v-sf" error={errors.salaryFrom}>
        <input id="v-sf" className="input font-mono" inputMode="numeric" value={v.salaryFrom} onChange={(e) => set({ salaryFrom: e.target.value })} />
      </Field>
      <Field label="Зарплата до, ₽ до НДФЛ (обязательно)" htmlFor="v-st" error={errors.salaryTo}>
        <input id="v-st" className="input font-mono" inputMode="numeric" value={v.salaryTo} onChange={(e) => set({ salaryTo: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Стек" htmlFor="v-stack">
          <StackInput id="v-stack" value={stack} onChange={setStack} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Описание" htmlFor="v-desc" error={errors.description}>
          <textarea id="v-desc" className="input min-h-28" value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
      </div>
      {err && <div className="sm:col-span-2"><Notice tone="error">{err}</Notice></div>}
      <Button type="submit">Опубликовать</Button>
    </form>
  );
}

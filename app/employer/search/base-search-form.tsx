"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StackInput } from "@/components/employer/stack-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

export function BaseSearchForm() {
  const router = useRouter();
  const [spec, setSpec] = useState("backend");
  const [grades, setGrades] = useState<string[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [format, setFormat] = useState("");
  const [city, setCity] = useState("");
  const [salaryTo, setSalaryTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await api<{ searchId: string }>("/api/v1/searches", {
        body: { specialization: spec, grades, stack, format: format || null, city: city || null, salaryTo: salaryTo ? Number(salaryTo) : null },
      });
      router.push(`/employer/searches/${r.searchId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка поиска");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="blank flex flex-col gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Специализация" htmlFor="spec">
          <select id="spec" className="input" value={spec} onChange={(e) => setSpec(e.target.value)}>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
            <option value="data">Data / ML</option>
            <option value="qa">QA</option>
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Грейды</legend>
          <div className="flex gap-1.5">
            {["junior", "middle", "senior"].map((g) => (
              <button key={g} type="button" aria-pressed={grades.includes(g)} onClick={() => setGrades(grades.includes(g) ? grades.filter((x) => x !== g) : [...grades, g])} className={cn("rounded-full border px-3 py-2 text-sm", grades.includes(g) ? "border-violet bg-violet text-white" : "border-gray")}>
                {g[0]!.toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <Field label="Стек" htmlFor="stack">
        <StackInput id="stack" value={stack} onChange={setStack} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Формат" htmlFor="format">
          <select id="format" className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">Любой</option>
            <option value="remote">Удалённо</option>
            <option value="hybrid">Гибрид</option>
            <option value="office">Офис</option>
          </select>
        </Field>
        <Field label="Город" htmlFor="city">
          <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="Бюджет до, ₽" htmlFor="salary">
          <input id="salary" className="input font-mono" inputMode="numeric" value={salaryTo} onChange={(e) => setSalaryTo(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Ищем…" : "Найти"}
      </Button>
    </form>
  );
}

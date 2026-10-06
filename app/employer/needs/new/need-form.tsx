"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StackInput } from "@/components/employer/stack-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";
import { chipState } from "@/components/ui/chip";

type Draft = {
  title: string;
  specialization: string;
  grade: string;
  stack: string[];
  salaryFrom: string;
  salaryTo: string;
  format: string;
  city: string;
  teamAbout: string;
};

const empty: Draft = { title: "", specialization: "backend", grade: "middle", stack: [], salaryFrom: "", salaryTo: "", format: "", city: "", teamAbout: "" };
const SPECS = [
  ["backend", "Backend"],
  ["frontend", "Frontend"],
  ["data", "Data / ML"],
  ["qa", "QA"],
  ["mobile", "Mobile"],
  ["devops", "DevOps"],
  ["analyst", "Аналитик"],
];

const toInt = (s: string) => {
  const n = Number(s.replace(/\s/g, ""));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

export function NeedForm() {
  const router = useRouter();
  const [tab, setTab] = useState<"form" | "text">("form");
  const [d, setD] = useState<Draft>(empty);
  const [rawText, setRawText] = useState("");
  const [parsedBy, setParsedBy] = useState<"form" | "llm" | "rules">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "info" | "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState<"parse" | "save" | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  async function parse() {
    setBusy("parse");
    setMsg(null);
    try {
      const r = await api<{ draft: Record<string, unknown>; parsedBy: "llm" | "rules" }>("/api/v1/needs/parse", { body: { text: rawText } });
      const x = r.draft as { title: string; specialization: string | null; grade: string | null; stack: string[]; salaryFrom: number | null; salaryTo: number | null; format: string | null; city: string | null; teamAbout: string | null };
      setD({
        title: x.title ?? "",
        specialization: x.specialization ?? "backend",
        grade: x.grade ?? "middle",
        stack: x.stack ?? [],
        salaryFrom: x.salaryFrom ? String(x.salaryFrom) : "",
        salaryTo: x.salaryTo ? String(x.salaryTo) : "",
        format: x.format ?? "",
        city: x.city ?? "",
        teamAbout: x.teamAbout ?? "",
      });
      setParsedBy(r.parsedBy);
      setTab("form");
      const noSalary = !x.salaryFrom || !x.salaryTo;
      setMsg({
        tone: noSalary ? "error" : "ok",
        text: `${r.parsedBy === "llm" ? "Текст разобран ИИ" : "Текст разобран по словарю и правилам (ИИ недоступен)"}. Проверьте поля перед сохранением.${noSalary ? " В тексте нет полной вилки зарплаты — укажите её." : ""}`,
      });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Не удалось разобрать текст" });
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setErrors({});
    try {
      const n = await api<{ id: string }>("/api/v1/needs", {
        body: {
          title: d.title,
          specialization: d.specialization,
          grade: d.grade,
          stack: d.stack,
          salaryFrom: toInt(d.salaryFrom),
          salaryTo: toInt(d.salaryTo),
          format: d.format || null,
          city: d.city || null,
          teamAbout: d.teamAbout || null,
          rawText: rawText || null,
          parsedBy,
        },
      });
      const s = await api<{ searchId: string }>(`/api/v1/needs/${n.id}/search`, { method: "POST" });
      router.push(`/employer/searches/${s.searchId}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Не удалось сохранить" });
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Способ ввода" className="flex gap-2">
        {(
          [
            ["form", "Заполнить форму"],
            ["text", "Вставить текст вакансии"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-full border px-4 py-2 text-sm", chipState(tab === k))}>
            {l}
          </button>
        ))}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {tab === "text" ? (
        <div className="blank flex flex-col gap-3 p-5">
          <Field label="Текст вакансии" htmlFor="raw">
            <textarea id="raw" className="input min-h-64 font-mono text-sm" value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Вставьте описание вакансии целиком: требования, стек, условия, зарплата…" />
          </Field>
          <Button onClick={parse} disabled={busy === "parse" || rawText.trim().length < 20}>
            {busy === "parse" ? "Разбираем… (до 20 секунд)" : "Разобрать"}
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="blank flex flex-col gap-4 p-5" noValidate>
          <Field label="Название позиции" htmlFor="title" error={errors.title}>
            <input id="title" className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} required aria-invalid={!!errors.title} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Специализация" htmlFor="spec">
              <select id="spec" className="input" value={d.specialization} onChange={(e) => set({ specialization: e.target.value })}>
                {SPECS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Грейд" htmlFor="grade">
              <select id="grade" className="input" value={d.grade} onChange={(e) => set({ grade: e.target.value })}>
                <option value="junior">Junior</option>
                <option value="middle">Middle</option>
                <option value="senior">Senior</option>
              </select>
            </Field>
          </div>
          <Field label="Стек" htmlFor="stack" hint="Enter или запятая — добавить">
            <StackInput id="stack" value={d.stack} onChange={(stack) => set({ stack })} />
          </Field>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-1.5 text-sm font-medium">Вилка зарплаты, ₽ в месяц (обязательно)</legend>
            <Field label="От" htmlFor="sf" error={errors.salaryFrom}>
              <input id="sf" className="input font-mono" inputMode="numeric" value={d.salaryFrom} onChange={(e) => set({ salaryFrom: e.target.value })} required aria-invalid={!!errors.salaryFrom} />
            </Field>
            <Field label="До" htmlFor="st" error={errors.salaryTo}>
              <input id="st" className="input font-mono" inputMode="numeric" value={d.salaryTo} onChange={(e) => set({ salaryTo: e.target.value })} required aria-invalid={!!errors.salaryTo} />
            </Field>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Формат" htmlFor="format">
              <select id="format" className="input" value={d.format} onChange={(e) => set({ format: e.target.value })}>
                <option value="">Любой</option>
                <option value="remote">Удалённо</option>
                <option value="hybrid">Гибрид</option>
                <option value="office">Офис</option>
              </select>
            </Field>
            <Field label="Город" htmlFor="city">
              <input id="city" className="input" value={d.city} onChange={(e) => set({ city: e.target.value })} />
            </Field>
          </div>
          <Field label="О команде и задачах" htmlFor="team">
            <textarea id="team" className="input min-h-24" value={d.teamAbout} onChange={(e) => set({ teamAbout: e.target.value })} />
          </Field>
          <Button type="submit" size="lg" disabled={busy === "save"}>
            {busy === "save" ? "Сохраняем и подбираем…" : "Сохранить и подобрать кандидатов"}
          </Button>
        </form>
      )}
    </div>
  );
}

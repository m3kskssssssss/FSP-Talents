"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";

const empty = { title: "", statement: "", specialization: "backend", grade: "", kind: "open", expectedAnswer: "" };

export function ChallengeForm() {
  const router = useRouter();
  const [v, setV] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setErr(null);
    setDone(false);
    try {
      await api("/api/v1/challenges", {
        body: { ...v, grade: v.grade || null, expectedAnswer: v.kind === "exact" ? v.expectedAnswer : null },
      });
      setV(empty);
      setDone(true);
      router.refresh();
    } catch (x) {
      setErrors(fieldErrors(x));
      setErr(x instanceof ApiError ? x.message : "Ошибка");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <Field label="Название" htmlFor="c-title" error={errors.title}>
          <input id="c-title" className="input" value={v.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
      </div>
      <Field label="Специализация" htmlFor="c-spec">
        <select id="c-spec" className="input" value={v.specialization} onChange={(e) => set({ specialization: e.target.value })}>
          <option value="backend">Backend</option>
          <option value="frontend">Frontend</option>
          <option value="data">Data / ML</option>
          <option value="qa">QA</option>
        </select>
      </Field>
      <Field label="Грейд" htmlFor="c-grade">
        <select id="c-grade" className="input" value={v.grade} onChange={(e) => set({ grade: e.target.value })}>
          <option value="">Все грейды</option>
          <option value="junior">Junior</option>
          <option value="middle">Middle</option>
          <option value="senior">Senior</option>
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Условие" htmlFor="c-statement" error={errors.statement}>
          <textarea id="c-statement" className="input min-h-32" value={v.statement} onChange={(e) => set({ statement: e.target.value })} />
        </Field>
      </div>
      <Field label="Как проверять" htmlFor="c-kind">
        <select id="c-kind" className="input" value={v.kind} onChange={(e) => set({ kind: e.target.value })}>
          <option value="open">Предложить подход — оцениваю сам (0–3)</option>
          <option value="exact">Точный ответ — проверяет система</option>
        </select>
      </Field>
      {v.kind === "exact" && (
        <Field label="Эталонный ответ (кандидаты его не видят)" htmlFor="c-expected" error={errors.expectedAnswer}>
          <input id="c-expected" className="input font-mono" value={v.expectedAnswer} onChange={(e) => set({ expectedAnswer: e.target.value })} />
        </Field>
      )}
      {err && (
        <div className="sm:col-span-2">
          <Notice tone="error">{err}</Notice>
        </div>
      )}
      {done && (
        <div className="sm:col-span-2">
          <Notice tone="ok">Задача опубликована: кандидаты категории получат её в порядке очереди.</Notice>
        </div>
      )}
      <Button type="submit">Опубликовать задачу</Button>
    </form>
  );
}

export function GradeForm({ id }: { id: string }) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send() {
    if (score === null) return;
    setPending(true);
    setErr(null);
    try {
      await api(`/api/v1/challenges/submissions/${id}/grade`, { body: { score, feedback: feedback || null } });
      router.refresh();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Оценка">
        {[0, 1, 2, 3].map((n) => (
          <Button key={n} size="sm" variant={score === n ? "primary" : "secondary"} onClick={() => setScore(n)} aria-pressed={score === n}>
            {n}
          </Button>
        ))}
        <input
          className="input min-w-0 flex-1 basis-full text-sm sm:basis-auto"
          placeholder="Комментарий кандидату (необязательно)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          aria-label="Комментарий"
        />
        <Button size="sm" disabled={pending || score === null} onClick={send}>
          Оценить
        </Button>
      </div>
      {err && <Notice tone="error">{err}</Notice>}
    </div>
  );
}

export function CloseChallenge({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api(`/api/v1/challenges/${id}/close`, { body: {} });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      Закрыть
    </Button>
  );
}

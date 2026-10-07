"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExperienceTimeline } from "@/components/candidate/experience";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";
import type { WorkItem } from "@/server/db/schema";

type Draft = {
  company: string;
  role: string;
  from: string;
  to: string;
  current: boolean;
  summary: string;
  stack: string;
};
const empty: Draft = {
  company: "",
  role: "",
  from: "",
  to: "",
  current: false,
  summary: "",
  stack: "",
};

const toDraft = (w: WorkItem): Draft => ({
  company: w.company,
  role: w.role,
  from: w.from,
  to: w.to ?? "",
  current: w.to === null,
  summary: w.summary ?? "",
  stack: (w.stack ?? []).join(", "),
});
const fromDraft = (d: Draft): WorkItem => ({
  company: d.company.trim(),
  role: d.role.trim(),
  from: d.from,
  to: d.current ? null : d.to,
  summary: d.summary.trim() || undefined,
  stack: d.stack
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
});

/** Work history: the timeline with edit / delete per job and an inline form. Every change is saved at once. */
export function ExperienceEditor({ initial }: { initial: WorkItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  // null — form closed; -1 — adding a new job; n — editing job n
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  async function persist(next: WorkItem[], okText: string, index?: number) {
    setBusy(true);
    setMsg(null);
    setErrors({});
    try {
      await api("/api/v1/me/experience", { method: "PUT", body: { items: next } });
      // the server stores newest first; mirror that
      setItems(
        [...next].sort(
          (a, b) =>
            (b.to ?? "9999-99").localeCompare(a.to ?? "9999-99") || b.from.localeCompare(a.from),
        ),
      );
      setEditing(null);
      setMsg({ tone: "ok", text: okText });
      router.refresh();
    } catch (e) {
      // errors come back as items.<n>.field; show the ones for the job being edited
      const all = fieldErrors(e);
      const prefix = `items.${index ?? -1}.`;
      setErrors(
        Object.fromEntries(
          Object.entries(all)
            .filter(([k]) => k.startsWith(prefix))
            .map(([k, v]) => [k.slice(prefix.length), v]),
        ),
      );
      setMsg({
        tone: "error",
        text: e instanceof ApiError ? e.message : "Не удалось сохранить. Попробуйте ещё раз.",
      });
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!draft.company.trim()) local.company = "Укажите компанию";
    if (!draft.role.trim()) local.role = "Укажите должность";
    if (!draft.from) local.from = "Укажите месяц начала";
    if (!draft.current && !draft.to)
      local.to = "Укажите месяц окончания или отметьте «работаю сейчас»";
    if (!draft.current && draft.to && draft.from && draft.to < draft.from)
      local.to = "Окончание раньше начала";
    if (Object.keys(local).length) return setErrors(local);
    const item = fromDraft(draft);
    if (editing === -1) void persist([...items, item], "Место работы добавлено.", items.length);
    else if (editing !== null)
      void persist(
        items.map((w, i) => (i === editing ? item : w)),
        "Изменения сохранены.",
        editing,
      );
  }

  const open = (i: number) => {
    setErrors({});
    setMsg(null);
    setDraft(i === -1 ? empty : toDraft(items[i]!));
    setEditing(i);
  };

  const form = (
    <form
      onSubmit={submit}
      noValidate
      className="border-accent/30 bg-subtle flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <p className="font-medium">{editing === -1 ? "Новое место работы" : "Редактирование"}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Компания" htmlFor="w-company" error={errors.company}>
          <input
            id="w-company"
            className="input"
            value={draft.company}
            onChange={(e) => set({ company: e.target.value })}
            aria-invalid={!!errors.company}
          />
        </Field>
        <Field label="Должность" htmlFor="w-role" error={errors.role}>
          <input
            id="w-role"
            className="input"
            value={draft.role}
            onChange={(e) => set({ role: e.target.value })}
            aria-invalid={!!errors.role}
          />
        </Field>
        <Field label="Начало" htmlFor="w-from" error={errors.from}>
          <input
            id="w-from"
            type="month"
            className="input font-mono"
            value={draft.from}
            onChange={(e) => set({ from: e.target.value })}
            aria-invalid={!!errors.from}
          />
        </Field>
        <Field label="Окончание" htmlFor="w-to" error={errors.to}>
          <input
            id="w-to"
            type="month"
            className="input font-mono"
            value={draft.current ? "" : draft.to}
            disabled={draft.current}
            onChange={(e) => set({ to: e.target.value })}
            aria-invalid={!!errors.to}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.current}
          onChange={(e) => set({ current: e.target.checked })}
          className="size-4"
        />
        Работаю здесь сейчас
      </label>
      <Field
        label="Чем занимались"
        htmlFor="w-summary"
        hint="Задачи и результаты: что сделали, что улучшили, какие цифры."
      >
        <textarea
          id="w-summary"
          className="input min-h-24"
          value={draft.summary}
          onChange={(e) => set({ summary: e.target.value })}
          maxLength={1000}
        />
      </Field>
      <Field label="Стек" htmlFor="w-stack" hint="Через запятую: Python, PostgreSQL, Docker">
        <input
          id="w-stack"
          className="input"
          value={draft.stack}
          onChange={(e) => set({ stack: e.target.value })}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </Button>
        <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
          Отмена
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {items.length > 0 ? (
        <ExperienceTimeline
          items={items}
          actions={(i) =>
            editing === i ? (
              <div className="w-full">{form}</div>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => open(i)} disabled={busy}>
                  Изменить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void persist(
                      items.filter((_, k) => k !== i),
                      "Место работы удалено.",
                    )
                  }
                  disabled={busy}
                >
                  Удалить
                </Button>
              </>
            )
          }
        />
      ) : (
        editing !== -1 && (
          <EmptyState title="Опыт работы не указан">
            Добавьте прошлые места работы — работодатель увидит их на таймлайне в вашем профиле.
            Контакты сюда писать не нужно.
          </EmptyState>
        )
      )}
      {editing === -1 ? (
        form
      ) : (
        <div>
          <Button
            variant="secondary"
            onClick={() => open(-1)}
            disabled={busy || items.length >= 20}
          >
            + Добавить место работы
          </Button>
        </div>
      )}
    </div>
  );
}

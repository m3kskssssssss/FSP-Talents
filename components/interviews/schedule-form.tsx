"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Notice } from "@/components/ui/field";
import { api, ApiError, fieldErrors } from "@/lib/api-client";

const pad = (n: number) => String(n).padStart(2, "0");
/** `<input type="datetime-local">` value in the browser's time zone. */
const localValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Tomorrow at the same hour, rounded up to the next full hour. */
function defaultStart() {
  const d = new Date(Date.now() + 24 * 3600_000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return localValue(d);
}

export function ScheduleForm({ chatId, candidate }: { chatId: string; candidate: string }) {
  const router = useRouter();
  const [at, setAt] = useState(defaultStart);
  const [duration, setDuration] = useState("60");
  const [language, setLanguage] = useState("python");
  const [task, setTask] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setError(null);
    const when = new Date(at);
    if (!at || Number.isNaN(when.getTime())) {
      setErrors({ scheduledAt: "Укажите дату и время" });
      return;
    }
    setPending(true);
    try {
      const r = await api<{ id: string }>(`/api/v1/chats/${chatId}/interviews`, {
        body: { scheduledAt: when.toISOString(), durationMin: Number(duration), language, task },
      });
      router.push(`/employer/interviews/${r.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "Не удалось назначить собеседование");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="blank flex flex-col gap-4 p-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Дата и время"
          htmlFor="at"
          error={errors.scheduledAt}
          hint="В вашем часовом поясе; кандидат увидит время в своём"
        >
          <input
            id="at"
            type="datetime-local"
            className="input font-mono"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            required
            aria-invalid={!!errors.scheduledAt}
          />
        </Field>
        <Field label="Длительность" htmlFor="duration" error={errors.durationMin}>
          <select
            id="duration"
            className="input"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="30">30 минут</option>
            <option value="45">45 минут</option>
            <option value="60">1 час</option>
            <option value="90">1,5 часа</option>
            <option value="120">2 часа</option>
          </select>
        </Field>
      </div>
      <Field
        label="Язык общего редактора"
        htmlFor="language"
        hint="Его можно поменять прямо во время звонка"
      >
        <select
          id="language"
          className="input"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="sql">SQL</option>
        </select>
      </Field>
      <Field
        label="Задание для live-coding"
        htmlFor="task"
        error={errors.task}
        hint="Необязательно. Кандидат увидит его только в комнате собеседования"
      >
        <textarea
          id="task"
          className="input min-h-32"
          value={task}
          maxLength={4000}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Например: напишите функцию, которая находит первый неповторяющийся символ в строке"
        />
      </Field>
      <Notice>
        {candidate} получит уведомление и сообщение в чате. Комната откроется за 15 минут до начала:
        видео, звук и общий редактор кода прямо в браузере.
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Назначаем…" : "Назначить собеседование"}
      </Button>
    </form>
  );
}

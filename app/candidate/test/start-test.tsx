"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/field";
import { gradeTitle } from "@/lib/format";
import { api, ApiError } from "@/lib/api-client";

type Grade = "junior" | "middle" | "senior";
type Elig = { ok: true } | { ok: false; code: string; message: string };

export function StartTest({ specialization, grades }: { specialization: string; grades: { grade: Grade; eligibility: Elig }[] }) {
  const firstOk = grades.find((g) => g.eligibility.ok)?.grade ?? null;
  const [grade, setGrade] = useState<Grade | null>(firstOk);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    if (!grade) return;
    setPending(true);
    setError(null);
    try {
      const r = await api<{ attemptId: string }>("/api/v1/tests/attempts", {
        body: { specialization, grade, acknowledgeMonitoring: true },
      });
      // Full page load: the test page must be cross-origin isolated (COOP/COEP).
      window.location.href = `/test/${r.attemptId}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось начать тест");
      setPending(false);
    }
  }

  const id = `ack-${specialization}`;
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Грейд</legend>
        <div className="grid grid-cols-3 gap-2">
          {grades.map(({ grade: g, eligibility }) => (
            <label
              key={g}
              title={eligibility.ok ? undefined : eligibility.message}
              className={cn(
                "flex flex-col items-center rounded-xl border px-2 py-2.5 text-sm transition-colors",
                !eligibility.ok && "cursor-not-allowed border-dashed border-gray text-muted",
                eligibility.ok && grade === g && "border-violet bg-violet-50 text-violet",
                eligibility.ok && grade !== g && "cursor-pointer border-gray hover:border-violet/50",
              )}
            >
              <input type="radio" className="sr-only" name={`grade-${specialization}`} disabled={!eligibility.ok} checked={grade === g} onChange={() => setGrade(g)} />
              {gradeTitle(g)}
            </label>
          ))}
        </div>
        {grades.filter((g) => !g.eligibility.ok).map((g) => (
          <p key={g.grade} className="mt-2 text-xs text-muted">
            {gradeTitle(g.grade)}: {(g.eligibility as { message: string }).message}
          </p>
        ))}
      </fieldset>
      <details className="rounded-xl border border-violet/20 p-3 text-sm">
        <summary className="cursor-pointer font-medium">Правила прохождения</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-muted">
          <li>Тест идёт в полноэкранном режиме; на всё — 60 минут.</li>
          <li>Копировать условие нельзя. Вставки в редактор, уходы со вкладки и выходы из полноэкранного режима записываются в журнал попытки.</li>
          <li>Журнал влияет только на индекс доверия к попытке. Автоматических блокировок нет: при сомнениях попытку посмотрит модератор.</li>
          <li>Код запускается в вашем браузере. Итоговая проверка — на скрытых данных, сгенерированных в момент отправки.</li>
          <li>Тот же грейд можно пересдать через 14 дней, грейд ниже — сразу, грейд выше — после результата от 25/30.</li>
        </ul>
      </details>
      <label htmlFor={id} className="flex items-start gap-2.5 text-sm">
        <input id={id} type="checkbox" className="mt-0.5 size-4 accent-violet" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>Я ознакомлен(а) с правилами и согласен(на) на запись журнала попытки</span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button onClick={start} disabled={!grade || !ack || pending}>
        {pending ? "Готовим вариант…" : grade ? `Начать тест ${gradeTitle(grade)}` : "Нет доступных грейдов"}
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/field";
import { gradeTitle } from "@/lib/format";
import { TEST_CONFIG } from "@/server/config";
import { api, ApiError } from "@/lib/api-client";

type Grade = "junior" | "middle" | "senior";
const TEST_CONFIG_EXPRESS = TEST_CONFIG.express;
type Elig = { ok: true } | { ok: false; code: string; message: string };

export function StartTest({
  specialization,
  grades,
  preferred,
  express = false,
}: {
  specialization: string;
  grades: { grade: Grade; eligibility: Elig }[];
  preferred?: string;
  /** Demo mode: offer the short express check. */
  express?: boolean;
}) {
  const firstOk = grades.find((g) => g.grade === preferred && g.eligibility.ok)?.grade ?? grades.find((g) => g.eligibility.ok)?.grade ?? null;
  const [grade, setGrade] = useState<Grade | null>(firstOk);
  // Express checks ignore retake cooldowns, so any grade can be picked for them.
  const [expressGrade, setExpressGrade] = useState<Grade>(firstOk ?? (preferred as Grade) ?? "middle");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start(mode: "full" | "express" = "full") {
    const g = mode === "express" ? expressGrade : grade;
    if (!g) return;
    setPending(true);
    setError(null);
    try {
      const r = await api<{ attemptId: string }>("/api/v1/tests/attempts", {
        body: { specialization, grade: g, mode, acknowledgeMonitoring: true },
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
          <li>Первые 7 дней после первого теста грейд можно уточнять свободно; потом категория повышается не чаще раза в 90 дней.</li>
        </ul>
      </details>
      <label htmlFor={id} className="flex items-start gap-2.5 text-sm">
        <input id={id} type="checkbox" className="mt-0.5 size-4 accent-violet" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>Я ознакомлен(а) с правилами и согласен(на) на запись журнала попытки</span>
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button onClick={() => start("full")} disabled={!grade || !ack || pending}>
        {pending ? "Готовим вариант…" : grade ? `Начать тест ${gradeTitle(grade)}` : "Нет доступных грейдов"}
      </Button>
      {express && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-violet/40 p-3 text-sm">
          <p>
            <span className="font-medium">Экспресс-проверка для демо</span> — {TEST_CONFIG_EXPRESS.maxItems} коротких заданий без кода, до {TEST_CONFIG_EXPRESS.durationMinutes} минут.
            Тот же адаптивный движок и шкала, категория помечается «экспресс-проверка». Не влияет на пересдачи и калибровку банка.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Грейд экспресс-проверки" className="input w-auto py-1.5" value={expressGrade} onChange={(e) => setExpressGrade(e.target.value as Grade)}>
              {grades.map(({ grade: g }) => (
                <option key={g} value={g}>
                  {gradeTitle(g)}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={() => start("express")} disabled={!ack || pending}>
              Пройти экспресс-проверку
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

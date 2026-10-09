"use client";

import { useState } from "react";
import { DesktopOnlyNotice, useIsDesktop } from "@/components/layout/desktop-only";
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
  const firstOk =
    grades.find((g) => g.grade === preferred && g.eligibility.ok)?.grade ??
    grades.find((g) => g.eligibility.ok)?.grade ??
    null;
  const [grade, setGrade] = useState<Grade | null>(firstOk);
  // Express checks ignore retake cooldowns, so any grade can be picked for them.
  const expressGrades = grades
    .filter(({ eligibility: e }) => e.ok || e.code !== "below_category")
    .map((g) => g.grade);
  const [expressGrade, setExpressGrade] = useState<Grade>(
    firstOk ?? expressGrades.find((g) => g === preferred) ?? expressGrades[0] ?? "middle",
  );
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const desktop = useIsDesktop();
  const blocked = desktop === false;

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
                !eligibility.ok && "border-line text-muted cursor-not-allowed border-dashed",
                eligibility.ok && grade === g && "border-accent bg-accent-soft text-accent",
                eligibility.ok &&
                  grade !== g &&
                  "border-line hover:border-accent/50 cursor-pointer",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={`grade-${specialization}`}
                disabled={!eligibility.ok}
                checked={grade === g}
                onChange={() => setGrade(g)}
              />
              {gradeTitle(g)}
            </label>
          ))}
        </div>
        {grades
          .filter((g) => !g.eligibility.ok)
          .map((g) => (
            <p key={g.grade} className="text-muted mt-2 text-xs">
              {gradeTitle(g.grade)}: {(g.eligibility as { message: string }).message}
            </p>
          ))}
      </fieldset>
      <label htmlFor={id} className="flex items-start gap-2.5 text-sm">
        <input
          id={id}
          type="checkbox"
          className="accent-primary mt-0.5 size-4"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        <span>
          Я ознакомлен(а) с правилами прохождения и согласен(на) на запись журнала попытки
        </span>
      </label>
      {blocked && (
        <DesktopOnlyNotice>
          Тест проходится с компьютера: там удобно писать код, а условия одинаковы для всех.
          Откройте эту страницу на ПК.
        </DesktopOnlyNotice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <Button onClick={() => start("full")} disabled={!grade || !ack || pending || blocked}>
        {pending
          ? "Готовим вариант…"
          : grade
            ? `Начать тест ${gradeTitle(grade)}`
            : "Нет доступных грейдов"}
      </Button>
      {express && (
        <div className="border-accent/15 flex flex-wrap items-center gap-2 border-t pt-4 text-sm">
          <span className="text-muted mr-auto">
            Экспресс · {TEST_CONFIG_EXPRESS.maxItems} заданий, до{" "}
            {TEST_CONFIG_EXPRESS.durationMinutes} мин
          </span>
          <select
            aria-label="Грейд экспресс-проверки"
            className="input w-auto py-1.5"
            value={expressGrade}
            onChange={(e) => setExpressGrade(e.target.value as Grade)}
          >
            {expressGrades.map((g) => (
              <option key={g} value={g}>
                {gradeTitle(g)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => start("express")}
            disabled={!ack || pending || blocked}
          >
            Пройти экспресс
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ProfileForm, type ProfileValues } from "@/components/candidate/profile-form";
import { PageTitle } from "@/components/ui/blank";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

const SPECS = [
  { v: "backend", t: "Backend", d: "Серверная разработка, API, базы данных" },
  { v: "frontend", t: "Frontend", d: "Интерфейсы, JavaScript/TypeScript, React" },
  { v: "data", t: "Data / ML", d: "Анализ данных, SQL, машинное обучение" },
  { v: "qa", t: "QA", d: "Тестирование, автотесты, качество" },
];
const INTERESTS = ["Высокие нагрузки", "Финтех", "E-commerce", "EdTech", "Госсектор", "Игры", "ИИ и ML-продукты", "Информационная безопасность", "Стартапы", "Наставничество"];
const GRADES = [
  { v: "junior", t: "Junior", d: "Решаю типовые задачи, знаю основы языка, SQL и инструментов, нужна поддержка в сложных случаях." },
  { v: "middle", t: "Middle", d: "Самостоятельно веду задачи от постановки до продакшена, понимаю архитектуру и компромиссы." },
  { v: "senior", t: "Senior", d: "Проектирую системы, отвечаю за надёжность и производительность, решаю нестандартные задачи." },
];

export function Wizard({ initial, survey }: { initial: ProfileValues; survey: { specialization?: string; interests?: string[]; yearsInSpec?: number } }) {
  const [step, setStep] = useState(1);
  const [spec, setSpec] = useState(survey.specialization ?? "backend");
  const [interests, setInterests] = useState<string[]>(survey.interests ?? []);
  const [years, setYears] = useState(survey.yearsInSpec !== undefined ? String(survey.yearsInSpec) : "");
  const [grade, setGrade] = useState("middle");
  const [error, setError] = useState<string | null>(null);

  async function saveSurvey() {
    setError(null);
    try {
      await api("/api/v1/me/profile", {
        method: "PUT",
        body: { fullName: initial.fullName || "Кандидат", survey: { specialization: spec, interests, yearsInSpec: years ? Number(years) : undefined } },
      });
      setStep(3);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Ошибка");
    }
  }

  async function finish() {
    await api("/api/v1/me/profile", { method: "PUT", body: { fullName: initial.fullName || "Кандидат", onboarded: true } }).catch(() => null);
    window.location.href = `/candidate/test?spec=${spec}&grade=${grade}`;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle kicker={`Шаг ${step} из 3`} title={step === 1 ? "Расскажите о себе" : step === 2 ? "Короткий опрос" : "Выберите грейд"}>
        {step === 1 && "Профиль увидят работодатели — без контактов. Контакты откроются только той компании, чьё приглашение вы примете."}
        {step === 2 && "Поможет предложить подходящий тест и интересные вам компании."}
        {step === 3 && "Грейд выбираете вы. Тест проверит выбор: по результату вы получите категорию, а при уверенном результате в первую неделю сможете сразу попробовать грейд выше."}
      </PageTitle>
      <ol className="mb-6 flex gap-2" aria-label="Шаги">
        {[1, 2, 3].map((n) => (
          <li key={n} className={cn("h-1.5 flex-1 rounded-full", n <= step ? "bg-violet" : "bg-violet-50")} aria-current={n === step ? "step" : undefined} />
        ))}
      </ol>
      {step === 1 && <ProfileForm initial={initial} submitLabel="Дальше" onSaved={() => setStep(2)} />}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="mb-2 font-medium">В какой сфере хотите работать?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SPECS.map((s) => (
                <label key={s.v} className={cn("blank flex cursor-pointer flex-col gap-1 p-4", spec === s.v && "border-violet bg-violet-50")}>
                  <span className="flex items-center gap-2 font-medium">
                    <input type="radio" name="spec" className="accent-violet" checked={spec === s.v} onChange={() => setSpec(s.v)} />
                    {s.t}
                  </span>
                  <span className="text-sm text-muted">{s.d}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Mobile, DevOps и аналитика появятся в следующих версиях банка заданий.</p>
          </fieldset>
          <fieldset>
            <legend className="mb-2 font-medium">Что интересно?</legend>
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.map((i) => (
                <button key={i} type="button" aria-pressed={interests.includes(i)} onClick={() => setInterests(interests.includes(i) ? interests.filter((x) => x !== i) : [...interests, i])} className={cn("rounded-full border px-3 py-1.5 text-sm", interests.includes(i) ? "border-violet bg-violet text-white" : "border-gray hover:border-violet/50")}>
                  {i}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="max-w-xs">
            <label htmlFor="years" className="mb-1.5 block font-medium">
              Сколько лет работаете в этой сфере?
            </label>
            <input id="years" className="input font-mono" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)} />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Назад
            </Button>
            <Button size="lg" onClick={saveSurvey}>
              Дальше
            </Button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {GRADES.map((g) => (
              <label key={g.v} className={cn("blank flex cursor-pointer flex-col gap-2 p-4", grade === g.v && "border-violet bg-violet-50")}>
                <span className="flex items-center gap-2 text-lg font-medium text-violet">
                  <input type="radio" name="grade" className="accent-violet" checked={grade === g.v} onChange={() => setGrade(g.v)} />
                  {g.t}
                </span>
                <span className="text-sm text-muted">{g.d}</span>
              </label>
            ))}
          </div>
          <Notice>Не получилось — сразу можно пройти грейд ниже; тот же грейд — через 14 дней. Понижение не принудительное.</Notice>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← Назад
            </Button>
            <Button size="lg" onClick={finish}>
              К тесту
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";
import { categoryTitle, dateTime, gradeTitle } from "@/lib/format";
import { GRADES, TEST_CONFIG } from "@/server/config";
import { requireCandidate } from "@/server/http/guard";
import { getAttempt } from "@/server/services/testing";

export const metadata: Metadata = { title: "Результат теста" };
export const dynamic = "force-dynamic";

const statusText = { finished: "Завершена", expired: "Время истекло", abandoned: "Завершена досрочно", in_progress: "Идёт" } as const;

export default async function AttemptResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireCandidate();
  const a = await getAttempt(me.profileId, id);
  if (a.status === "in_progress") {
    return (
      <div>
        <PageTitle kicker="Тест" title="Попытка ещё идёт" />
        <a href={`/test/${id}`} className={buttonClass("primary", "lg")}>
          Вернуться к тесту
        </a>
      </div>
    );
  }
  const r = a.result!;
  const passed = r.result !== "failed";
  const nextGrade = GRADES[GRADES.indexOf(a.grade) + 1];
  const pct = Math.min(100, (r.score / TEST_CONFIG.scaleMax) * 100);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle kicker={`${statusText[a.status]} · ${dateTime(a.startedAt)}`} title={passed ? "Тест сдан" : "Тест не сдан"}>
        {categoryTitle(a.specialization, a.grade)} · отвечено заданий: {a.answered}
      </PageTitle>

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <Blank label="Результат">
          <p className="font-mono text-5xl text-violet">
            {r.score.toFixed(1)}
            <span className="text-2xl text-muted">/{TEST_CONFIG.scaleMax}</span>
          </p>
          <div className="relative mt-4 h-2 rounded-full bg-violet-50" aria-hidden="true">
            <div className="h-full rounded-full bg-violet" style={{ width: `${pct}%` }} />
            <span className="absolute -top-1 h-4 w-px bg-graphite" style={{ left: `${(TEST_CONFIG.passScore / 30) * 100}%` }} />
            <span className="absolute -top-1 h-4 w-px bg-ok" style={{ left: `${(TEST_CONFIG.confidentScore / 30) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Порог: {TEST_CONFIG.passScore}/30 · уверенно: {TEST_CONFIG.confidentScore}/30. Балл — ожидаемое число верных ответов на эталонном бланке грейда из 30 заданий
            (по оценке способности θ = {r.theta.toFixed(2)} ± {r.se.toFixed(2)}).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {r.result === "passed_confident" && <Badge tone="ok">Уверенно сдан</Badge>}
            {r.result === "passed" && <Badge tone="ok">Сдан</Badge>}
            {r.result === "failed" && <Badge tone="gray">Не сдан</Badge>}
            {r.trustLevel === "medium" && <Badge tone="warn">Индекс доверия: средний</Badge>}
            {r.trustLevel === "low" && <Badge tone="red">Нужна перепроверка</Badge>}
          </div>
        </Blank>

        <Blank label="Что дальше">
          {passed && r.categoryAssigned && (
            <Notice tone="ok">
              Вам присвоена категория <strong>{categoryTitle(a.specialization, a.grade)}</strong>. Теперь работодатели видят вас в подборках.
            </Notice>
          )}
          {passed && !r.categoryAssigned && r.trustLevel !== "low" && (
            <Notice>У вас уже есть категория выше — она сохраняется.</Notice>
          )}
          {r.trustLevel === "low" && (
            <Notice tone="error">
              В журнале попытки много сигналов несамостоятельного прохождения, поэтому категория пока не присвоена. Модератор посмотрит попытку; вы также можете
              пройти тест повторно. Блокировок нет.
            </Notice>
          )}
          <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {r.result === "passed_confident" && nextGrade && <li>Можно сразу попробовать {gradeTitle(nextGrade)}.</li>}
            {r.result === "passed" && nextGrade && <li>Для перехода на {gradeTitle(nextGrade)} нужен результат от 25/30 — пересдать этот грейд можно через 14 дней.</li>}
            {r.result === "failed" && GRADES.indexOf(a.grade) > 0 && <li>Грейд ниже можно пройти сразу — понижение не принудительное.</li>}
            {r.result === "failed" && <li>Пересдать {gradeTitle(a.grade)} можно через {TEST_CONFIG.retrySameGradeDays} дней.</li>}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/candidate/test" className={buttonClass("primary")}>
              К тестам
            </Link>
            <Link href="/candidate" className={buttonClass("secondary")}>
              В кабинет
            </Link>
          </div>
        </Blank>
      </div>
    </div>
  );
}

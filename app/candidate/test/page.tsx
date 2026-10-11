import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { buttonClass } from "@/components/ui/button";
import { categoryTitle, dateTime, gradeTitle, specTitle } from "@/lib/format";
import { TEST_CONFIG } from "@/server/config";
import { requireCandidate } from "@/server/http/page-guard";
import { availability } from "@/server/services/testing";
import { StartTest } from "./start-test";

export const metadata: Metadata = { title: "Тесты" };
export const dynamic = "force-dynamic";

const resultBadge = {
  passed_confident: ["Уверенно сдан", "ok"],
  passed: ["Сдан", "ok"],
  failed: ["Не сдан", "gray"],
} as const;

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ spec?: string; grade?: string }>;
}) {
  const { spec, grade } = await searchParams;
  const me = await requireCandidate();
  const specs = await availability(me.profileId);
  return (
    <div>
      <PageTitle title="Выберите специализацию и грейд">
        Грейд вы выбираете сами. Тест адаптивный: {TEST_CONFIG.minItems}–{TEST_CONFIG.maxItems}{" "}
        заданий, до {TEST_CONFIG.durationMinutes} минут, вариант уникален для каждой попытки. По
        результату вы получите категорию — только с ней вас увидят работодатели.
      </PageTitle>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <details className="border-accent/25 bg-surface self-start rounded-xl border px-4 py-3 text-sm">
          <summary className="marker:text-accent cursor-pointer font-medium">
            Правила прохождения
          </summary>
          <ul className="text-muted mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>Тест идёт в полноэкранном режиме; на всё — {TEST_CONFIG.durationMinutes} минут.</li>
            <li>
              Копировать условие нельзя. Вставки в редактор, уходы со вкладки и выходы из
              полноэкранного режима записываются в журнал попытки.
            </li>
            <li>
              Журнал влияет только на индекс доверия к попытке. Автоматических блокировок нет: при
              сомнениях попытку посмотрит модератор.
            </li>
            <li>
              Код запускается в вашем браузере. Итоговая проверка — на скрытых данных,
              сгенерированных в момент отправки.
            </li>
            <li>
              Тот же грейд можно пересдать через 14 дней, грейд ниже — сразу (но не ниже вашей
              категории: такой тест её не изменит), грейд выше — после результата от 25/30.
            </li>
            <li>
              Первые 7 дней после первого теста грейд можно уточнять свободно; потом категория
              повышается не чаще раза в 90 дней.
            </li>
          </ul>
        </details>
        {specs.some((s) => s.expressAvailable) && (
          <div className="border-accent/40 text-muted rounded-xl border border-dashed px-4 py-3 text-sm">
            <span className="text-fg font-medium">Экспресс-проверка для демо</span> —{" "}
            {TEST_CONFIG.express.maxItems} коротких заданий без кода, до{" "}
            {TEST_CONFIG.express.durationMinutes} минут. Тот же адаптивный движок и шкала, категория
            помечается «экспресс-проверка». Не влияет на пересдачи и калибровку банка.
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {specs.map((s) => (
          <Blank
            key={s.specialization}
            className={
              spec === s.specialization ? "border-accent ring-accent/20 ring-2" : undefined
            }
            label={specTitle(s.specialization)}
            aside={
              s.category ? (
                <Badge tone="solid">
                  {categoryTitle(s.category.specialization, s.category.grade)}
                </Badge>
              ) : null
            }
          >
            {s.inProgress ? (
              <a href={`/test/${s.inProgress}`} className={buttonClass("primary", "md")}>
                Продолжить начатую попытку
              </a>
            ) : (
              <StartTest
                specialization={s.specialization}
                grades={s.grades}
                preferred={spec === s.specialization ? grade : undefined}
                express={s.expressAvailable}
              />
            )}
            {s.attempts.length > 0 && (
              <div className="border-accent/15 mt-5 border-t pt-4">
                <p className="label-mono mb-2">История</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {s.attempts.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted font-mono text-xs">{dateTime(a.startedAt)}</span>
                      <span>
                        {gradeTitle(a.grade)}
                        {a.mode === "express" && <span className="text-muted"> · экспресс</span>}
                      </span>
                      {a.result && (
                        <Badge tone={resultBadge[a.result][1]}>{resultBadge[a.result][0]}</Badge>
                      )}
                      {a.score !== null && (
                        <span className="font-mono text-xs">{a.score.toFixed(1)}/30</span>
                      )}
                      {a.status !== "in_progress" && (
                        <Link className="link ml-auto text-xs" href={`/candidate/attempts/${a.id}`}>
                          Подробнее
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Blank>
        ))}
      </div>
    </div>
  );
}

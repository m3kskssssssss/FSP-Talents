import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { categoryTitle, dateTime, gradeTitle, specTitle } from "@/lib/format";
import { TEST_CONFIG } from "@/server/config";
import { requireCandidate } from "@/server/http/guard";
import { availability } from "@/server/services/testing";
import { StartTest } from "./start-test";

export const metadata: Metadata = { title: "Тесты" };
export const dynamic = "force-dynamic";

const resultBadge = { passed_confident: ["Уверенно сдан", "ok"], passed: ["Сдан", "ok"], failed: ["Не сдан", "gray"] } as const;

export default async function TestsPage({ searchParams }: { searchParams: Promise<{ spec?: string; grade?: string }> }) {
  const { spec, grade } = await searchParams;
  const me = await requireCandidate();
  const specs = await availability(me.profileId);
  return (
    <div>
      <PageTitle kicker="Тестирование" title="Выберите специализацию и грейд">
        Грейд вы выбираете сами. Тест адаптивный: {TEST_CONFIG.minItems}–{TEST_CONFIG.maxItems} заданий, до {TEST_CONFIG.durationMinutes} минут, вариант
        уникален для каждой попытки. По результату вы получите категорию — только с ней вас увидят работодатели.
      </PageTitle>
      <div className="grid gap-6 lg:grid-cols-2">
        {specs.map((s) => (
          <Blank
            key={s.specialization}
            className={spec === s.specialization ? "border-violet ring-2 ring-violet/20" : undefined}
            label={specTitle(s.specialization)}
            aside={s.category ? <Badge tone="solid">{categoryTitle(s.category.specialization, s.category.grade)}</Badge> : null}
          >
            {s.inProgress ? (
              <a href={`/test/${s.inProgress}`} className="inline-flex h-10 items-center rounded-full bg-violet px-5 text-white">
                Продолжить начатую попытку
              </a>
            ) : (
              <StartTest specialization={s.specialization} grades={s.grades} preferred={spec === s.specialization ? grade : undefined} express={s.expressAvailable} />
            )}
            {s.attempts.length > 0 && (
              <div className="mt-5 border-t border-violet/15 pt-4">
                <p className="label-mono mb-2">История</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {s.attempts.slice(0, 5).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">{dateTime(a.startedAt)}</span>
                      <span>
                        {gradeTitle(a.grade)}
                        {a.mode === "express" && <span className="text-muted"> · экспресс</span>}
                      </span>
                      {a.result && <Badge tone={resultBadge[a.result][1]}>{resultBadge[a.result][0]}</Badge>}
                      {a.score !== null && <span className="font-mono text-xs">{a.score.toFixed(1)}/30</span>}
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

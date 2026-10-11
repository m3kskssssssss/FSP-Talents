import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { date, specTitle } from "@/lib/format";
import { requireCandidate } from "@/server/http/guard";
import { getMyProfile } from "@/server/services/candidate";
import { candidateChallenges, offerNext } from "@/server/services/challenges";
import { AnswerForm } from "./answer-form";

export const metadata: Metadata = { title: "Задачи от работодателей" };
export const dynamic = "force-dynamic";

const STATUS = {
  offered: ["ждёт ответа", "violet"],
  submitted: ["у работодателя на оценке", "warn"],
  graded: ["оценено", "ok"],
  skipped: ["пропущено", "gray"],
} as const;

export default async function CandidateChallenges() {
  const me = await requireCandidate();
  await offerNext(me.profileId);
  const [{ current, history, nextAt, periodDays }, p] = await Promise.all([
    candidateChallenges(me.profileId),
    getMyProfile(me.profileId, me.userId),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Задачи от работодателей">
        Раз в {periodDays} дней система предлагает короткую задачу от компании, которая ищет специалистов вашей
        категории. Решите её или предложите подход: свежий результат поднимает актуальность профиля и виден
        работодателям в подборке. Грейд от этого не меняется — его даёт только тест.
      </PageTitle>

      {current ? (
        <Blank label="Текущая задача" aside={<Badge tone="violet">{current.kind === "exact" ? "проверка по ответу" : "предложите подход"}</Badge>}>
          <p className="text-sm text-muted">
            {current.company} · {specTitle(current.specialization)} · выдана {date(current.offeredAt)}
          </p>
          <h2 className="h-display mt-2 text-2xl">{current.title}</h2>
          <p className="mt-3 whitespace-pre-line">{current.statement}</p>
          <AnswerForm id={current.id} kind={current.kind} />
        </Blank>
      ) : !p.categories.length ? (
        <EmptyState title="Задачи приходят после теста" action={<ButtonLink href="/candidate/test">Пройти тест</ButtonLink>}>
          Задачи подбираются под категорию «специализация · грейд», а её присваивает тест.
        </EmptyState>
      ) : (
        <EmptyState title="Новой задачи пока нет">
          {nextAt
            ? `Следующая задача появится не раньше ${date(nextAt)}.`
            : "Для вашей категории сейчас нет открытых задач — мы пришлём уведомление, когда работодатель её опубликует."}
        </EmptyState>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="label-mono mb-3">История</h2>
          <ul className="list-frame">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{h.title}</span>
                  <span className="text-sm text-muted">{h.company}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {h.score !== null && <Badge tone={h.score >= 2 ? "ok" : "gray"}>{h.score}/3</Badge>}
                    <Badge tone={STATUS[h.status][1]}>{STATUS[h.status][0]}</Badge>
                  </span>
                </div>
                {h.feedback && <p className="text-sm text-muted">Комментарий: {h.feedback}</p>}
                <p className="font-mono text-xs text-muted">{date(h.offeredAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

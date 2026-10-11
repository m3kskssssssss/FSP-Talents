import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { EmptyState } from "@/components/ui/empty";
import { date, dateTime, gradeTitle, specTitle } from "@/lib/format";
import { CHALLENGE_CONFIG } from "@/server/config";
import { requireEmployer } from "@/server/http/guard";
import { listEmployerChallenges, listSubmissions } from "@/server/services/challenges";
import { ChallengeForm, CloseChallenge, GradeForm } from "./forms";

export const metadata: Metadata = { title: "Регулярные задачи" };
export const dynamic = "force-dynamic";

export default async function EmployerChallenges() {
  const me = await requireEmployer();
  const [items, subs] = await Promise.all([listEmployerChallenges(me.employerId), listSubmissions(me.employerId)]);
  const waiting = subs.filter((s) => s.status === "submitted");
  const graded = subs.filter((s) => s.status === "graded").slice(0, 20);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Регулярные задачи">
        Короткие задачи из вашей практики. Система выдаёт их кандидатам нужной категории по одной раз в{" "}
        {CHALLENGE_CONFIG.periodDays} дней, начиная с наименее показанных, — так задача не расходится по всей базе.
        Хороший результат за последние {CHALLENGE_CONFIG.signalDays} дней виден в подборке как «свежий сигнал».
      </PageTitle>

      <Blank label={`Ждут оценки · ${waiting.length}`}>
        {!waiting.length ? (
          <p className="text-sm text-muted">Новых ответов нет. Ответы на задачи с эталоном система проверяет сама.</p>
        ) : (
          <ul className="list-frame">
            {waiting.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.displayName}</span>
                  <span className="text-sm text-muted">«{s.title}»</span>
                  <span className="ml-auto font-mono text-xs text-muted">{dateTime(s.submittedAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-line">{s.answer}</p>
                <GradeForm id={s.id} />
              </li>
            ))}
          </ul>
        )}
      </Blank>

      <section>
        <h2 className="label-mono mb-3">Мои задачи</h2>
        {!items.length ? (
          <EmptyState title="Задач пока нет">
            Создайте первую ниже: например, найти ошибку в запросе или предложить схему кеширования.
          </EmptyState>
        ) : (
          <ul className="list-frame">
            {items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-4">
                <span className="font-medium">{c.title}</span>
                <Badge tone="solid">
                  {specTitle(c.specialization)}
                  {c.grade ? ` · ${gradeTitle(c.grade)}` : " · все грейды"}
                </Badge>
                <Badge tone="gray">{c.kind === "exact" ? "по эталону" : "подход"}</Badge>
                {c.status === "closed" && <Badge tone="gray">закрыта</Badge>}
                <span className="ml-auto text-sm text-muted">
                  выдана {c.offered} · ждут {c.waiting} · оценено {c.graded}
                  {c.avgScore !== null && ` · средняя ${c.avgScore.toFixed(1)}/3`} · {date(c.createdAt)}
                </span>
                {c.status === "active" && <CloseChallenge id={c.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {graded.length > 0 && (
        <section>
          <h2 className="label-mono mb-3">Оценённые ответы</h2>
          <ul className="list-frame">
            {graded.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 p-4 text-sm">
                <span className="font-medium">{s.displayName}</span>
                <span className="text-muted">«{s.title}»</span>
                <span className="ml-auto">
                  <Badge tone={(s.score ?? 0) >= 2 ? "ok" : "gray"}>{s.score}/3</Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Blank label="Новая задача">
        <ChallengeForm />
      </Blank>
    </div>
  );
}

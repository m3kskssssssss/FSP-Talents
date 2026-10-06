import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { categoryTitle, formatTitle, salaryRange } from "@/lib/format";
import { requireCandidate } from "@/server/http/guard";
import { skillTitle } from "@/server/matching/skills";
import { listOpenVacancies, myApplications } from "@/server/services/vacancies";
import { ApplyButton } from "./apply";

export const metadata: Metadata = { title: "Вакансии" };
export const dynamic = "force-dynamic";

export default async function CandidateVacancies() {
  const me = await requireCandidate();
  const [items, mine] = await Promise.all([listOpenVacancies(), myApplications(me.profileId)]);
  const applied = new Set(mine.map((m) => m.a.vacancyId));
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Вакансии">
        Главный путь — приглашения от компаний. Но можно откликнуться и самому: отклик откроет компании ваши контакты. Нужна категория той же специализации.
      </PageTitle>
      {mine.length > 0 && (
        <Blank label="Мои отклики">
          <ul className="flex flex-col gap-1.5 text-sm">
            {mine.map((m) => (
              <li key={m.a.id}>
                {m.company} — {m.title} · <Badge tone={m.a.status === "accepted" ? "ok" : "gray"}>{{ sent: "отправлен", viewed: "просмотрен", accepted: "вас пригласили", declined: "отклонён" }[m.a.status]}</Badge>
              </li>
            ))}
          </ul>
        </Blank>
      )}
      {!items.length && <p className="text-muted">Открытых вакансий нет.</p>}
      <div className="flex flex-col gap-3">
        {items.map(({ v, company }) => (
          <article key={v.id} className="blank flex flex-col gap-2 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{v.title}</h2>
              <span className="text-muted">· {company}</span>
              <span className="ml-auto font-mono text-accent">{salaryRange(v.salaryFrom, v.salaryTo)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="solid">{categoryTitle(v.specialization, v.grade)}</Badge>
              <Badge tone="gray">{formatTitle(v.format)}{v.city ? ` · ${v.city}` : ""}</Badge>
              {v.stack.map((s) => <Badge key={s} tone="gray">{skillTitle(s)}</Badge>)}
            </div>
            <p className="text-sm whitespace-pre-line">{v.description}</p>
            <ApplyButton id={v.id} applied={applied.has(v.id)} />
          </article>
        ))}
      </div>
    </div>
  );
}

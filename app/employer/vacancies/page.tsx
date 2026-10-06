import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { categoryTitle, date, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { listEmployerVacancies } from "@/server/services/vacancies";
import { VacancyForm } from "./vacancy-form";

export const metadata: Metadata = { title: "Вакансии" };
export const dynamic = "force-dynamic";

export default async function EmployerVacancies() {
  const me = await requireEmployer();
  const items = await listEmployerVacancies(me.employerId);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Классические вакансии">
        Помимо обратного подбора можно опубликовать вакансию: откликнуться могут кандидаты с категорией этой специализации, и отклик сразу открывает вам их контакты.
      </PageTitle>
      <Blank label="Опубликованные">
        {!items.length && <p className="text-sm text-muted">Вакансий нет.</p>}
        <ul className="flex flex-col divide-y divide-accent/10">
          {items.map(({ v, applications }) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 py-3">
              <Link href={`/employer/vacancies/${v.id}`} className="font-medium hover:text-accent">
                {v.title}
              </Link>
              <Badge tone="solid">{categoryTitle(v.specialization, v.grade)}</Badge>
              <Badge tone="violet">{salaryRange(v.salaryFrom, v.salaryTo)}</Badge>
              {v.status === "closed" && <Badge tone="gray">закрыта</Badge>}
              <span className="ml-auto text-sm text-muted">
                откликов: {applications} · {date(v.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Blank>
      <Blank label="Новая вакансия">
        <VacancyForm />
      </Blank>
    </div>
  );
}

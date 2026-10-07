import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { categoryTitle, dateTime, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { vacancyApplications } from "@/server/services/vacancies";
import { ApplicationActions } from "./actions";

export const metadata: Metadata = { title: "Отклики" };
export const dynamic = "force-dynamic";

const ST = {
  sent: ["новый", "violet"],
  viewed: ["просмотрен", "warn"],
  accepted: ["приглашён", "ok"],
  declined: ["отклонён", "gray"],
} as const;

export default async function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireEmployer();
  const { vacancy, items } = await vacancyApplications(me.employerId, id);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle
        back={{ href: "/employer/vacancies", label: "Все вакансии" }}
        title={vacancy.title}
      >
        <span className="flex flex-wrap gap-1.5">
          <Badge tone="solid">{categoryTitle(vacancy.specialization, vacancy.grade)}</Badge>
          <Badge tone="violet">{salaryRange(vacancy.salaryFrom, vacancy.salaryTo)}</Badge>
        </span>
      </PageTitle>
      <Blank label={`Отклики (${items.length})`}>
        {!items.length && <p className="text-muted text-sm">Откликов пока нет.</p>}
        <ul className="divide-accent/10 flex flex-col divide-y">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <Link
                className="hover:text-accent font-medium"
                href={`/employer/candidates/${a.profileId}`}
              >
                {a.candidateName}
              </Link>
              <span className="text-muted text-sm">{a.city}</span>
              <Badge tone={ST[a.status][1]}>{ST[a.status][0]}</Badge>
              <span className="text-muted font-mono text-xs">{dateTime(a.createdAt)}</span>
              {a.coverLetter && <p className="w-full text-sm">{a.coverLetter}</p>}
              <ApplicationActions id={a.id} status={a.status} />
              {a.status === "accepted" && (
                <Link className="link ml-auto text-sm" href={`/employer/chats?with=${a.profileId}`}>
                  Написать в чат
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Blank>
    </div>
  );
}

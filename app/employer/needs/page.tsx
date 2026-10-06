import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { ButtonLink } from "@/components/ui/button";
import { categoryTitle, date, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { listNeeds } from "@/server/services/needs";

export const metadata: Metadata = { title: "Потребности" };
export const dynamic = "force-dynamic";

export default async function NeedsPage() {
  const me = await requireEmployer();
  const items = await listNeeds(me.employerId);
  return (
    <div>
      <PageTitle kicker="Работодатель" title="Потребности">
        Опишите, кого ищете, — система подберёт кандидатов из нужной категории и объяснит, почему они подходят.
      </PageTitle>
      <ButtonLink href="/employer/needs/new" className="mb-6">
        Новая потребность
      </ButtonLink>
      {!items.length && <p className="text-muted">Пока нет потребностей.</p>}
      <ul className="flex flex-col gap-3">
        {items.map(({ need, searches, lastSearchId }) => (
          <li key={need.id} className="blank flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <Link href={`/employer/needs/${need.id}`} className="text-lg font-medium hover:text-violet">
                {need.title}
              </Link>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="solid">{categoryTitle(need.specialization, need.grade)}</Badge>
                <Badge tone="violet">{salaryRange(need.salaryFrom, need.salaryTo)}</Badge>
                <Badge tone="gray">от {date(need.createdAt)}</Badge>
              </div>
            </div>
            {lastSearchId ? (
              <Link className="link text-sm" href={`/employer/searches/${lastSearchId}`}>
                Последняя подборка ({searches})
              </Link>
            ) : (
              <span className="text-sm text-muted">Подборок нет</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { EmptyState } from "@/components/ui/empty";
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
      <PageTitle title="Потребности">
        Опишите, кого ищете, — система подберёт кандидатов из нужной категории и объяснит, почему
        они подходят.
      </PageTitle>
      <ButtonLink href="/employer/needs/new" className="mb-6">
        Новая потребность
      </ButtonLink>
      {!items.length && (
        <EmptyState title="Потребностей пока нет">
          Опишите, кого ищете: специализацию, грейд, стек и вилку. Система соберёт подборку из
          подходящей категории и объяснит, почему кандидат в ней.
        </EmptyState>
      )}
      {items.length > 0 && (
        <ul className="list-frame">
          {items.map(({ need, searches, lastSearchId }) => (
            <li key={need.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/employer/needs/${need.id}`}
                  className="hover:text-accent text-lg font-medium"
                >
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
                <span className="text-muted text-sm">Подборок нет</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

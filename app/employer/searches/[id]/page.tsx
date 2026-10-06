import type { Metadata } from "next";
import Link from "next/link";
import { SearchView } from "@/components/employer/search-view";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { categoryTitle, dateTime, formatTitle, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { skillTitle } from "@/server/matching/skills";
import { searchResults } from "@/server/services/matching";

export const metadata: Metadata = { title: "Подборка" };
export const dynamic = "force-dynamic";

export default async function SearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireEmployer();
  const res = await searchResults(me.employerId, id, {});
  const need = res.search.need;
  return (
    <div>
      <PageTitle kicker={`Подборка · ${dateTime(res.search.createdAt)}`} title={need ? need.title : "Поиск по базе"}>
        {need ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="solid">{categoryTitle(need.specialization, need.grade)}</Badge>
            <Badge tone="violet">{salaryRange(need.salaryFrom, need.salaryTo)}</Badge>
            <Badge tone="gray">{formatTitle(need.format)}{need.city ? ` · ${need.city}` : ""}</Badge>
            {need.stack.map((s) => (
              <Badge key={s} tone="gray">
                {skillTitle(s)}
              </Badge>
            ))}
            <Link className="link ml-2 text-sm" href={`/employer/needs/${need.id}`}>
              Потребность
            </Link>
          </span>
        ) : (
          "Ранжирование по категории из теста, стеку, достижениям ФСП, зарплате и формату."
        )}
      </PageTitle>
      <SearchView searchId={id} initial={JSON.parse(JSON.stringify(res))} />
    </div>
  );
}

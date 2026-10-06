import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { categoryTitle, dateTime, formatTitle, salaryRange } from "@/lib/format";
import { requireEmployer } from "@/server/http/guard";
import { skillTitle } from "@/server/matching/skills";
import { listSearches } from "@/server/services/matching";
import { getNeed } from "@/server/services/needs";
import { RunSearch } from "./run-search";

export const metadata: Metadata = { title: "Потребность" };
export const dynamic = "force-dynamic";

export default async function NeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireEmployer();
  const need = await getNeed(me.employerId, id);
  const searches = (await listSearches(me.employerId, 100)).filter((s) => s.needId === id);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle back={{ href: "/employer/needs", label: "Все потребности" }} title={need.title} />
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <Blank label="Параметры" aside={<Badge tone="gray">{need.parsedBy === "llm" ? "разобрано ИИ" : need.parsedBy === "rules" ? "разобрано по правилам" : "форма"}</Badge>}>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Категория</dt>
            <dd>{categoryTitle(need.specialization, need.grade)}</dd>
            <dt className="text-muted">Вилка</dt>
            <dd className="font-mono">{salaryRange(need.salaryFrom, need.salaryTo)}</dd>
            <dt className="text-muted">Формат</dt>
            <dd>
              {formatTitle(need.format)}
              {need.city ? ` · ${need.city}` : ""}
            </dd>
            <dt className="text-muted">Стек</dt>
            <dd className="flex flex-wrap gap-1">
              {need.stack.length ? need.stack.map((s) => <Badge key={s} tone="gray">{skillTitle(s)}</Badge>) : "—"}
            </dd>
            {need.teamAbout && (
              <>
                <dt className="text-muted">О команде</dt>
                <dd>{need.teamAbout}</dd>
              </>
            )}
          </dl>
        </Blank>
        <Blank label="Подбор">
          <p className="mb-4 text-sm text-muted">
            В подборку попадают только кандидаты с категорией {categoryTitle(need.specialization, need.grade)} по результату теста; соседний грейд — отдельным блоком.
          </p>
          <RunSearch needId={need.id} />
          {searches.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              {searches.map((s) => (
                <li key={s.id}>
                  <Link className="link" href={`/employer/searches/${s.id}`}>
                    {dateTime(s.createdAt)} — {s.total} канд.
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Blank>
      </div>
    </div>
  );
}

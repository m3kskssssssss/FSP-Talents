import type { Metadata } from "next";
import { CandidateCard } from "@/components/employer/candidate-card";
import { PageTitle } from "@/components/ui/blank";
import { requireEmployer } from "@/server/http/page-guard";
import { listShortlist } from "@/server/services/matching";

export const metadata: Metadata = { title: "Избранное" };
export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const me = await requireEmployer();
  const items = await listShortlist(me.employerId);
  return (
    <div>
      <PageTitle title="Избранное">
        Кандидаты, которых вы отложили из подборок. Match здесь посчитан без привязки к потребности.
      </PageTitle>
      {!items.length && <p className="text-muted">Пока пусто — добавляйте кандидатов из подборок звёздочкой.</p>}
      <div className="flex flex-col gap-4">
        {items.map((c) => (
          <CandidateCard key={c.profileId} c={JSON.parse(JSON.stringify(c))} />
        ))}
      </div>
    </div>
  );
}

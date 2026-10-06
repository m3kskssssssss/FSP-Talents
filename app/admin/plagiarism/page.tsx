import type { Metadata } from "next";
import Link from "next/link";
import { Blank, PageTitle } from "@/components/ui/blank";
import { requireActor } from "@/server/http/guard";
import { plagiarismReport } from "@/server/services/moderation";

export const metadata: Metadata = { title: "Похожие решения" };
export const dynamic = "force-dynamic";

export default async function PlagiarismPage() {
  await requireActor("admin");
  const clusters = await plagiarismReport();
  return (
    <div>
      <PageTitle title="Похожие решения">
        Решения одного шаблона из разных попыток сравниваются по нормализованным токенам (без комментариев и имён переменных), 5-граммы, схожесть Жаккара ≥ 80%. Это сигнал для модератора, а не вердикт: короткие канонические решения похожи естественно.
      </PageTitle>
      {!clusters.length && <p className="text-muted">Подозрительных кластеров нет.</p>}
      <div className="flex flex-col gap-4">
        {clusters.map((c, i) => (
          <Blank key={i} label={`${c.templateId} · ${c.members.length} попыток · до ${Math.round(c.similarity * 100)}%`}>
            <ul className="flex flex-wrap gap-3 text-sm">
              {c.members.map((m) => (
                <li key={m.itemId}>
                  <Link className="link" href={`/admin/attempts/${m.attemptId}`}>
                    попытка {m.attemptId.slice(0, 8)}
                  </Link>
                </li>
              ))}
            </ul>
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-code p-3 font-mono text-[12px] text-code-fg">{c.members[0]!.code}</pre>
          </Blank>
        ))}
      </div>
    </div>
  );
}

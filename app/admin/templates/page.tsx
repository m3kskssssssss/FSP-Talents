import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { specTitle } from "@/lib/format";
import { requireActor } from "@/server/http/guard";
import { templateStats } from "@/server/services/moderation";
import { StatusSwitch } from "./status-switch";

export const metadata: Metadata = { title: "Банк заданий" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireActor("admin");
  const rows = await templateStats();
  const flagged = rows.filter((r) => r.status === "flagged").length;
  return (
    <div>
      <PageTitle kicker="Банк заданий" title={`${rows.length} шаблонов`}>
        Параметры IRT, экспозиция и детектор «слива»: если доля верных ответов резко выше прогноза модели, шаблон помечается flagged и снимается с оценки. Сейчас помечено: {flagged}.
      </PageTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="label-mono text-left">
              <th className="py-2 pr-3">Шаблон</th>
              <th className="pr-3">Тип</th>
              <th className="pr-3 text-right">b</th>
              <th className="pr-3 text-right">a</th>
              <th className="pr-3 text-right">Выдан</th>
              <th className="pr-3 text-right">Ответов</th>
              <th className="pr-3 text-right">Верно / прогноз</th>
              <th className="pr-3 text-right">z</th>
              <th className="pr-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-violet/10">
                <td className="py-2 pr-3">
                  <p className="font-medium">{t.title}</p>
                  <p className="font-mono text-[11px] text-muted">
                    {specTitle(t.specialization)} · {t.id}
                    {t.calibratedAt ? " · откалиброван" : ""}
                  </p>
                </td>
                <td className="pr-3"><Badge tone="gray">{t.kind}</Badge></td>
                <td className="pr-3 text-right font-mono">{t.difficultyB.toFixed(2)}</td>
                <td className="pr-3 text-right font-mono">{t.discriminationA.toFixed(2)}</td>
                <td className="pr-3 text-right font-mono">{t.exposureCount}</td>
                <td className="pr-3 text-right font-mono">{t.answeredCount}</td>
                <td className="pr-3 text-right font-mono">
                  {t.observed !== null ? `${Math.round(t.observed * 100)}% / ${Math.round((t.predicted ?? 0) * 100)}%` : "—"}
                </td>
                <td className={`pr-3 text-right font-mono ${t.verdict.z >= 3 ? "text-red-700" : ""}`}>{t.answeredCount ? t.verdict.z.toFixed(1) : "—"}</td>
                <td className="pr-3">
                  <StatusSwitch id={t.id} status={t.status} reason={t.flagReason} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

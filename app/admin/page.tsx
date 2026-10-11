import type { Metadata } from "next";
import Link from "next/link";
import { TrustBadge } from "@/components/admin/trust";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/ui/blank";
import { cn } from "@/components/ui/cn";
import { categoryTitle, dateTime } from "@/lib/format";
import { requireActor } from "@/server/http/page-guard";
import { listAttempts } from "@/server/services/moderation";
import { chipState } from "@/components/ui/chip";

export const metadata: Metadata = { title: "Модерация" };
export const dynamic = "force-dynamic";

const FILTERS = [
  ["", "Все"],
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
] as const;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ level?: string; pending?: string }> }) {
  const { level, pending } = await searchParams;
  await requireActor("admin");
  const lv = level === "low" || level === "medium" || level === "high" ? level : undefined;
  const { items, counts } = await listAttempts({ level: lv, pending: pending === "1" });
  return (
    <div>
      <PageTitle title="Попытки тестов">
        Сначала — попытки с самым низким индексом доверия. Решение принимает человек: автоматических блокировок нет.
      </PageTitle>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:max-w-xl sm:grid-cols-3">
        {(["low", "medium", "high"] as const).map((l) => {
          const c = counts.find((x) => x.level === l);
          return (
            <Link key={l} href={`/admin?level=${l}&pending=1`} className="blank p-3 hover:bg-accent-soft">
              <TrustBadge level={l} />
              <p className="mt-2 font-mono text-2xl text-accent">{c?.pending ?? 0}</p>
              <p className="text-xs text-muted">ждут проверки из {c?.n ?? 0}</p>
            </Link>
          );
        })}
      </div>
      <nav aria-label="Фильтр" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={v ? `/admin?level=${v}` : "/admin"} className={cn("rounded-full border px-3 py-1 text-sm", chipState((lv ?? "") === v))}>
            {l}
          </Link>
        ))}
        <Link href={`/admin?${lv ? `level=${lv}&` : ""}pending=1`} className={cn("rounded-full border px-3 py-1 text-sm", chipState(pending === "1"))}>
          Только непроверенные
        </Link>
      </nav>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="label-mono text-left">
              <th className="py-2 pr-3">Кандидат</th>
              <th className="pr-3">Тест</th>
              <th className="pr-3">Результат</th>
              <th className="pr-3">Доверие</th>
              <th className="pr-3">Сигналы</th>
              <th className="pr-3">Завершена</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const signals = ((a.trustSignals as { signals?: { title: string }[] } | null)?.signals ?? []).map((s) => s.title);
              return (
                <tr key={a.id} className="border-t border-accent/10 align-top">
                  <td className="py-2 pr-3">{a.candidate}</td>
                  <td className="pr-3">{categoryTitle(a.specialization, a.targetGrade)}</td>
                  <td className="pr-3 font-mono">
                    {a.score?.toFixed(1)}/30 {a.result === "failed" ? "✗" : "✓"}
                  </td>
                  <td className="pr-3">
                    <TrustBadge level={a.trustLevel} index={a.trustIndex} />
                  </td>
                  <td className="max-w-64 pr-3 text-xs text-muted">{signals.slice(0, 3).join("; ") || "—"}</td>
                  <td className="pr-3 font-mono text-xs">{dateTime(a.finishedAt)}</td>
                  <td>
                    {a.reviewedAt ? <Badge tone="gray">проверена</Badge> : null}{" "}
                    <Link className="link" href={`/admin/attempts/${a.id}`}>
                      Открыть
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { TrustBadge } from "@/components/admin/trust";
import { Badge } from "@/components/ui/badge";
import { Blank, PageTitle } from "@/components/ui/blank";
import { Notice } from "@/components/ui/field";
import { categoryTitle, dateTime } from "@/lib/format";
import { requireActor } from "@/server/http/page-guard";
import { attemptDetail } from "@/server/services/moderation";
import { Review } from "./review";

export const metadata: Metadata = { title: "Попытка" };
export const dynamic = "force-dynamic";

const EVENT_TITLES: Record<string, string> = {
  visibility_hidden: "Уход со вкладки",
  blur: "Потеря фокуса окна",
  copy: "Попытка копирования",
  paste: "Вставка",
  bulk_insert: "Вставка крупного блока",
  fullscreen_exit: "Выход из полноэкранного режима",
  fullscreen_enter: "Вход в полноэкранный режим",
  context_menu: "Контекстное меню",
  devtools: "Инструменты разработчика",
};
const TRAP_TITLES: Record<string, string> = { marker: "маркер в решении", twin: "значение-двойник" };

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireActor("admin");
  const d = await attemptDetail(id);
  const a = d.attempt;
  const signals = (a.trustSignals as { signals?: { code: string; title: string; points: number; count?: number }[] } | null)?.signals ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageTitle meta={`Попытка · ${dateTime(a.startedAt)}`} title={`${d.candidate}: ${categoryTitle(a.specialization, a.targetGrade)}`}>
        <span className="flex flex-wrap items-center gap-2">
          <TrustBadge level={a.trustLevel} index={a.trustIndex} />
          <Badge tone="violet">
            {a.score?.toFixed(1)}/30 · θ {a.theta?.toFixed(2)} ± {a.se?.toFixed(2)}
          </Badge>
          {d.category ? <Badge tone="ok">категория присвоена</Badge> : <Badge tone="gray">категории нет</Badge>}
          <span className="font-mono text-xs text-muted">маркер попытки: {a.marker}</span>
        </span>
      </PageTitle>
      {a.reviewedAt && <Notice>Проверена {dateTime(a.reviewedAt)}. {a.reviewNote}</Notice>}

      <div className="grid gap-6 md:grid-cols-2">
        <Blank label="Сигналы индекса доверия">
          {!signals.length && <p className="text-sm text-muted">Сигналов нет.</p>}
          <ul className="flex flex-col gap-2 text-sm">
            {signals.map((s) => (
              <li key={s.code} className="flex gap-3">
                <span className="w-10 shrink-0 font-mono text-danger">−{s.points}</span>
                <span>
                  {s.title}
                  {s.count !== undefined ? <span className="text-muted"> · {s.count}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Blank>
        <Blank label="Журнал событий">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {Object.entries(d.eventCounts).map(([k, v]) => (
              <Badge key={k} tone="gray">
                {EVENT_TITLES[k] ?? k}: {v}
              </Badge>
            ))}
          </div>
          {!d.events.length && <p className="text-sm text-muted">Событий нет.</p>}
          <ol className="max-h-56 overflow-y-auto font-mono text-xs">
            {d.events.map((e) => (
              <li key={e.id} className="flex gap-3 border-t border-accent/10 py-1">
                <span className="text-muted">{new Date(e.at).toLocaleTimeString("ru-RU")}</span>
                <span>{EVENT_TITLES[e.type] ?? e.type}</span>
                {e.payload && <span className="text-muted">{JSON.stringify(e.payload)}</span>}
              </li>
            ))}
          </ol>
        </Blank>
      </div>

      {d.similar.length > 0 && (
        <Notice tone="error">
          Похожие решения у других кандидатов:{" "}
          {d.similar.map((s) => `${s.templateId} (схожесть ${Math.round(s.similarity * 100)}%, попыток: ${s.attempts.length})`).join("; ")}.{" "}
          <Link className="link" href="/admin/plagiarism">
            Отчёт
          </Link>
        </Notice>
      )}

      <Blank label="Задания">
        {!d.items.length && <p className="text-sm text-muted">Детализация по заданиям недоступна (синтетическая попытка без банка заданий).</p>}
        <ol className="flex flex-col gap-3">
          {d.items.map((i) => (
            <li key={i.id} className="border-t border-accent/10 pt-3 first:border-none first:pt-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted">#{i.position + 1}</span>
                <span className="font-medium">{i.title}</span>
                <Badge tone="gray">{i.kind || "—"}</Badge>
                {i.answeredAt ? (
                  i.isCorrect ? <Badge tone="ok">верно</Badge> : <Badge tone="gray">неверно{i.partialScore ? ` · ${Math.round(i.partialScore * 100)}% тестов` : ""}</Badge>
                ) : (
                  <Badge tone="gray">без ответа</Badge>
                )}
                {i.timeMs !== null && <span className="font-mono text-xs text-muted">{Math.round(i.timeMs / 1000)} с</span>}
                {(i.trapHits ?? []).map((t) => (
                  <Badge key={t} tone="red">
                    ловушка: {TRAP_TITLES[t] ?? t}
                  </Badge>
                ))}
                {i.thetaAfter !== null && <span className="ml-auto font-mono text-xs text-muted">θ → {i.thetaAfter.toFixed(2)}</span>}
              </div>
              {i.code && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted">Код решения</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-code p-3 font-mono text-[12px] text-code-fg">{i.code}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      </Blank>

      <Review id={a.id} reviewed={Boolean(a.reviewedAt)} passed={a.result !== "failed"} />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { gradeTitle, plural } from "@/lib/format";
import type { CandidateCard as Card } from "@/server/services/matching";
import { CandidateCard } from "./candidate-card";
import { chipState } from "@/components/ui/chip";

type Filters = {
  grades?: string[];
  stack?: string[];
  confirmedOnly?: boolean;
  onlyFsp?: boolean;
  minScore?: number;
  city?: string;
  format?: string;
  includeNear?: boolean;
  includeUnconfirmed?: boolean;
};

type Result = {
  baseTotal: number;
  dropped: number;
  total: number;
  page: number;
  pageSize: number;
  items: Card[];
  facets: { cities: string[]; skills: { skill: string; title: string }[] };
  hints?: { kind: string; text: string; newInTop: number }[];
  search: { needId: string | null };
};

function toQuery(f: Filters, page: number) {
  const q = new URLSearchParams();
  if (f.grades?.length) q.set("grades", f.grades.join(","));
  if (f.stack?.length) q.set("stack", f.stack.join(","));
  if (f.confirmedOnly) q.set("confirmedOnly", "1");
  if (f.onlyFsp) q.set("onlyFsp", "1");
  if (f.minScore) q.set("minScore", String(f.minScore));
  if (f.city) q.set("city", f.city);
  if (f.format) q.set("format", f.format);
  if (f.includeNear === false) q.set("includeNear", "0");
  if (f.includeUnconfirmed === false) q.set("includeUnconfirmed", "0");
  if (page > 1) q.set("page", String(page));
  return q.toString();
}

const isEmpty = (f: Filters) => toQuery(f, 1) === "";

export function SearchView({ searchId, initial }: { searchId: string; initial: Result }) {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result>(initial);
  const [loading, setLoading] = useState(false);
  const [rephrased, setRephrased] = useState<Record<string, { pros: string[]; cons: string[] }>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [rephraseState, setRephraseState] = useState<"idle" | "loading" | "llm" | "templates">("idle");

  const load = useCallback(
    async (f: Filters, p: number) => {
      setLoading(true);
      try {
        const q = toQuery(f, p);
        setData(await api<Result>(`/api/v1/searches/${searchId}${q ? `?${q}` : ""}`));
        window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname);
      } finally {
        setLoading(false);
      }
    },
    [searchId],
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if ([...q.keys()].length) {
      const f: Filters = {
        grades: q.get("grades")?.split(",") ?? undefined,
        stack: q.get("stack")?.split(",") ?? undefined,
        confirmedOnly: q.get("confirmedOnly") === "1" || undefined,
        onlyFsp: q.get("onlyFsp") === "1" || undefined,
        minScore: q.get("minScore") ? Number(q.get("minScore")) : undefined,
        city: q.get("city") ?? undefined,
        format: q.get("format") ?? undefined,
        includeNear: q.get("includeNear") === "0" ? false : undefined,
        includeUnconfirmed: q.get("includeUnconfirmed") === "0" ? false : undefined,
      };
      setFilters(f);
      void load(f, Number(q.get("page") ?? 1));
    }
  }, [load]);

  const update = (patch: Partial<Filters>) => {
    const f = { ...filters, ...patch };
    setFilters(f);
    setPage(1);
    void load(f, 1);
  };
  const reset = () => {
    setFilters({});
    setPage(1);
    void load({}, 1);
  };
  const toggleIn = (key: "grades" | "stack", v: string) => {
    const cur = filters[key] ?? [];
    update({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  async function rephrase() {
    setRephraseState("loading");
    try {
      const r = await api<{ items: { id: string; pros: string[]; cons: string[] }[]; source: "llm" | "templates" }>(`/api/v1/searches/${searchId}/rephrase`, {
        body: { profileIds: data.items.slice(0, 10).map((c) => c.profileId) },
      });
      setRephrased((prev) => ({ ...prev, ...Object.fromEntries(r.items.map((i) => [i.id, { pros: i.pros, cons: i.cons }])) }));
      setRephraseState(r.source);
    } catch {
      setRephraseState("templates");
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const main = data.items.filter((c) => c.confirmed && !c.near);
  const near = data.items.filter((c) => c.confirmed && c.near);
  const unconfirmed = data.items.filter((c) => !c.confirmed);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <button type="button" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters} aria-controls="filters" className="rounded-full border border-accent px-4 py-2 text-sm text-accent lg:hidden">
        {showFilters ? "Скрыть фильтры" : `Фильтры${isEmpty(filters) ? "" : " · активны"}`}
      </button>
      <aside id="filters" aria-label="Фильтры" className={cn(showFilters ? "flex" : "hidden", "flex-col gap-5 lg:sticky lg:top-4 lg:flex lg:self-start")}>
        <div className="blank flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <p className="label-mono">Уточнить</p>
            <button type="button" onClick={reset} disabled={isEmpty(filters)} className="text-sm text-accent underline-offset-4 hover:underline disabled:text-muted disabled:no-underline">
              Сбросить
            </button>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Грейд</legend>
            <div className="flex gap-1.5">
              {["junior", "middle", "senior"].map((g) => (
                <button key={g} type="button" aria-pressed={filters.grades?.includes(g) ?? false} onClick={() => toggleIn("grades", g)} className={cn("rounded-full border px-2.5 py-1 text-xs", chipState(filters.grades?.includes(g)))}>
                  {gradeTitle(g)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Стек</legend>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {data.facets.skills.slice(0, 40).map((s) => (
                <button key={s.skill} type="button" aria-pressed={filters.stack?.includes(s.skill) ?? false} onClick={() => toggleIn("stack", s.skill)} className={cn("rounded-full border px-2 py-0.5 font-mono text-[11px]", chipState(filters.stack?.includes(s.skill)))}>
                  {s.title}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={Boolean(filters.confirmedOnly)} onChange={(e) => update({ confirmedOnly: e.target.checked || undefined })} />
              Только подтверждённые тестом
            </label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={Boolean(filters.onlyFsp)} onChange={(e) => update({ onlyFsp: e.target.checked || undefined })} />
            Только с достижениями ФСП
          </label>
          <div>
            <label htmlFor="minScore" className="mb-1 flex justify-between text-sm font-medium">
              Порог теста <span className="font-mono text-accent">{filters.minScore ?? 0}/30</span>
            </label>
            <input id="minScore" type="range" min={0} max={30} step={1} value={filters.minScore ?? 0} onChange={(e) => setFilters({ ...filters, minScore: Number(e.target.value) || undefined })} onMouseUp={() => update({})} onKeyUp={() => update({})} onTouchEnd={() => update({})} className="w-full accent-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="city" className="text-sm font-medium">
              Город
            </label>
            <select id="city" className="input py-2" value={filters.city ?? ""} onChange={(e) => update({ city: e.target.value || undefined })}>
              <option value="">Любой</option>
              {data.facets.cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="format" className="text-sm font-medium">
              Формат
            </label>
            <select id="format" className="input py-2" value={filters.format ?? ""} onChange={(e) => update({ format: e.target.value || undefined })}>
              <option value="">Любой</option>
              <option value="remote">Удалённо</option>
              <option value="hybrid">Гибрид</option>
              <option value="office">Офис</option>
            </select>
          </div>
          {data.search.needId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={filters.includeNear !== false} onChange={(e) => update({ includeNear: e.target.checked ? undefined : false })} />
              Показывать соседний грейд
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={filters.includeUnconfirmed !== false} onChange={(e) => update({ includeUnconfirmed: e.target.checked ? undefined : false })} />
            Показывать неподтверждённый грейд
          </label>
        </div>
        <p className="px-1 text-xs text-muted">Фильтры применяются поверх сохранённой подборки — исходный список не теряется.</p>
      </aside>

      <section aria-live="polite" aria-busy={loading} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {isEmpty(filters) ? "Исходная подборка" : "После уточнения"}: <strong>{data.total}</strong> {plural(data.total, "кандидат", "кандидата", "кандидатов")}
            {!isEmpty(filters) && <span className="text-muted"> из {data.baseTotal}</span>}
          </p>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={rephrase} disabled={rephraseState === "loading" || !data.items.length}>
            {rephraseState === "loading" ? "Переформулируем…" : "Доводы человеческим языком (ИИ)"}
          </Button>
        </div>
        {rephraseState === "llm" && <Notice>Доводы переформулированы ИИ без добавления новых фактов; исходные формулировки — детерминированные.</Notice>}
        {rephraseState === "templates" && <Notice>ИИ недоступен — показаны исходные формулировки.</Notice>}
        {data.hints && data.hints.length > 0 && (
          <div className="rounded-xl border border-accent/30 bg-accent-soft/60 p-4">
            <p className="label-mono mb-2">Что, если изменить потребность</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {data.hints.map((h) => (
                <li key={h.kind}>
                  {h.text}
                  {h.newInTop > 0 && <span className="text-muted"> · в верх подборки поднимутся ещё {h.newInTop}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Пересчёт той же формулы подбора по этой подборке. Чтобы применить, измените потребность и запустите подбор заново.</p>
          </div>
        )}
        {data.dropped > 0 && <p className="text-xs text-muted">{data.dropped} кандидат(ов) скрыли профиль после поиска и не показываются.</p>}
        {!data.items.length && <Notice>Никого не нашлось. Ослабьте фильтры или нажмите «Сбросить».</Notice>}
        {main.map((c) => (
          <CandidateCard key={c.profileId} c={c} needId={data.search.needId} rephrased={rephrased[c.profileId]} />
        ))}
        {near.length > 0 && (
          <>
            <h2 className="h-display mt-4 text-xl">Близкие кандидаты — соседний грейд</h2>
            {near.map((c) => (
              <CandidateCard key={c.profileId} c={c} needId={data.search.needId} rephrased={rephrased[c.profileId]} />
            ))}
          </>
        )}
        {unconfirmed.length > 0 && (
          <>
            <h2 className="h-display mt-4 text-xl">Грейд не подтверждён</h2>
            <p className="-mt-2 text-sm text-muted">Кандидаты прошли тест на этот грейд, но не набрали порог. Они всегда ниже подтверждённых, но могут подойти.</p>
            {unconfirmed.map((c) => (
              <CandidateCard key={c.profileId} c={c} needId={data.search.needId} rephrased={rephrased[c.profileId]} />
            ))}
          </>
        )}
        {pages > 1 && (
          <nav aria-label="Страницы" className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => { setPage(page - 1); void load(filters, page - 1); }}>
              ← Назад
            </Button>
            <span className="font-mono text-sm">
              {page} / {pages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => { setPage(page + 1); void load(filters, page + 1); }}>
              Вперёд →
            </Button>
          </nav>
        )}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api-client";
import { categoryTitle, formatTitle, salaryRange } from "@/lib/format";
import type { CandidateCard as Card } from "@/server/services/matching";

const COMPONENT_TITLES: Record<string, string> = {
  test: "Тест",
  stack: "Стек",
  fsp: "ФСП",
  salary: "Зарплата",
  formatCity: "Формат/город",
  freshness: "Свежесть",
};

const INVITE_STATUS: Record<string, string> = {
  sent: "Приглашение отправлено",
  viewed: "Приглашение просмотрено",
  accepted: "Приглашение принято",
  declined: "Приглашение отклонено",
  withdrawn: "Приглашение отозвано",
  expired: "Приглашение истекло",
};

const SOURCE_BADGE = {
  test_confirmed: { tone: "ok" as const, label: "тест", title: "Подтверждено тестом" },
  resume: { tone: "gray" as const, label: "резюме", title: "Из резюме — заявлено" },
  declared: { tone: "gray" as const, label: "заявлено", title: "Заявлено кандидатом" },
};

export function CandidateCard({ c, needId, rephrased }: { c: Card; needId?: string | null; rephrased?: { pros: string[]; cons: string[] } }) {
  const [shortlisted, setShortlisted] = useState(c.shortlisted);
  const [pending, setPending] = useState(false);
  const pros = rephrased?.pros ?? c.pros;
  const cons = rephrased?.cons ?? c.cons;

  async function toggle() {
    setPending(true);
    try {
      await api(`/api/v1/shortlist/${c.profileId}`, { method: shortlisted ? "DELETE" : "PUT" });
      setShortlisted(!shortlisted);
    } finally {
      setPending(false);
    }
  }

  const inviteHref = `/employer/invite?profile=${c.profileId}${needId ? `&need=${needId}` : ""}`;
  const canInvite = !c.invitation || ["declined", "withdrawn", "expired"].includes(c.invitation.status);

  return (
    <article className="blank flex flex-col gap-4 p-5" aria-labelledby={`cand-${c.profileId}`}>
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-violet text-white" title="Совпадение с потребностью">
          <span className="font-mono text-lg leading-none">{c.match}</span>
          <span className="font-mono text-[9px] uppercase opacity-80">match</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={`cand-${c.profileId}`} className="text-lg font-medium">
            <Link href={`/employer/candidates/${c.profileId}`} className="hover:text-violet">
              {c.displayName}
            </Link>
          </h3>
          <p className="text-sm text-muted">
            {[c.city, c.experienceYears !== null ? `опыт ${c.experienceYears} г.` : null, formatTitle(c.workFormat)].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.confirmed ? (
              <Badge tone="solid">{categoryTitle(c.category.specialization, c.category.grade)}</Badge>
            ) : (
              <Badge tone="warn" title="Кандидат прошёл тест на этот грейд, но не набрал порог">
                {categoryTitle(c.category.specialization, c.category.grade)} · не подтверждён
              </Badge>
            )}
            <Badge tone="violet" title="Балл теста на эталонном бланке из 30 заданий">
              тест {c.category.score.toFixed(1)}/30
            </Badge>
            {c.category.trustLevel === "medium" && <Badge tone="warn">с пометкой</Badge>}
            {c.category.express && (
              <Badge tone="gray" title="Категория по короткой экспресс-проверке демо-режима, а не по полному тесту">
                экспресс-проверка
              </Badge>
            )}
            {c.near && <Badge tone="gray">соседний грейд</Badge>}
            {c.fsp.confirmed > 0 && (
              <Badge tone="red" title="Подтверждённые достижения ФСП">
                ФСП {c.fsp.bestPlace ? `· ${c.fsp.bestPlace} место` : `· ${c.fsp.confirmed}`}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="label-mono">ожидания</p>
          <p className="font-mono">{salaryRange(c.salaryExpect.from, c.salaryExpect.to)}</p>
          {c.inviteFloor && <p className="text-xs text-muted">порог приглашений от {c.inviteFloor.toLocaleString("ru-RU")} ₽</p>}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="label-mono mb-1.5">За</p>
          <ul className="flex flex-col gap-1 text-sm">
            {pros.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-ok" aria-hidden="true">
                  +
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label-mono mb-1.5">Против</p>
          <ul className="flex flex-col gap-1 text-sm">
            {cons.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="text-red-700" aria-hidden="true">
                  −
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {c.stack.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Стек потребности">
          {c.stack.map((s) => (
            <span
              key={s.skill}
              title={{ test: "Подтверждено тестом", implied: "Косвенно подтверждено тестом", resume: "Из резюме — заявлено", declared: "Заявлено кандидатом", missing: "Нет данных" }[s.level]}
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[11px]",
                s.level === "test" && "border-ok/40 bg-ok/5 text-ok",
                s.level === "implied" && "border-ok/30 text-ok",
                (s.level === "resume" || s.level === "declared") && "border-gray text-muted",
                s.level === "missing" && "border-dashed border-gray text-muted line-through",
              )}
            >
              {s.title}
              {s.level === "test" ? " ✓" : s.level === "declared" || s.level === "resume" ? " · заявлено" : ""}
            </span>
          ))}
        </div>
      )}
      {c.stack.length === 0 && c.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <Badge key={s.skill} tone={SOURCE_BADGE[s.source].tone} title={SOURCE_BADGE[s.source].title}>
              {s.title} · {SOURCE_BADGE[s.source].label}
            </Badge>
          ))}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Из чего сложился match</summary>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {Object.entries(c.components).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <dt className="w-24 text-muted">{COMPONENT_TITLES[k]}</dt>
              <dd className="flex flex-1 items-center gap-2">
                <span className="h-1.5 flex-1 rounded-full bg-violet-50">
                  <span className="block h-full rounded-full bg-violet" style={{ width: `${Math.round(v * 100)}%` }} />
                </span>
                <span className="w-8 font-mono text-xs">{Math.round(v * 100)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </details>

      <footer className="flex flex-wrap items-center gap-2 border-t border-violet/15 pt-3">
        {canInvite ? (
          <Link href={inviteHref} className={buttonClass("primary", "sm")}>
            Пригласить
          </Link>
        ) : (
          <Badge tone={c.invitation!.status === "accepted" ? "ok" : "violet"}>{INVITE_STATUS[c.invitation!.status]}</Badge>
        )}
        <button type="button" onClick={toggle} disabled={pending} aria-pressed={shortlisted} className={buttonClass(shortlisted ? "secondary" : "ghost", "sm")}>
          {shortlisted ? "★ В избранном" : "☆ В избранное"}
        </button>
        <Link href={`/employer/candidates/${c.profileId}`} className="ml-auto text-sm link">
          Профиль
        </Link>
      </footer>
    </article>
  );
}

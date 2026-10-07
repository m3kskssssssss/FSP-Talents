import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { categoryTitle, formatTitle, plural } from "@/lib/format";
import type { LandingData } from "@/server/services/landing";

type Teaser = LandingData["candidates"][number];

/** A bar standing in for data the employer only sees after the candidate accepts. */
function Hidden({ className, label }: { className: string; label: string }) {
  return (
    <span role="img" aria-label={label} className={`bg-fg/10 block rounded-full ${className}`} />
  );
}

export function LockIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/** Public, anonymised candidate card for the landing page: category and proof, no identity. */
export function CandidateTeaser({ c, style }: { c: Teaser; style?: CSSProperties }) {
  const pct = Math.round((Math.min(30, c.score) / 30) * 100);
  return (
    <article
      style={style}
      className="blank reveal hover:border-accent flex flex-col gap-4 p-5 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="border-accent/30 bg-accent-soft text-accent relative flex size-12 shrink-0 items-center justify-center rounded-full border">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="9" r="3.5" />
            <path d="M5.5 19a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
          </svg>
          <span className="border-accent/30 bg-surface absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border">
            <LockIcon className="size-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <Hidden className="h-3.5 w-32" label="Имя скрыто" />
          <p className="text-muted mt-1.5 truncate text-sm">
            {[
              c.city,
              c.experienceYears !== null
                ? `опыт ${c.experienceYears} ${plural(Math.round(c.experienceYears), "год", "года", "лет")}`
                : null,
              formatTitle(c.workFormat),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div>
        <Badge tone="solid">{categoryTitle(c.specialization, c.grade)}</Badge>
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted">Результат теста</span>
          <span className="text-accent font-mono">{c.score.toFixed(1)}/30</span>
        </div>
        <div className="bg-accent-soft h-1.5 overflow-hidden rounded-full">
          <div className="grow-bar bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {c.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {c.skills.map((s) => (
            <Badge key={s.title} tone={s.confirmed ? "ok" : "gray"}>
              {s.title}
              {s.confirmed && " ✓"}
            </Badge>
          ))}
        </div>
      )}
      <div className="border-accent/15 mt-auto flex flex-col gap-2 border-t pt-3 text-sm">
        <p className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${c.bestPlace && c.bestPlace <= 3 ? "bg-red" : "bg-accent/40"}`}
          />
          {c.achievements
            ? `${c.achievements} ${plural(c.achievements, "достижение", "достижения", "достижений")} ФСП${c.bestPlace ? ` · лучшее — ${c.bestPlace} место` : ""}`
            : "Без достижений ФСП"}
        </p>
        <p className="text-muted flex items-center gap-2">
          <LockIcon />
          Контакты — после согласия
          <Hidden className="ml-auto h-2.5 w-14" label="Контакты скрыты" />
        </p>
      </div>
    </article>
  );
}

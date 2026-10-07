import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { plural } from "@/lib/format";
import type { WorkItem } from "@/server/db/schema";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export const monthTitle = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
};

/** "2 года 3 мес." between two "YYYY-MM" months, both inclusive; `to` null means now. */
export function duration(from: string, to: string | null) {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const now = new Date();
  const [ty, tm] = to
    ? (to.split("-").map(Number) as [number, number])
    : [now.getFullYear(), now.getMonth() + 1];
  const total = Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
  const y = Math.floor(total / 12);
  const m = total % 12;
  return [y ? `${y} ${plural(y, "год", "года", "лет")}` : null, m ? `${m} мес.` : null]
    .filter(Boolean)
    .join(" ");
}

/**
 * Work history on the brand track: a thin line with a dot per job, the
 * current job filled in. `actions` renders per-item controls (the editor).
 */
export function ExperienceTimeline({
  items,
  actions,
}: {
  items: WorkItem[];
  actions?: (i: number) => ReactNode;
}) {
  return (
    <ol className="relative flex flex-col gap-7 pl-8">
      <span aria-hidden="true" className="bg-accent/35 absolute top-2 bottom-2 left-[5px] w-px" />
      {items.map((w, i) => (
        <li key={`${w.company}-${w.from}-${i}`} className="relative">
          <span
            aria-hidden="true"
            className={`border-accent absolute top-1.5 -left-8 size-[11px] rounded-full border-2 ${w.to === null ? "bg-accent" : "bg-surface"}`}
          />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-lg leading-snug font-medium">{w.role}</p>
              <p className="text-accent text-[15px]">{w.company}</p>
            </div>
            <p className="text-muted shrink-0 font-mono text-xs sm:pt-1.5 sm:text-right">
              {monthTitle(w.from)} — {w.to ? monthTitle(w.to) : "сейчас"}
              <span className="block">{duration(w.from, w.to)}</span>
            </p>
          </div>
          {w.summary && (
            <p className="text-muted mt-2 max-w-prose text-[15px] text-pretty whitespace-pre-line">
              {w.summary}
            </p>
          )}
          {w.stack && w.stack.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {w.stack.map((s) => (
                <Badge key={s} tone="gray">
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions(i)}</div>}
        </li>
      ))}
    </ol>
  );
}

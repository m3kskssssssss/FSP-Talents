import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Pattern } from "@/components/ui/pattern";

export type ShowcaseItem = {
  id: string;
  competition: string;
  discipline: string;
  stage: "regional" | "district" | "final";
  year: number;
  place: number | null;
  source: "fsp_registry" | "organizer" | "repo" | "self";
  certificate: boolean;
};

export const STAGE_TITLES = {
  regional: "региональный этап",
  district: "окружной этап",
  final: "финал",
} as const;
export const SOURCE_BADGE = {
  fsp_registry: ["реестр ФСП ✓", "ok"],
  organizer: ["организатор ✓", "ok"],
  repo: ["репозиторий ✓", "violet"],
  self: ["заявлено", "gray"],
} as const;

/**
 * A certificate / diploma on the profile showcase, drawn like the FSP booklet:
 * pattern "cover", place mark, competition and how it was verified.
 */
export function CertificateCard({
  item,
  children,
  className,
}: {
  item: ShowcaseItem;
  children?: ReactNode;
  className?: string;
}) {
  const prize = item.place !== null && item.place <= 3;
  return (
    <article
      className={cn(
        "group border-accent/35 bg-surface hover:border-accent flex flex-col overflow-hidden rounded-2xl border transition-[border-color,transform] duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="border-accent/15 bg-subtle text-accent relative border-b">
        <Pattern seed={item.id} density={0.8} className="aspect-[16/10] w-full" />
        <span
          className={cn(
            "absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 font-mono text-[11px]",
            prize ? "bg-primary text-on-primary" : "border-accent/30 bg-surface text-accent border",
          )}
        >
          {item.place ? `${item.place} место` : "участие"}
        </span>
        {item.certificate && (
          <span className="border-accent/30 bg-surface text-accent absolute top-2 right-2 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase">
            файл
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="text-muted font-mono text-xs">
          {item.year} · {STAGE_TITLES[item.stage]}
        </p>
        <h3 className="text-[15px] leading-snug font-medium break-words hyphens-auto">
          {item.competition}
        </h3>
        <p className="text-muted text-sm">{item.discipline}</p>
        <div className="mt-auto pt-1.5">
          <Badge tone={SOURCE_BADGE[item.source][1]}>{SOURCE_BADGE[item.source][0]}</Badge>
        </div>
        {children}
      </div>
    </article>
  );
}

/** Showcase grid: two columns on phones, five on wide screens. */
export function ShowcaseGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>;
}

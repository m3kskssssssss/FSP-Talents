import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Pattern } from "@/components/ui/pattern";
import { categoryTitle } from "@/lib/format";

type Stat = { value: string; label: string };

/**
 * Top of a candidate profile: initials, name, facts, categories and a row of
 * key numbers. Used by the candidate's own page and the employer's view.
 */
export function ProfileHero({
  seed,
  name,
  facts,
  categories,
  stats,
  photo,
  avatar,
  children,
}: {
  seed: string;
  name: string;
  facts: (string | null | undefined | false)[];
  categories: { specialization: string; grade: string; note?: string }[];
  stats: Stat[];
  /** Photo URL; initials are shown when there is none. */
  photo?: string | null;
  /** Replaces the avatar entirely (the candidate's own page puts the photo editor here). */
  avatar?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="blank relative overflow-hidden">
      <Pattern
        seed={seed}
        animated
        className="text-accent/40 pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] md:block"
      />
      <div className="relative flex flex-col gap-5 p-5 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
          {avatar ?? <Avatar name={name} photo={photo} />}
          <div className="rise min-w-0" style={{ "--d": "80ms" } as React.CSSProperties}>
            <h1 className="h-display text-3xl leading-tight text-balance sm:text-4xl">{name}</h1>
            <p className="text-muted mt-1.5 text-pretty">{facts.filter(Boolean).join(" · ")}</p>
            {categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Badge key={c.specialization} tone={c.note ? "warn" : "solid"}>
                    {categoryTitle(c.specialization, c.grade)}
                    {c.note && ` · ${c.note}`}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {stats.length > 0 && (
          <dl className="border-accent/20 bg-accent/15 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4 md:max-w-[62%]">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="rise bg-surface flex flex-col-reverse gap-0.5 px-4 py-3"
                style={{ "--d": `${160 + i * 70}ms` } as React.CSSProperties}
              >
                <dt className="text-muted text-xs">{s.label}</dt>
                <dd className="text-accent font-mono text-xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </section>
  );
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "—";

/** Round avatar: the photo if there is one, otherwise initials on the brand violet. */
export function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  return (
    <div className="rise bg-primary text-on-primary relative flex size-20 shrink-0 items-center justify-center rounded-full font-mono text-2xl sm:size-24 sm:text-3xl">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- private API image, not for the Next optimizer
        <img src={photo} alt={`Фото: ${name}`} className="size-full rounded-full object-cover" />
      ) : (
        initialsOf(name)
      )}
      <span
        aria-hidden="true"
        className="border-accent/40 absolute -inset-1.5 rounded-full border"
      />
    </div>
  );
}

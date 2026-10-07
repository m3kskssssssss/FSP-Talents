import Link from "next/link";
import type { CSSProperties } from "react";
import { Pattern } from "@/components/ui/pattern";
import { date } from "@/lib/format";
import type { Article } from "@/lib/blog";

/** Blog card: generated cover, tag, title, excerpt. The whole card is one link. */
export function ArticleCard({
  a,
  className,
  style,
}: {
  a: Article;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <article className={className} style={style}>
      <Link
        href={`/blog/${a.slug}`}
        className="group border-accent/30 bg-surface hover:border-accent flex h-full flex-col overflow-hidden rounded-[var(--radius-blank)] border transition-[border-color,transform] duration-200 hover:-translate-y-1"
      >
        <div className="border-accent/15 bg-subtle text-accent relative aspect-[5/3] overflow-hidden border-b">
          <Pattern
            seed={a.slug}
            className="size-full transition-transform duration-500 group-hover:scale-105"
          />
          <span className="label-mono border-accent/30 bg-surface absolute top-3 left-3 rounded-full border px-2.5 py-1">
            {a.tag}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <p className="text-muted font-mono text-xs">
            <time dateTime={a.date}>{date(a.date)}</time> · {a.minutes} мин
          </p>
          <h3 className="group-hover:text-accent text-lg leading-snug font-medium text-balance transition-colors">
            {a.title}
          </h3>
          <p className="text-muted text-[15px] text-pretty">{a.excerpt}</p>
          <span className="text-accent mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium">
            Читать
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-3.5 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </div>
      </Link>
    </article>
  );
}

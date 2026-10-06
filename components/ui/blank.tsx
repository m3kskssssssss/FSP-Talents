import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** "Бланк" card: thin violet frame with rounded corners and a mono label. */
export function Blank({
  label,
  aside,
  className,
  children,
  ...rest
}: ComponentProps<"section"> & { label?: string; aside?: ReactNode }) {
  return (
    <section className={cn("blank p-5 sm:p-6", className)} {...rest}>
      {(label || aside) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {label && <h2 className="label-mono">{label}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Page heading. The active item in the header already says where you are, so
 * there is no eyebrow label: `meta` is for facts about this page (a date, a
 * company, a step), `back` for detail pages that belong to a list.
 */
export function PageTitle({
  title,
  meta,
  back,
  children,
}: {
  title: string;
  meta?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {back && (
        <Link href={back.href} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3 5 8l5 5" />
          </svg>
          {back.label}
        </Link>
      )}
      <h1 className="h-display text-3xl leading-tight text-balance sm:text-4xl">{title}</h1>
      {meta && <p className="mt-2 font-mono text-xs tracking-wide text-muted">{meta}</p>}
      {children && <div className="mt-3 max-w-2xl text-pretty text-muted">{children}</div>}
    </header>
  );
}

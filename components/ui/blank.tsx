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

export function PageTitle({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      {kicker && <p className="label-mono mb-3">{kicker}</p>}
      <h1 className="h-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted">{children}</div>}
    </header>
  );
}

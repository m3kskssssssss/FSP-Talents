import type { ReactNode } from "react";

/**
 * Empty list / no data yet. Say why it is empty and what to do next — never a
 * bare "nothing here". `action` is usually a ButtonLink.
 */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[var(--radius-blank)] border border-dashed border-accent/40 px-5 py-8 sm:px-8">
      <svg aria-hidden="true" viewBox="0 0 120 16" className="h-3 w-24 text-accent/60" fill="none">
        <path d="M4 8 H116" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 4" />
        <circle cx="4" cy="8" r="3" fill="currentColor" />
        <circle cx="116" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      <p className="text-lg font-medium">{title}</p>
      {children && <div className="max-w-prose text-[15px] text-pretty text-muted">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

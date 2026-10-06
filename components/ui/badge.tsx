import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "violet" | "red" | "gray" | "ok" | "warn" | "solid";
const tones: Record<Tone, string> = {
  violet: "border-accent/40 text-accent bg-accent-soft",
  red: "border-danger/40 text-danger bg-danger/5",
  gray: "border-line text-muted bg-surface",
  ok: "border-ok/30 text-ok bg-ok/5",
  warn: "border-warn/30 text-warn bg-warn/5",
  solid: "border-primary bg-primary text-on-primary",
};

export function Badge({ tone = "violet", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide whitespace-nowrap", tones[tone], className)}
    >
      {children}
    </span>
  );
}

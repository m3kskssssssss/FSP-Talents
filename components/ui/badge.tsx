import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "violet" | "red" | "gray" | "ok" | "warn" | "solid";
const tones: Record<Tone, string> = {
  violet: "border-violet/40 text-violet bg-violet-50",
  red: "border-red/40 text-red-700 bg-red/5",
  gray: "border-gray text-muted bg-white",
  ok: "border-ok/30 text-ok bg-ok/5",
  warn: "border-warn/30 text-warn bg-warn/5",
  solid: "border-violet bg-violet text-white",
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

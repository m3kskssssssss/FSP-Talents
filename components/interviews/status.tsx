import { Badge } from "@/components/ui/badge";

type Status = "scheduled" | "cancelled" | "done";
export type InterviewPhase = "upcoming" | "open" | "missed" | "cancelled" | "done";

/** Where an interview is right now: the stored status plus its join window. */
export function phaseOf(
  i: { status: Status; opensAt: Date | string; closesAt: Date | string },
  now = new Date(),
): InterviewPhase {
  if (i.status !== "scheduled") return i.status;
  if (now < new Date(i.opensAt)) return "upcoming";
  if (now > new Date(i.closesAt)) return "missed";
  return "open";
}

const BADGES: Record<InterviewPhase, { tone: "violet" | "ok" | "gray" | "red"; label: string }> = {
  upcoming: { tone: "violet", label: "Запланировано" },
  open: { tone: "ok", label: "Комната открыта" },
  missed: { tone: "gray", label: "Время прошло" },
  cancelled: { tone: "red", label: "Отменено" },
  done: { tone: "gray", label: "Завершено" },
};

export function PhaseBadge({ phase }: { phase: InterviewPhase }) {
  const b = BADGES[phase];
  return <Badge tone={b.tone}>{b.label}</Badge>;
}

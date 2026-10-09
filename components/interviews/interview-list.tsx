import Link from "next/link";
import { EmptyState } from "@/components/ui/empty";
import { LocalTime } from "./local-time";
import { PhaseBadge, phaseOf } from "./status";

type Item = {
  id: string;
  with: string;
  title: string;
  scheduledAt: Date;
  durationMin: number;
  status: "scheduled" | "cancelled" | "done";
  opensAt: Date;
  closesAt: Date;
  rating?: number | null;
};

/** Upcoming interviews first (nearest on top), then the past ones. */
export function InterviewList({ role, items }: { role: "candidate" | "employer"; items: Item[] }) {
  if (!items.length)
    return (
      <EmptyState title="Собеседований пока нет">
        {role === "employer"
          ? "Назначьте видеособеседование из чата с кандидатом: кнопка «Собеседование» в шапке переписки."
          : "Когда компания назначит видеособеседование, оно появится здесь, а в чате придёт сообщение."}
      </EmptyState>
    );
  const now = new Date();
  const withPhase = items.map((i) => ({ ...i, phase: phaseOf(i, now) }));
  const active = withPhase
    .filter((i) => i.phase === "open" || i.phase === "upcoming")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = withPhase.filter((i) => i.phase !== "open" && i.phase !== "upcoming");
  return (
    <div className="flex flex-col gap-8">
      {[
        { label: "Предстоящие", list: active },
        { label: "Прошедшие", list: past },
      ]
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.label}>
            <h2 className="label-mono mb-3">{g.label}</h2>
            <ul className="list-frame">
              {g.list.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/${role}/interviews/${i.id}`}
                    className="hover:bg-subtle flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors sm:px-5"
                  >
                    <span className="font-medium">{i.with}</span>
                    <span className="text-muted text-sm">{i.title}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-3">
                      <LocalTime value={i.scheduledAt} className="text-muted font-mono text-xs" />
                      {role === "employer" && i.rating != null && (
                        <span className="text-accent font-mono text-xs" title="Ваша оценка">
                          {i.rating}/5
                        </span>
                      )}
                      <PhaseBadge phase={i.phase} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

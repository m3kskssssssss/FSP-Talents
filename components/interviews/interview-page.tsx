import { notFound } from "next/navigation";
import { PageTitle } from "@/components/ui/blank";
import { uuidSchema } from "@/server/schemas/common";
import type { Party } from "@/server/services/chats";
import { getInterview } from "@/server/services/interviews";
import { InterviewRoom } from "./interview-room";
import { LocalTime } from "./local-time";
import { PhaseBadge, phaseOf } from "./status";

/** Server half of the interview page, shared by the candidate and employer areas. */
export async function InterviewPage({ party, id }: { party: Party; id: string }) {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) notFound();
  const i = await getInterview(party, parsed.data).catch(() => null);
  if (!i) notFound();
  return (
    <div>
      <PageTitle
        title={`Собеседование: ${i.with}`}
        meta={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <LocalTime value={i.scheduledAt} />
            <span>{i.durationMin} мин</span>
            <span>{i.title}</span>
            <PhaseBadge phase={phaseOf(i)} />
          </span>
        }
        back={{ href: `/${party.role}/interviews`, label: "Все собеседования" }}
      />
      <InterviewRoom
        key={i.status}
        role={party.role}
        interview={{
          id: i.id,
          chatId: i.chatId,
          status: i.status,
          durationMin: i.durationMin,
          task: i.task,
          language: i.language,
          code: i.code,
          rating: "rating" in i ? i.rating : undefined,
          notes: "notes" in i ? i.notes : undefined,
          opensAt: i.opensAt.toISOString(),
          closesAt: i.closesAt.toISOString(),
        }}
      />
    </div>
  );
}

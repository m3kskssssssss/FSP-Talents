import { Badge } from "@/components/ui/badge";
import { dateTime } from "@/lib/format";
import { STATUS_TITLES, type InvitationStatus } from "@/server/invitations/fsm";

const TONE: Record<InvitationStatus, "violet" | "ok" | "gray" | "red" | "warn"> = {
  sent: "violet",
  viewed: "warn",
  accepted: "ok",
  declined: "gray",
  withdrawn: "gray",
  expired: "gray",
};

export function StatusBadge({ status }: { status: InvitationStatus }) {
  return <Badge tone={TONE[status]}>{STATUS_TITLES[status]}</Badge>;
}

const STEPS: InvitationStatus[] = ["sent", "viewed"];

/** Timeline: sent -> viewed -> final, with timestamps from the event history. */
export function History({ events }: { events: { toStatus: InvitationStatus; at: Date | string; note?: string | null }[] }) {
  const final = events.find((e) => !STEPS.includes(e.toStatus));
  const at = (s: InvitationStatus) => events.find((e) => e.toStatus === s)?.at;
  const steps: { s: InvitationStatus; at?: Date | string; note?: string | null }[] = [
    { s: "sent", at: at("sent") },
    { s: "viewed", at: at("viewed") },
    final ? { s: final.toStatus, at: final.at, note: final.note } : { s: "accepted" },
  ];
  return (
    <ol className="flex flex-col gap-0" aria-label="История статусов">
      {steps.map((st, i) => {
        const done = Boolean(st.at);
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className={`absolute top-4 left-[7px] h-full w-px ${done ? "bg-violet" : "bg-gray"}`} />}
            <span aria-hidden="true" className={`relative mt-1 size-[15px] shrink-0 rounded-full border-2 ${done ? "border-violet bg-violet" : "border-gray bg-white"}`} />
            <div>
              <p className={done ? "font-medium" : "text-muted"}>{done ? STATUS_TITLES[st.s] : "Ответ кандидата"}</p>
              {st.at && <p className="font-mono text-xs text-muted">{dateTime(st.at)}</p>}
              {st.note && <p className="mt-1 text-sm text-muted">Причина: {st.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

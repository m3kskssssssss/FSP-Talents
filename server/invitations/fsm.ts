export type InvitationStatus = "sent" | "viewed" | "accepted" | "declined" | "withdrawn" | "expired";
export type InvitationAction = "view" | "accept" | "decline" | "withdraw" | "expire";
export type Actor = "candidate" | "employer" | "system";

/**
 * Invitation state machine: sent -> viewed -> accepted | declined,
 * plus withdrawn (by the employer) and expired (lazily, on read).
 * Anything not listed here is an invalid transition (HTTP 409).
 */
const TRANSITIONS: Record<InvitationAction, { from: InvitationStatus[]; to: InvitationStatus; actor: Actor }> = {
  view: { from: ["sent"], to: "viewed", actor: "candidate" },
  accept: { from: ["viewed"], to: "accepted", actor: "candidate" },
  decline: { from: ["viewed"], to: "declined", actor: "candidate" },
  withdraw: { from: ["sent", "viewed"], to: "withdrawn", actor: "employer" },
  expire: { from: ["sent", "viewed"], to: "expired", actor: "system" },
};

export const OPEN_STATUSES: InvitationStatus[] = ["sent", "viewed"];
export const isOpen = (s: InvitationStatus) => OPEN_STATUSES.includes(s);

export function transition(from: InvitationStatus, action: InvitationAction, actor: Actor): { ok: true; to: InvitationStatus } | { ok: false; reason: string } {
  const t = TRANSITIONS[action];
  if (t.actor !== actor) return { ok: false, reason: `Действие «${action}» недоступно для этой роли` };
  if (!t.from.includes(from)) return { ok: false, reason: `Недопустимый переход: ${from} → ${t.to}` };
  return { ok: true, to: t.to };
}

export const STATUS_TITLES: Record<InvitationStatus, string> = {
  sent: "Отправлено",
  viewed: "Просмотрено",
  accepted: "Принято",
  declined: "Отклонено",
  withdrawn: "Отозвано",
  expired: "Истекло",
};

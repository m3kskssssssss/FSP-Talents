import { INVITATION_CONFIG } from "../config";

/**
 * Employer reputation: computed from the employer's own invitation history,
 * shown to the candidate in every invitation and used to size the daily
 * invitation quota. Part of the protection from fake vacancies and spam: an
 * employer who sends many invitations that nobody accepts, withdraws them
 * often or gets confirmed complaints loses reach automatically, while a
 * moderator only reviews complaints.
 */
export interface ReputationStats {
  /** Invitations in the window (90 days). */
  sent: number;
  /** Seen by the candidate (viewed + accepted + declined). */
  viewed: number;
  accepted: number;
  declined: number;
  withdrawn: number;
  /** Open + confirmed complaints in the last 30 days. */
  complaints: number;
  /** Confirmed by a moderator, all time. */
  confirmedComplaints: number;
  verified: boolean;
  /** Invitations ever sent. */
  totalSent: number;
}

export type ReputationLevel = "new" | "good" | "normal" | "risky";

export interface Reputation {
  level: ReputationLevel;
  /** accepted / (accepted + declined); null with too few decisions. */
  acceptRate: number | null;
  /** (accepted + declined) / viewed; null with too few views. */
  responseRate: number | null;
  dailyQuota: number;
  reasons: string[];
}

const MIN_DECISIONS = 10;

export function reputationFrom(s: ReputationStats): Reputation {
  const decided = s.accepted + s.declined;
  const acceptRate = decided >= MIN_DECISIONS ? s.accepted / decided : null;
  const responseRate = s.viewed >= MIN_DECISIONS ? decided / s.viewed : null;
  const reasons: string[] = [];

  let level: ReputationLevel;
  if (s.confirmedComplaints > 0 || s.complaints >= 3) {
    level = "risky";
    reasons.push(s.confirmedComplaints > 0 ? "есть подтверждённые жалобы" : "несколько жалоб за 30 дней");
  } else if (acceptRate !== null && decided >= 20 && acceptRate < 0.05) {
    level = "risky";
    reasons.push("почти все приглашения отклоняются");
  } else if (s.sent >= 10 && s.withdrawn / s.sent > 0.5) {
    level = "risky";
    reasons.push("большинство приглашений отозвано");
  } else if (s.totalSent < MIN_DECISIONS) {
    level = "new";
  } else if (acceptRate !== null && acceptRate >= 0.3 && s.complaints === 0) {
    level = "good";
  } else {
    level = "normal";
  }

  const base = INVITATION_CONFIG.perEmployerPerDay;
  const quota = { risky: 5, new: 15, normal: base, good: base + 20 }[level] + (s.verified && level !== "risky" ? 10 : 0);
  return { level, acceptRate, responseRate, dailyQuota: quota, reasons };
}

export const REPUTATION_TITLES: Record<ReputationLevel, string> = {
  new: "Новая компания на платформе",
  good: "Кандидаты часто принимают приглашения",
  normal: "Обычная активность",
  risky: "Есть сигналы риска",
};

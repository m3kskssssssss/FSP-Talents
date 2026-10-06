import { describe, expect, it } from "vitest";
import { INVITATION_CONFIG } from "@/server/config";
import { reputationFrom, type ReputationStats } from "@/server/invitations/reputation";

const s = (o: Partial<ReputationStats> = {}): ReputationStats => ({
  sent: 30, viewed: 25, accepted: 5, declined: 15, withdrawn: 1, complaints: 0, confirmedComplaints: 0, verified: false, totalSent: 30, ...o,
});

describe("employer reputation and daily quota", () => {
  it("a new company gets a reduced quota until it has history", () => {
    expect(reputationFrom(s({ totalSent: 3, sent: 3, viewed: 2, accepted: 0, declined: 1 }))).toMatchObject({ level: "new", acceptRate: null, dailyQuota: 15 });
  });

  it("often accepted invitations raise the quota, verification adds to it", () => {
    const r = reputationFrom(s({ accepted: 9, declined: 11 }));
    expect(r.level).toBe("good");
    expect(r.dailyQuota).toBe(INVITATION_CONFIG.perEmployerPerDay + 20);
    expect(reputationFrom(s({ accepted: 9, declined: 11, verified: true })).dailyQuota).toBe(INVITATION_CONFIG.perEmployerPerDay + 30);
  });

  it("spam-like behaviour and complaints make a company risky with a minimal quota", () => {
    expect(reputationFrom(s({ accepted: 0, declined: 25 }))).toMatchObject({ level: "risky", dailyQuota: 5 });
    expect(reputationFrom(s({ withdrawn: 20 }))).toMatchObject({ level: "risky" });
    expect(reputationFrom(s({ complaints: 3 })).reasons[0]).toMatch(/жалоб/);
    // Verification does not lift a risky company.
    expect(reputationFrom(s({ confirmedComplaints: 1, verified: true })).dailyQuota).toBe(5);
  });

  it("a normal company keeps the base quota", () => {
    expect(reputationFrom(s())).toMatchObject({ level: "normal", dailyQuota: INVITATION_CONFIG.perEmployerPerDay });
  });
});

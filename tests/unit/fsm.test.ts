import { describe, expect, it } from "vitest";
import { transition, type InvitationAction, type InvitationStatus } from "@/server/invitations/fsm";

describe("invitation state machine (hard rule #3)", () => {
  it("allows the happy paths", () => {
    expect(transition("sent", "view", "candidate")).toEqual({ ok: true, to: "viewed" });
    expect(transition("viewed", "accept", "candidate")).toEqual({ ok: true, to: "accepted" });
    expect(transition("viewed", "decline", "candidate")).toEqual({ ok: true, to: "declined" });
    expect(transition("sent", "withdraw", "employer")).toEqual({ ok: true, to: "withdrawn" });
    expect(transition("viewed", "expire", "system")).toEqual({ ok: true, to: "expired" });
  });

  it("rejects every transition out of a terminal state", () => {
    const terminal: InvitationStatus[] = ["accepted", "declined", "withdrawn", "expired"];
    const actions: [InvitationAction, "candidate" | "employer" | "system"][] = [
      ["view", "candidate"], ["accept", "candidate"], ["decline", "candidate"], ["withdraw", "employer"], ["expire", "system"],
    ];
    for (const s of terminal) for (const [a, who] of actions) expect(transition(s, a, who).ok).toBe(false);
  });

  it("rejects skipping steps and wrong actors", () => {
    expect(transition("sent", "accept", "candidate").ok).toBe(false);
    expect(transition("viewed", "accept", "employer").ok).toBe(false);
    expect(transition("sent", "withdraw", "candidate").ok).toBe(false);
  });
});

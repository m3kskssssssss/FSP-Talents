import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { INVITATION_CONFIG } from "@/server/config";
import { db } from "@/server/db";
import { auditLog, candidateProfiles, invitationEvents, invitations, notifications } from "@/server/db/schema";
import { scoreCandidate } from "@/server/matching/score";
import { invitationCreateSchema } from "@/server/schemas/invitations";
import {
  candidateForEmployer,
  createInvitation,
  decide,
  getForCandidate,
  listForEmployer,
  withdraw,
} from "@/server/services/invitations";
import { resetDb } from "../helpers/db";
import { makeCandidate, makeCategorized, makeEmployer, makeUser } from "../helpers/factories";
import { employerReputation, listReports, reportInvitation, resolveReport } from "@/server/services/reputation";

const base = { title: "Python-разработчик", description: "Платёжный шлюз, высокие нагрузки", salaryFrom: 200000, salaryTo: 260000 };

describe("invitations", () => {
  beforeEach(resetDb);

  it("rejects an invitation without a salary range (hard rule #1)", async () => {
    for (const bad of [{}, { salaryFrom: 200000 }, { salaryFrom: 300000, salaryTo: 200000 }, { salaryFrom: 0, salaryTo: 1 }, { salaryFrom: 1.5, salaryTo: 2 }]) {
      const r = invitationCreateSchema.safeParse({ profileId: "00000000-0000-4000-8000-000000000000", title: "x x x", description: "описание задачи", ...bad });
      expect(r.success).toBe(false);
    }
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    await expect(
      createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, title: "Dev", description: "описание задачи", salaryFrom: undefined as never, salaryTo: undefined as never }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("invitation floor: below it the invitation is refused and the floor is visible in the search", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    await db().update(candidateProfiles).set({ inviteFloor: 300000 }).where(eq(candidateProfiles.id, c.profileId));
    await expect(createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base })).rejects.toMatchObject({
      status: 422,
      details: { code: "below_invite_floor", inviteFloor: 300000 },
    });
    expect((await candidateForEmployer(emp.employerId, emp.user.id, c.profileId)).inviteFloor).toBe(300000);
    const r = scoreCandidate({ grade: "middle", stack: [], salaryFrom: 200000, salaryTo: 260000, format: null, city: null }, {
      grade: "middle", score: 22, trustLevel: "high", assignedAt: new Date(), skills: [], salaryFrom: 200000, salaryTo: 250000,
      inviteFloor: 300000, format: null, city: null, lastActiveAt: new Date(), achievements: [],
    });
    expect(r.cons[0]).toMatch(/Порог приглашений/);
    await expect(createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base, salaryTo: 300000 })).resolves.toHaveProperty("id");
  });

  it("a candidate reports an invitation once; reputation and the moderator see it", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    const other = await makeCategorized({});
    const inv = await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base });
    await expect(reportInvitation(other.profileId, other.user.id, inv.id, "spam")).rejects.toMatchObject({ status: 404 });
    const r = await reportInvitation(c.profileId, c.user.id, inv.id, "fake_vacancy", "Просили оплатить обучение");
    expect(r.wasOpen).toBe(true);
    await expect(reportInvitation(c.profileId, c.user.id, inv.id, "spam")).rejects.toMatchObject({ status: 409 });
    const list = await listReports("open");
    expect(list).toHaveLength(1);
    expect(list[0]!.company).toBeTruthy();
    expect((await getForCandidate(c.profileId, c.user.id, inv.id)).reported).toBe(true);
    const admin = await makeUser("admin");
    await resolveReport(admin.id, list[0]!.id, "confirmed");
    const rep = await employerReputation(emp.employerId);
    expect(rep.level).toBe("risky");
    expect(rep.dailyQuota).toBe(5);
  });

  it("hides contacts until acceptance, then discloses them with an audit record (hard rule #2)", async () => {
    const emp = await makeEmployer();
    const other = await makeEmployer();
    const c = await makeCategorized({ fullName: "Анна Новикова", contacts: { email: "anna@secret.ru", phone: "+7 900 1" } });
    const before = await candidateForEmployer(emp.employerId, emp.user.id, c.profileId);
    expect(before.contacts).toBeNull();
    expect(before.displayName).toBe("Анна Н.");
    expect(JSON.stringify(before)).not.toContain("anna@secret.ru");

    const inv = await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base });
    expect((await candidateForEmployer(emp.employerId, emp.user.id, c.profileId)).contacts).toBeNull();
    await decide(c.profileId, c.user.id, inv.id, "accept");

    const after = await candidateForEmployer(emp.employerId, emp.user.id, c.profileId);
    expect(after.contacts).toMatchObject({ email: "anna@secret.ru" });
    expect(after.displayName).toBe("Анна Новикова");
    // Another employer still sees nothing.
    expect((await candidateForEmployer(other.employerId, other.user.id, c.profileId)).contacts).toBeNull();
    const logs = await db().select().from(auditLog).where(eq(auditLog.entityId, c.profileId));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["contacts.disclosed", "contacts.viewed"]));
  });

  it("follows the state machine and keeps a history; invalid transitions -> 409 (hard rule #3)", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    const inv = await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base });
    const view = await getForCandidate(c.profileId, c.user.id, inv.id);
    expect(view.invitation.status).toBe("viewed");
    expect(view.company.name).toBe("ООО Тест");
    await decide(c.profileId, c.user.id, inv.id, "decline", "Не подходит формат");
    await expect(decide(c.profileId, c.user.id, inv.id, "accept")).rejects.toMatchObject({ status: 409 });
    await expect(withdraw(emp.employerId, emp.user.id, inv.id)).rejects.toMatchObject({ status: 409 });
    const ev = await db().select().from(invitationEvents).where(eq(invitationEvents.invitationId, inv.id));
    expect(ev.map((e) => e.toStatus)).toEqual(["sent", "viewed", "declined"]);
    const [row] = await db().select().from(invitations).where(eq(invitations.id, inv.id));
    expect(row!.declineReason).toBe("Не подходит формат");
    const emps = await listForEmployer(emp.employerId);
    expect(emps[0]!.status).toBe("declined");
  });

  it("withdraw by employer and lazy expiry", async () => {
    const emp = await makeEmployer();
    const c1 = await makeCategorized({});
    const c2 = await makeCategorized({});
    const i1 = await createInvitation(emp.employerId, emp.user.id, { profileId: c1.profileId, ...base });
    await withdraw(emp.employerId, emp.user.id, i1.id);
    const i2 = await createInvitation(emp.employerId, emp.user.id, { profileId: c2.profileId, ...base });
    await db().update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, i2.id));
    const list = await listForEmployer(emp.employerId);
    expect(list.find((x) => x.id === i2.id)!.status).toBe("expired");
    await expect(decide(c2.profileId, c2.user.id, i2.id, "accept")).rejects.toMatchObject({ status: 409 });
  });

  it("a candidate cannot open someone else's invitation (hard rule #4)", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    const stranger = await makeCandidate();
    const inv = await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base });
    await expect(getForCandidate(stranger.profileId, stranger.user.id, inv.id)).rejects.toMatchObject({ status: 404 });
    await expect(decide(stranger.profileId, stranger.user.id, inv.id, "accept")).rejects.toMatchObject({ status: 404 });
    const other = await makeEmployer();
    await expect(withdraw(other.employerId, other.user.id, inv.id)).rejects.toMatchObject({ status: 404 });
  });

  it("anti-spam: no duplicate open invitation for the same need; daily limit", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    const inv = await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base });
    await expect(createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base })).rejects.toMatchObject({ status: 409 });
    await withdraw(emp.employerId, emp.user.id, inv.id);
    await expect(createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base })).resolves.toHaveProperty("id");

    const limit = INVITATION_CONFIG.perEmployerPerDay;
    const many = await Promise.all(Array.from({ length: limit - 2 }, () => makeCategorized({})));
    for (const m of many) await createInvitation(emp.employerId, emp.user.id, { profileId: m.profileId, ...base });
    const last = await makeCategorized({});
    await expect(createInvitation(emp.employerId, emp.user.id, { profileId: last.profileId, ...base })).rejects.toMatchObject({ status: 429 });
  });

  it("cannot invite a candidate without a category or with a hidden profile; notifies the candidate", async () => {
    const emp = await makeEmployer();
    const noCat = await makeCandidate();
    await expect(createInvitation(emp.employerId, emp.user.id, { profileId: noCat.profileId, ...base })).rejects.toMatchObject({ status: 404 });
    const c = await makeCategorized({});
    await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, ...base });
    const n = await db().select().from(notifications).where(and(eq(notifications.userId, c.user.id)));
    expect(n[0]!.title).toContain("Приглашение от ООО Тест");
  });
});

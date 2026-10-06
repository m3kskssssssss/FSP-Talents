import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { candidateContacts, candidateProfiles, candidateSkills, fspAchievements, users } from "@/server/db/schema";
import { MockFspRegistry, setFspRegistryForTests } from "@/server/fsp/registry";
import { renderResumePdf } from "@/server/pdf/resume";
import { parseResumeRules } from "@/server/resume/parse";
import {
  addSelfAchievement,
  contactAccessLog,
  deleteAccount,
  deleteAchievement,
  getMyProfile,
  linkFsp,
  setConsent,
  setVisibility,
  uploadResume,
} from "@/server/services/candidate";
import { createInvitation, decide } from "@/server/services/invitations";
import { searchBase } from "@/server/services/matching";
import { resetDb } from "../helpers/db";
import { makeCandidate, makeCategorized, makeEmployer } from "../helpers/factories";

describe("candidate self-service", () => {
  beforeEach(async () => {
    await resetDb();
    setFspRegistryForTests(new MockFspRegistry());
  });

  it("generates a PDF resume and parses an uploaded PDF (rules fallback), contacts go to the protected table", async () => {
    const pdf = await renderResumePdf({
      fullName: "Ольга Смирнова",
      city: "Казань",
      experienceYears: 3,
      about: "Backend-разработчик. Опыт 3 года. Python, FastAPI, PostgreSQL, Docker, Kafka.",
      workFormat: "remote",
      salary: { from: 220000, to: 280000 },
      contacts: { email: "olga@example.ru", phone: "+7 912 345-67-89", telegram: "@olga_dev", links: ["https://github.com/olga-dev"] },
      categories: [],
      skills: [],
      achievements: [],
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const { profileId } = await makeCandidate();
    const r = await uploadResume(profileId, { name: "cv.pdf", type: "application/pdf", data: pdf });
    expect(r.parsedBy).toBe("rules");
    expect(r.draft.city).toBe("Казань");
    expect(r.draft.skills).toEqual(expect.arrayContaining(["python", "fastapi", "postgresql", "docker", "kafka"]));
    expect(r.draft.contacts.email).toBe("olga@example.ru");
    const skills = await db().select().from(candidateSkills).where(eq(candidateSkills.profileId, profileId));
    expect(skills.every((s) => s.source === "resume")).toBe(true);
    await expect(uploadResume(profileId, { name: "x.pdf", type: "application/pdf", data: Buffer.from("not a pdf") })).rejects.toMatchObject({ status: 422 });
  });

  it("resume rules extract contacts and experience", () => {
    const d = parseResumeRules("Иван Петров\nг. Новосибирск\nivan.petrov@mail.ru, +7 (913) 123-45-67, t.me/ivan_dev\n2019 – 2022 ООО Ромашка\n2022 – н.в. АО Вектор\nНавыки: Go, PostgreSQL, Redis, Kubernetes\nНГУ, бакалавр");
    expect(d.fullName).toBe("Иван Петров");
    expect(d.city).toBe("Новосибирск");
    expect(d.contacts).toMatchObject({ email: "ivan.petrov@mail.ru", telegram: "@ivan_dev" });
    expect(d.contacts.phone).toContain("913");
    expect(d.experienceYears).toBeGreaterThanOrEqual(6);
    expect(d.education[0]).toContain("НГУ");
  });

  it("links FSP ID: registry achievements with high trust; unknown id -> 404, outage -> 503, no double binding", async () => {
    const a = await makeCandidate();
    const res = await linkFsp(a.profileId, "FSP-123456");
    expect(res.imported).toBeGreaterThan(0);
    const achs = await db().select().from(fspAchievements).where(eq(fspAchievements.profileId, a.profileId));
    expect(achs.every((x) => x.source === "fsp_registry" && x.trustLevel === "high")).toBe(true);
    // Idempotent re-import
    await linkFsp(a.profileId, "FSP-123456");
    expect((await db().select().from(fspAchievements).where(eq(fspAchievements.profileId, a.profileId))).length).toBe(achs.length);
    await expect(linkFsp(a.profileId, "FSP-100000")).rejects.toMatchObject({ status: 404 });
    await expect(linkFsp(a.profileId, "FSP-100999")).rejects.toMatchObject({ status: 503 });
    const b = await makeCandidate();
    await expect(linkFsp(b.profileId, "FSP-123456")).rejects.toMatchObject({ status: 409 });
    // Self-declared: low trust, deletable; registry ones are not.
    const self = await addSelfAchievement(b.profileId, { competition: "Хакатон", discipline: "продуктовое", stage: "regional", year: 2025, place: 2 });
    expect(self!.trustLevel).toBe("low");
    await deleteAchievement(b.profileId, self!.id);
    await expect(deleteAchievement(a.profileId, achs[0]!.id)).rejects.toMatchObject({ status: 422 });
    await expect(deleteAchievement(b.profileId, achs[0]!.id)).rejects.toMatchObject({ status: 404 });
  });

  it("hidden profile or revoked consent removes the candidate from search", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    expect((await searchBase(emp.employerId, { specialization: "backend", stack: [] })).total).toBe(1);
    await setVisibility(c.profileId, "hidden");
    expect((await searchBase(emp.employerId, { specialization: "backend", stack: [] })).total).toBe(0);
    await setVisibility(c.profileId, "visible");
    await setConsent(c.user.id, "pd_processing", false);
    expect((await searchBase(emp.employerId, { specialization: "backend", stack: [] })).total).toBe(0);
  });

  it("access log shows which company saw contacts; deletion anonymises personal data", async () => {
    const emp = await makeEmployer("ООО Наблюдатель");
    const c = await makeCategorized({ fullName: "Пётр Первый", contacts: { email: "petr@x.ru" } });
    const inv = await createInvitation(emp.employerId, emp.user.id, { profileId: c.profileId, title: "Dev", description: "описание задачи", salaryFrom: 100000, salaryTo: 150000 });
    await decide(c.profileId, c.user.id, inv.id, "accept");
    const log = await contactAccessLog(c.profileId);
    expect(log[0]).toMatchObject({ action: "contacts.disclosed", company: "ООО Наблюдатель" });

    await deleteAccount(c.user.id, c.profileId);
    const [u] = await db().select().from(users).where(eq(users.id, c.user.id));
    expect(u!.email).toMatch(/^deleted-/);
    expect(u!.passwordHash).toBeNull();
    const [p] = await db().select().from(candidateProfiles).where(eq(candidateProfiles.id, c.profileId));
    expect(p!.fullName).toBe("Удалённый пользователь");
    expect(p!.visibility).toBe("hidden");
    expect(await db().select().from(candidateContacts).where(eq(candidateContacts.profileId, c.profileId))).toHaveLength(0);
    expect((await searchBase(emp.employerId, { specialization: "backend", stack: [] })).total).toBe(0);
  });

  it("returns only the candidate's own profile", async () => {
    const a = await makeCandidate({ fullName: "Альфа" });
    const me = await getMyProfile(a.profileId, a.user.id);
    expect(me.profile.fullName).toBe("Альфа");
    expect(me.consents.map((c) => c.kind).sort()).toEqual(["pd_processing", "privacy_policy"]);
  });
});

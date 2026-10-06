import { eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { fspAchievements } from "@/server/db/schema";
import { assessCertificate, extractMeta } from "@/server/evidence/certificate";
import { checkRepository } from "@/server/evidence/github";
import { uploadCertificate, verifyRepository } from "@/server/services/candidate";
import { resetDb } from "../helpers/db";
import { makeCandidate } from "../helpers/factories";

async function pdf(opts: { producer: string; created: Date; modified: Date; extraSave?: boolean }) {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.setProducer(opts.producer);
  doc.setCreator(opts.producer);
  doc.setCreationDate(opts.created);
  doc.setModificationDate(opts.modified);
  let bytes = Buffer.from(await doc.save({ updateFieldAppearances: false }));
  if (opts.extraSave) bytes = Buffer.concat([bytes, Buffer.from("\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")]);
  return bytes;
}

const info = { competition: "Кубок России по продуктовому программированию", discipline: "продуктовое" as const, stage: "final" as const, year: 2025, place: 2 };

describe("evidence checks", () => {
  beforeEach(resetDb);

  it("clean organizer PDF -> confirmed by organizer; edited one -> risk signals and only 'claimed'", async () => {
    const clean = await pdf({ producer: "FSP Certificates Generator", created: new Date("2025-11-20"), modified: new Date("2025-11-20") });
    const m = await extractMeta(clean);
    expect(m.producer).toBe("FSP Certificates Generator");
    expect(assessCertificate(m, "2025-11-19").checks.filter((c) => c.risk)).toEqual([]);

    const edited = await pdf({ producer: "Adobe Photoshop 25.0", created: new Date("2025-10-01"), modified: new Date("2025-12-05"), extraSave: true });
    const codes = assessCertificate(await extractMeta(edited), "2025-11-19").checks.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["editor", "modified_after", "before_event", "incremental"]));

    const { profileId } = await makeCandidate();
    const ok = await uploadCertificate(profileId, { name: "c.pdf", data: clean }, { ...info, eventDate: "2025-11-19" });
    expect(ok.achievementSource).toBe("organizer");
    const bad = await uploadCertificate(profileId, { name: "c.pdf", data: edited }, { ...info, eventDate: "2025-11-19" });
    expect(bad.trust).toBe("low");
    expect(bad.achievementSource).toBe("self");
    await expect(uploadCertificate(profileId, { name: "x.txt", data: Buffer.from("hello") }, info)).rejects.toMatchObject({ status: 422 });
  });

  it("GitHub repository check: author commits in the window, not a fork", async () => {
    const fake = (fork: boolean, commits: number) => async (url: string) => {
      if (url.includes("/commits")) return new Response(JSON.stringify(Array.from({ length: commits }, () => ({}))), { status: 200 });
      return new Response(JSON.stringify({ fork, created_at: "2025-11-18T10:00:00Z" }), { status: 200 });
    };
    const input = { repo: "team/hack", login: "alice", from: "2025-11-19", to: "2025-11-21" };
    expect((await checkRepository(input, fake(false, 12))).ok).toBe(true);
    expect((await checkRepository(input, fake(true, 12))).ok).toBe(false);
    expect((await checkRepository(input, fake(false, 0))).ok).toBe(false);

    const { profileId } = await makeCandidate();
    await verifyRepository(profileId, { ...input, ...info }, fake(false, 5));
    const [a] = await db().select().from(fspAchievements).where(eq(fspAchievements.profileId, profileId));
    expect(a).toMatchObject({ source: "repo", trustLevel: "medium" });
  });
});

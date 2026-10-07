import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { CONSENT_VERSIONS } from "../config";
import { db } from "../db";
import {
  auditLog,
  candidateContacts,
  candidateProfiles,
  candidateSkills,
  categories,
  consents,
  employers,
  fspAchievements,
  invitationEvents,
  invitations,
  resumes,
  testAttempts,
  users,
} from "../db/schema";
import { assessCertificate, detectKind, extractMeta } from "../evidence/certificate";
import { checkRepository } from "../evidence/github";
import { certificates } from "../db/schema";
import { FspRegistryUnavailable, getFspRegistry } from "../fsp/registry";
import { AppError, notFound, unprocessable } from "../lib/errors";
import { skillTitle } from "../matching/skills";
import { imageKind, stripMetadata } from "../lib/image";
import { parseResumeText } from "../resume/parse";
import { extractResumePhoto } from "../resume/photo";
import type {
  contactsSchema,
  profileUpdateSchema,
  selfAchievementSchema,
  workHistorySchema,
} from "../schemas/candidate";
import { getStorage, MAX_UPLOAD_BYTES } from "../storage";
import { audit } from "./audit";

export async function getMyProfile(profileId: string, userId: string) {
  const [p] = await db()
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId));
  if (!p) throw notFound();
  const [contacts, skills, cats, achs, cons, lastResume] = await Promise.all([
    db().select().from(candidateContacts).where(eq(candidateContacts.profileId, profileId)),
    db().select().from(candidateSkills).where(eq(candidateSkills.profileId, profileId)),
    db()
      .select()
      .from(categories)
      .where(and(eq(categories.profileId, profileId), eq(categories.status, "active"))),
    db()
      .select()
      .from(fspAchievements)
      .where(eq(fspAchievements.profileId, profileId))
      .orderBy(desc(fspAchievements.year)),
    db()
      .select()
      .from(consents)
      .where(and(eq(consents.userId, userId), isNull(consents.revokedAt))),
    db()
      .select()
      .from(resumes)
      .where(eq(resumes.profileId, profileId))
      .orderBy(desc(resumes.createdAt))
      .limit(1),
  ]);
  return {
    profile: p,
    contacts: contacts[0]?.data ?? {},
    skills: skills.map((s) => ({ skill: s.skill, title: skillTitle(s.skill), source: s.source })),
    categories: cats,
    achievements: achs,
    consents: cons.map((c) => ({ kind: c.kind, version: c.version, acceptedAt: c.acceptedAt })),
    resume: lastResume[0]
      ? {
          id: lastResume[0].id,
          parseStatus: lastResume[0].parseStatus,
          parsedBy: lastResume[0].parsedBy,
          createdAt: lastResume[0].createdAt,
        }
      : null,
  };
}

export async function updateProfile(profileId: string, input: z.infer<typeof profileUpdateSchema>) {
  const { onboarded, ...rest } = input;
  await db()
    .update(candidateProfiles)
    .set({
      ...rest,
      updatedAt: new Date(),
      lastActiveAt: new Date(),
      ...(onboarded ? { onboardedAt: new Date() } : {}),
    })
    .where(eq(candidateProfiles.id, profileId));
  return { ok: true };
}

export async function updateContacts(profileId: string, data: z.infer<typeof contactsSchema>) {
  const clean = {
    ...data,
    telegram: data.telegram
      ? data.telegram.startsWith("@")
        ? data.telegram
        : `@${data.telegram}`
      : undefined,
  };
  await db()
    .insert(candidateContacts)
    .values({ profileId, data: clean })
    .onConflictDoUpdate({
      target: candidateContacts.profileId,
      set: { data: clean, updatedAt: new Date() },
    });
  return { ok: true };
}

/** Replaces skills of the given source; test-confirmed skills are never touched by the candidate. */
export async function setSkills(
  profileId: string,
  skills: string[],
  source: "declared" | "resume" = "declared",
) {
  await db().transaction(async (tx) => {
    await tx
      .delete(candidateSkills)
      .where(and(eq(candidateSkills.profileId, profileId), eq(candidateSkills.source, source)));
    if (skills.length)
      await tx
        .insert(candidateSkills)
        .values(skills.map((skill) => ({ profileId, skill, source })))
        .onConflictDoNothing();
  });
  return { ok: true };
}

/** Pins up to five of the candidate's own achievements to the profile showcase, in the given order. */
export async function setShowcase(profileId: string, ids: string[]) {
  if (ids.length) {
    const own = await db()
      .select({ id: fspAchievements.id })
      .from(fspAchievements)
      .where(and(eq(fspAchievements.profileId, profileId), inArray(fspAchievements.id, ids)));
    if (own.length !== ids.length) throw notFound("Сертификат не найден");
  }
  await db()
    .update(candidateProfiles)
    .set({ showcase: ids, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, profileId));
  return { ok: true };
}

/** Replaces the work history; stored newest first. */
export async function setWorkHistory(
  profileId: string,
  items: z.infer<typeof workHistorySchema>["items"],
) {
  const sorted = [...items].sort(
    (a, b) => (b.to ?? "9999-99").localeCompare(a.to ?? "9999-99") || b.from.localeCompare(a.from),
  );
  await db()
    .update(candidateProfiles)
    .set({ workHistory: sorted, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, profileId));
  return { ok: true };
}

/**
 * Achievements pinned to the showcase, in the candidate's order. Ids whose
 * achievement was deleted are skipped. `certificate` marks those backed by an uploaded file.
 */
export function pickShowcase<T extends { id: string; evidence: Record<string, unknown> | null }>(
  ids: string[],
  achievements: T[],
) {
  const byId = new Map(achievements.map((a) => [a.id, a]));
  return ids.flatMap((id) => {
    const a = byId.get(id);
    return a ? [{ ...a, certificate: a.evidence?.certificate === true }] : [];
  });
}

export async function setVisibility(profileId: string, visibility: "visible" | "hidden") {
  await db()
    .update(candidateProfiles)
    .set({ visibility, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, profileId));
  return { ok: true };
}

export async function setConsent(
  userId: string,
  kind: keyof typeof CONSENT_VERSIONS,
  granted: boolean,
) {
  if (granted) {
    const [cur] = await db()
      .select()
      .from(consents)
      .where(and(eq(consents.userId, userId), eq(consents.kind, kind), isNull(consents.revokedAt)));
    if (!cur) await db().insert(consents).values({ userId, kind, version: CONSENT_VERSIONS[kind] });
  } else {
    await db()
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(and(eq(consents.userId, userId), eq(consents.kind, kind), isNull(consents.revokedAt)));
  }
  await audit(db(), {
    actorUserId: userId,
    action: granted ? "consent.granted" : "consent.revoked",
    entity: "consent",
    entityId: kind,
  });
  return { ok: true };
}

/** Who saw my contacts and when (152-FZ transparency). */
export async function contactAccessLog(profileId: string) {
  const rows = await db()
    .select({ action: auditLog.action, at: auditLog.at, meta: auditLog.meta })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entity, "candidate_profile"),
        eq(auditLog.entityId, profileId),
        inArray(auditLog.action, ["contacts.disclosed", "contacts.viewed"]),
      ),
    )
    .orderBy(desc(auditLog.at))
    .limit(100);
  const ids = [
    ...new Set(
      rows
        .map((r) => (r.meta as { employerId?: string } | null)?.employerId)
        .filter((x): x is string => Boolean(x)),
    ),
  ];
  const names = ids.length
    ? await db()
        .select({ id: employers.id, name: employers.companyName })
        .from(employers)
        .where(inArray(employers.id, ids))
    : [];
  const byId = new Map(names.map((n) => [n.id, n.name]));
  return rows.map((r) => ({
    action: r.action,
    at: r.at,
    company: byId.get((r.meta as { employerId?: string } | null)?.employerId ?? "") ?? "—",
  }));
}

/**
 * Account deletion with anonymisation: personal data and contacts are removed,
 * open invitations expire, anonymous test statistics stay for calibration.
 */
export async function deleteAccount(userId: string, profileId: string) {
  await db().transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        email: `deleted-${userId}@deleted.invalid`,
        passwordHash: null,
        deletedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await tx
      .update(candidateProfiles)
      .set({
        fullName: "Удалённый пользователь",
        city: null,
        about: null,
        fspId: null,
        survey: null,
        visibility: "hidden",
        salaryExpectFrom: null,
        salaryExpectTo: null,
        showcase: [],
        workHistory: [],
        photoKey: null,
        updatedAt: new Date(),
      })
      .where(eq(candidateProfiles.id, profileId));
    await tx.delete(candidateContacts).where(eq(candidateContacts.profileId, profileId));
    await tx.delete(candidateSkills).where(eq(candidateSkills.profileId, profileId));
    await tx.delete(fspAchievements).where(eq(fspAchievements.profileId, profileId));
    await tx.delete(resumes).where(eq(resumes.profileId, profileId));
    await tx
      .update(categories)
      .set({ status: "superseded" })
      .where(eq(categories.profileId, profileId));
    await tx
      .update(testAttempts)
      .set({ reviewNote: "account deleted" })
      .where(eq(testAttempts.profileId, profileId));
    const open = await tx
      .select()
      .from(invitations)
      .where(
        and(eq(invitations.profileId, profileId), inArray(invitations.status, ["sent", "viewed"])),
      );
    for (const inv of open) {
      await tx.update(invitations).set({ status: "expired" }).where(eq(invitations.id, inv.id));
      await tx.insert(invitationEvents).values({
        invitationId: inv.id,
        fromStatus: inv.status,
        toStatus: "expired",
        note: "Аккаунт кандидата удалён",
      });
    }
    await tx
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(and(eq(consents.userId, userId), isNull(consents.revokedAt)));
    await audit(tx, {
      actorUserId: userId,
      action: "account.deleted",
      entity: "user",
      entityId: userId,
    });
  });
  return { ok: true };
}

// ---------------------------------------------------------------- FSP

export async function linkFsp(profileId: string, fspId: string) {
  let person;
  try {
    person = await getFspRegistry().lookup(fspId);
  } catch (e) {
    if (e instanceof FspRegistryUnavailable) {
      // Degraded mode: keep previously imported data, ask to retry later.
      throw new AppError(
        503,
        "fsp_unavailable",
        "Реестр ФСП временно недоступен. Уже подтверждённые достижения сохранены — попробуйте позже.",
      );
    }
    throw e;
  }
  if (!person) throw notFound("ФСП ID не найден в реестре");
  // One FSP ID cannot be attached to two candidates.
  const [taken] = await db()
    .select({ id: candidateProfiles.id })
    .from(candidateProfiles)
    .where(and(eq(candidateProfiles.fspId, fspId), sql`${candidateProfiles.id} <> ${profileId}`));
  if (taken) throw new AppError(409, "conflict", "Этот ФСП ID уже привязан к другому профилю");
  await db().transaction(async (tx) => {
    await tx
      .update(candidateProfiles)
      .set({ fspId, updatedAt: new Date() })
      .where(eq(candidateProfiles.id, profileId));
    for (const a of person.achievements) {
      await tx
        .insert(fspAchievements)
        .values({
          profileId,
          competition: a.competition,
          discipline: a.discipline,
          stage: a.stage,
          year: a.year,
          place: a.place,
          rank: a.rank,
          sportsCategory: person.sportsCategory,
          source: "fsp_registry",
          trustLevel: "high",
          evidence: {
            registryId: a.registryId,
            teamName: a.teamName,
            rating: person.rating,
            region: person.region,
          },
          externalId: a.registryId,
        })
        .onConflictDoUpdate({
          target: [fspAchievements.profileId, fspAchievements.externalId],
          set: {
            place: a.place,
            rank: a.rank,
            stage: a.stage,
            sportsCategory: person.sportsCategory,
          },
        });
    }
  });
  return {
    imported: person.achievements.length,
    sportsCategory: person.sportsCategory,
    rating: person.rating,
  };
}

export async function addSelfAchievement(
  profileId: string,
  a: z.infer<typeof selfAchievementSchema>,
) {
  const [row] = await db()
    .insert(fspAchievements)
    .values({
      profileId,
      competition: a.competition,
      discipline: a.discipline,
      stage: a.stage,
      year: a.year,
      place: a.place ?? null,
      source: "self",
      trustLevel: "low",
      evidence: { declared: true },
    })
    .returning();
  return row;
}

export async function deleteAchievement(profileId: string, id: string) {
  const [a] = await db().select().from(fspAchievements).where(eq(fspAchievements.id, id));
  if (!a || a.profileId !== profileId) throw notFound("Достижение не найдено");
  if (a.source === "fsp_registry")
    throw unprocessable("Достижения из реестра ФСП удаляются только вместе с отвязкой ФСП ID");
  await db().delete(fspAchievements).where(eq(fspAchievements.id, id));
  return { ok: true };
}

// ---------------------------------------------------------------- resume

const isPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";

export async function uploadResume(
  profileId: string,
  file: { name: string; type: string; data: Buffer },
) {
  if (file.data.length > MAX_UPLOAD_BYTES) throw unprocessable("Файл больше 4 МБ");
  if (!isPdf(file.data)) throw unprocessable("Нужен PDF-файл");
  const key = await getStorage().put(
    `resumes/${profileId}`,
    file.name || "resume.pdf",
    file.data,
    "application/pdf",
  );
  const [row] = await db()
    .insert(resumes)
    .values({ profileId, fileKey: key, parseStatus: "pending" })
    .returning();
  let text = "";
  let photo: Buffer | null = null;
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(file.data));
    const res = await extractText(pdf, { mergePages: true });
    text = Array.isArray(res.text) ? res.text.join("\n") : res.text;
    photo = await extractResumePhoto(pdf, pdf.numPages);
  } catch {
    await db().update(resumes).set({ parseStatus: "failed" }).where(eq(resumes.id, row!.id));
    throw unprocessable("Не удалось прочитать PDF. Заполните профиль вручную.");
  }
  if (text.trim().length < 30) {
    await db().update(resumes).set({ parseStatus: "failed" }).where(eq(resumes.id, row!.id));
    throw unprocessable("В PDF нет текстового слоя (скан?). Заполните профиль вручную.");
  }
  const { draft, parsedBy } = await parseResumeText(text);
  // Contacts are not stored in the resume record: only in the protected contacts table (on confirmation).
  const { contacts, ...withoutContacts } = draft;
  await db()
    .update(resumes)
    .set({ parseStatus: "done", parsedBy, parsedJson: withoutContacts })
    .where(eq(resumes.id, row!.id));
  // Skills from the resume affect ranking only and are always marked as "claimed".
  await setSkills(profileId, draft.skills, "resume");
  // A photo found in the resume becomes the profile photo right away; the candidate can replace or remove it.
  if (photo) await setPhoto(profileId, photo);
  return {
    resumeId: row!.id,
    parsedBy,
    draft: { ...withoutContacts, contacts },
    photo: photo !== null,
  };
}

// ---------------------------------------------------------------- photo

/** JPG or PNG up to 4 MB; metadata (EXIF with GPS, camera serial) is stripped before storing. */
export async function setPhoto(profileId: string, data: Buffer) {
  if (data.length > MAX_UPLOAD_BYTES) throw unprocessable("Файл больше 4 МБ");
  const kind = imageKind(data);
  if (!kind) throw unprocessable("Нужна фотография в формате JPG или PNG");
  const key = await getStorage().put(
    `photos/${profileId}`,
    `photo.${kind === "jpeg" ? "jpg" : "png"}`,
    stripMetadata(data, kind),
    `image/${kind}`,
  );
  await db()
    .update(candidateProfiles)
    .set({ photoKey: key, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, profileId));
  return { ok: true };
}

export async function removePhoto(profileId: string) {
  await db()
    .update(candidateProfiles)
    .set({ photoKey: null, updatedAt: new Date() })
    .where(eq(candidateProfiles.id, profileId));
  return { ok: true };
}

/** The stored photo bytes and type, or null when the profile has none. */
export async function readPhoto(profileId: string) {
  const [p] = await db()
    .select({ key: candidateProfiles.photoKey })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId));
  if (!p?.key) return null;
  const data = await getStorage().get(p.key);
  return { data, type: imageKind(data) === "png" ? "image/png" : "image/jpeg" };
}

/** Photo URL for <img>; the version part changes whenever the photo does, so caches never show an old one. */
export const photoUrl = (base: string, key: string | null) =>
  key ? `${base}?v=${key.slice(-16).replace(/[^\w-]/g, "")}` : null;

// ---------------------------------------------------------------- evidence: certificates and repositories

type AchievementInfo = {
  competition: string;
  discipline: "алгоритмическое" | "продуктовое" | "ИБ" | "робототехника" | "БАС";
  stage: "regional" | "district" | "final";
  year: number;
  place?: number | null;
};

/**
 * Certificate upload: metadata signals decide the trust level. Without risk
 * signals the achievement counts as confirmed by the organizer; with risks it
 * is kept as "claimed" (self) until a moderator or the registry confirms it.
 */
export async function uploadCertificate(
  profileId: string,
  file: { name: string; data: Buffer },
  info: AchievementInfo & { eventDate?: string },
) {
  if (file.data.length > MAX_UPLOAD_BYTES) throw unprocessable("Файл больше 4 МБ");
  const kind = detectKind(file.data);
  if (!kind) throw unprocessable("Поддерживаются PDF, JPG и PNG");
  const meta = await extractMeta(file.data);
  const { checks, trust } = assessCertificate(meta, info.eventDate);
  const key = await getStorage().put(
    `certificates/${profileId}`,
    file.name || `certificate.${kind}`,
    file.data,
    kind === "pdf" ? "application/pdf" : `image/${kind}`,
  );
  const confirmed = trust !== "low";
  const [ach] = await db()
    .insert(fspAchievements)
    .values({
      profileId,
      competition: info.competition,
      discipline: info.discipline,
      stage: info.stage,
      year: info.year,
      place: info.place ?? null,
      source: confirmed ? "organizer" : "self",
      trustLevel: confirmed ? (trust === "high" ? "high" : "medium") : "low",
      evidence: { certificate: true, checks: checks.map((c) => c.code) },
    })
    .returning();
  const [cert] = await db()
    .insert(certificates)
    .values({
      profileId,
      fileKey: key,
      title: info.competition,
      eventDate: info.eventDate ?? null,
      meta: meta as unknown as Record<string, unknown>,
      checks: { items: checks, achievementId: ach!.id },
      trustLevel: trust,
    })
    .returning();
  return { certificateId: cert!.id, trust, checks, meta, achievementSource: ach!.source };
}

export async function verifyRepository(
  profileId: string,
  input: { repo: string; login: string; from: string; to: string } & AchievementInfo,
  fetchImpl?: Parameters<typeof checkRepository>[1],
) {
  let res;
  try {
    res = await checkRepository(input, fetchImpl);
  } catch {
    throw new AppError(
      503,
      "github_unavailable",
      "GitHub API недоступен или превышен лимит запросов — попробуйте позже",
    );
  }
  if (res.ok) {
    await db()
      .insert(fspAchievements)
      .values({
        profileId,
        competition: input.competition,
        discipline: input.discipline,
        stage: input.stage,
        year: input.year,
        place: input.place ?? null,
        source: "repo",
        trustLevel: "medium",
        evidence: { repo: input.repo, login: input.login, commits: res.commits },
      });
  }
  return res;
}

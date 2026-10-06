import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { GRADES, gradeIndex, type Grade, type Specialization, type WorkFormat } from "../config";
import { db } from "../db";
import {
  candidateProfiles,
  candidateSkills,
  categories,
  consents,
  fspAchievements,
  invitations,
  needs,
  searches,
  shortlist,
  users,
  type SnapshotEntry,
} from "../db/schema";
import { notFound } from "../lib/errors";
import { scoreCandidate, type CandidateInput, type MatchResult, type NeedInput } from "../matching/score";
import { skillTitle } from "../matching/skills";

// ---------------------------------------------------------------- pool loading

export interface PoolCandidate extends CandidateInput {
  profileId: string;
  fullName: string;
  specialization: Specialization;
  experienceYears: number | null;
  about: string | null;
  theta: number;
}

/**
 * Hard rule #5: the pool is built from test categories only. A candidate is
 * eligible if they have an ACTIVE category, are visible, are not deleted and
 * have a valid personal-data consent. Self-description never adds anyone.
 */
async function loadPool(where: { spec?: Specialization; grades?: Grade[]; profileIds?: string[] }): Promise<PoolCandidate[]> {
  const conds = [
    eq(categories.status, "active"),
    eq(candidateProfiles.visibility, "visible"),
    isNull(users.deletedAt),
    sql`EXISTS (SELECT 1 FROM ${consents} c WHERE c.user_id = ${users.id} AND c.kind = 'pd_processing' AND c.revoked_at IS NULL)`,
  ];
  if (where.spec) conds.push(eq(categories.specialization, where.spec));
  if (where.grades?.length) conds.push(inArray(categories.grade, where.grades));
  if (where.profileIds) {
    if (!where.profileIds.length) return [];
    conds.push(inArray(candidateProfiles.id, where.profileIds));
  }
  const rows = await db()
    .select({
      profileId: candidateProfiles.id,
      fullName: candidateProfiles.fullName,
      city: candidateProfiles.city,
      about: candidateProfiles.about,
      experienceYears: candidateProfiles.experienceYears,
      salaryFrom: candidateProfiles.salaryExpectFrom,
      salaryTo: candidateProfiles.salaryExpectTo,
      format: candidateProfiles.workFormat,
      lastActiveAt: candidateProfiles.lastActiveAt,
      specialization: categories.specialization,
      grade: categories.grade,
      score: categories.score,
      theta: categories.theta,
      trustLevel: categories.trustLevel,
      assignedAt: categories.assignedAt,
    })
    .from(categories)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, categories.profileId))
    .innerJoin(users, eq(users.id, candidateProfiles.userId))
    .where(and(...conds));
  if (!rows.length) return [];
  const ids = [...new Set(rows.map((r) => r.profileId))];
  // Two batched queries instead of N+1.
  const [skills, achs] = await Promise.all([
    db().select().from(candidateSkills).where(inArray(candidateSkills.profileId, ids)),
    db().select().from(fspAchievements).where(inArray(fspAchievements.profileId, ids)),
  ]);
  const skillsBy = groupBy(skills, (s) => s.profileId);
  const achBy = groupBy(achs, (a) => a.profileId);
  // Without a specialization filter keep one (strongest) category per candidate.
  const unique = where.spec
    ? rows
    : [...groupBy(rows, (r) => r.profileId).values()].map((rs) => rs.sort((a, b) => gradeIndex(b.grade) - gradeIndex(a.grade) || b.score - a.score)[0]!);
  return unique.map((r) => ({
    ...r,
    skills: (skillsBy.get(r.profileId) ?? []).map((s) => ({ skill: s.skill, source: s.source })),
    achievements: (achBy.get(r.profileId) ?? []).map((a) => ({
      competition: a.competition,
      stage: a.stage,
      year: a.year,
      place: a.place,
      source: a.source,
    })),
  }));
}

function groupBy<T, K>(xs: T[], key: (x: T) => K) {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

// ---------------------------------------------------------------- search

export interface SearchQuery {
  specialization: Specialization;
  grades?: Grade[];
  stack: string[];
  salaryFrom?: number | null;
  salaryTo?: number | null;
  format?: WorkFormat | null;
  city?: string | null;
}

export function adjacentGrades(g: Grade): Grade[] {
  const i = gradeIndex(g);
  return GRADES.filter((_, k) => Math.abs(k - i) === 1);
}

function rank(pool: PoolCandidate[], need: NeedInput, nearGrades: Set<Grade>, now: Date): SnapshotEntry[] {
  const scored = pool.map((c) => ({ c, r: scoreCandidate(need, c, now) }));
  const main = scored.filter((x) => !nearGrades.has(x.c.grade)).sort((a, b) => b.r.match - a.r.match || b.c.score - a.c.score);
  const near = scored.filter((x) => nearGrades.has(x.c.grade)).sort((a, b) => b.r.match - a.r.match || b.c.score - a.c.score);
  return [
    ...main.map((x) => ({ profileId: x.c.profileId, match: x.r.match })),
    ...near.map((x) => ({ profileId: x.c.profileId, match: x.r.match, near: true })),
  ];
}

/** Runs the matching for a saved need and stores the ranked list as an immutable snapshot. */
export async function searchForNeed(employerId: string, needId: string, now = new Date()) {
  const [need] = await db().select().from(needs).where(eq(needs.id, needId));
  if (!need || need.employerId !== employerId) throw notFound("Потребность не найдена");
  const near = adjacentGrades(need.grade);
  const pool = await loadPool({ spec: need.specialization, grades: [need.grade, ...near] });
  const snapshot = rank(pool, toNeedInput(need), new Set(near), now);
  const [s] = await db()
    .insert(searches)
    .values({ employerId, needId, baseSnapshot: snapshot, filters: {}, query: { specialization: need.specialization, grade: need.grade } })
    .returning({ id: searches.id });
  return { searchId: s!.id, total: snapshot.length };
}

/** "Поиск по базе": the same ranking without a saved need. */
export async function searchBase(employerId: string, q: SearchQuery, now = new Date()) {
  const pool = await loadPool({ spec: q.specialization, grades: q.grades?.length ? q.grades : undefined });
  const need: NeedInput = {
    grade: q.grades?.length === 1 ? q.grades[0]! : null,
    stack: q.stack,
    salaryFrom: q.salaryFrom ?? null,
    salaryTo: q.salaryTo ?? null,
    format: q.format ?? null,
    city: q.city ?? null,
  };
  const snapshot = rank(pool, need, new Set(), now);
  const [s] = await db()
    .insert(searches)
    .values({ employerId, needId: null, baseSnapshot: snapshot, filters: {}, query: q as unknown as Record<string, unknown> })
    .returning({ id: searches.id });
  return { searchId: s!.id, total: snapshot.length };
}

export function toNeedInput(n: typeof needs.$inferSelect): NeedInput {
  return { grade: n.grade, stack: n.stack, salaryFrom: n.salaryFrom, salaryTo: n.salaryTo, format: n.format, city: n.city };
}

// ---------------------------------------------------------------- results over the snapshot

export interface SearchFilters {
  grades?: Grade[];
  stack?: string[];
  confirmedOnly?: boolean;
  onlyFsp?: boolean;
  minScore?: number;
  city?: string;
  format?: WorkFormat;
  includeNear?: boolean;
}

/** Employer-facing card. Contains NO contacts (hard rule #2) and a masked name. */
export interface CandidateCard {
  profileId: string;
  displayName: string;
  city: string | null;
  experienceYears: number | null;
  category: { specialization: Specialization; grade: Grade; score: number; trustLevel: "high" | "medium" | "low"; assignedAt: Date };
  salaryExpect: { from: number | null; to: number | null };
  workFormat: WorkFormat | null;
  skills: { skill: string; title: string; source: "declared" | "resume" | "test_confirmed" }[];
  fsp: { count: number; confirmed: number; bestPlace: number | null };
  match: number;
  near: boolean;
  pros: string[];
  cons: string[];
  components: MatchResult["components"];
  stack: MatchResult["stack"];
  shortlisted: boolean;
  invitation: { id: string; status: string } | null;
}

/** "Анна Новикова" -> "Анна Н." until the candidate opens contacts. */
export function maskName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Кандидат";
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts[1]![0]}.`;
}

export function toCard(c: PoolCandidate, r: MatchResult, extra: { match: number; near: boolean; shortlisted: boolean; invitation: CandidateCard["invitation"] }): CandidateCard {
  const confirmed = c.achievements.filter((a) => a.source !== "self");
  const order = { test_confirmed: 0, resume: 1, declared: 2 } as const;
  const seen = new Set<string>();
  const skills = [...c.skills]
    .sort((a, b) => order[a.source] - order[b.source])
    .filter((s) => (seen.has(s.skill) ? false : (seen.add(s.skill), true)))
    .slice(0, 12)
    .map((s) => ({ skill: s.skill, title: skillTitle(s.skill), source: s.source }));
  return {
    profileId: c.profileId,
    displayName: maskName(c.fullName),
    city: c.city,
    experienceYears: c.experienceYears,
    category: { specialization: c.specialization, grade: c.grade, score: c.score, trustLevel: c.trustLevel, assignedAt: c.assignedAt },
    salaryExpect: { from: c.salaryFrom, to: c.salaryTo },
    workFormat: c.format,
    skills,
    fsp: {
      count: c.achievements.length,
      confirmed: confirmed.length,
      bestPlace: confirmed.reduce<number | null>((b, a) => (a.place && (b === null || a.place < b) ? a.place : b), null),
    },
    match: extra.match,
    near: extra.near,
    pros: r.pros,
    cons: r.cons,
    components: r.components,
    stack: r.stack,
    shortlisted: extra.shortlisted,
    invitation: extra.invitation,
  };
}

function passes(card: CandidateCard, f: SearchFilters, c: PoolCandidate) {
  if (f.includeNear === false && card.near) return false;
  if (f.grades?.length && !f.grades.includes(card.category.grade)) return false;
  if (f.onlyFsp && card.fsp.confirmed === 0) return false;
  if (f.minScore !== undefined && card.category.score < f.minScore) return false;
  if (f.city && (card.city ?? "").toLowerCase() !== f.city.toLowerCase()) return false;
  if (f.format && card.workFormat !== f.format) return false;
  if (f.stack?.length) {
    const ok = f.stack.every((s) =>
      f.confirmedOnly ? c.skills.some((x) => x.skill === s && x.source === "test_confirmed") : c.skills.some((x) => x.skill === s),
    );
    if (!ok) return false;
  }
  return true;
}

async function relations(employerId: string, ids: string[]) {
  if (!ids.length) return { sl: new Set<string>(), inv: new Map<string, { id: string; status: string }>() };
  const [sl, inv] = await Promise.all([
    db().select({ p: shortlist.profileId }).from(shortlist).where(and(eq(shortlist.employerId, employerId), inArray(shortlist.profileId, ids))),
    db()
      .select({ id: invitations.id, p: invitations.profileId, status: invitations.status, createdAt: invitations.createdAt })
      .from(invitations)
      .where(and(eq(invitations.employerId, employerId), inArray(invitations.profileId, ids)))
      .orderBy(desc(invitations.createdAt)),
  ]);
  const invMap = new Map<string, { id: string; status: string }>();
  for (const i of inv) if (!invMap.has(i.p)) invMap.set(i.p, { id: i.id, status: i.status });
  return { sl: new Set(sl.map((x) => x.p)), inv: invMap };
}

/**
 * Applies filters ON TOP of the stored snapshot: the original list is never
 * modified, "reset" simply means empty filters. Candidates who hid their
 * profile or lost eligibility since the search are dropped (privacy first).
 */
export async function searchResults(employerId: string, searchId: string, filters: SearchFilters, page = 1, pageSize = 20, now = new Date()) {
  const [s] = await db().select().from(searches).where(eq(searches.id, searchId));
  if (!s || s.employerId !== employerId) throw notFound("Подборка не найдена");
  const need = s.needId ? (await db().select().from(needs).where(eq(needs.id, s.needId)))[0] : undefined;
  const q = (s.query ?? {}) as unknown as SearchQuery;
  const needInput: NeedInput = need
    ? toNeedInput(need)
    : { grade: q.grades?.length === 1 ? q.grades[0]! : null, stack: q.stack ?? [], salaryFrom: q.salaryFrom ?? null, salaryTo: q.salaryTo ?? null, format: q.format ?? null, city: q.city ?? null };

  const snap = s.baseSnapshot;
  const pool = await loadPool({ profileIds: snap.map((e) => e.profileId), spec: (need?.specialization ?? q.specialization) as Specialization });
  const byId = new Map(pool.map((c) => [c.profileId, c]));
  const rel = await relations(employerId, pool.map((c) => c.profileId));
  const all: CandidateCard[] = [];
  for (const e of snap) {
    const c = byId.get(e.profileId);
    if (!c) continue;
    const r = scoreCandidate(needInput, c, now);
    const card = toCard(c, r, { match: e.match, near: Boolean(e.near), shortlisted: rel.sl.has(c.profileId), invitation: rel.inv.get(c.profileId) ?? null });
    if (passes(card, filters, c)) all.push(card);
  }
  await db().update(searches).set({ filters: filters as Record<string, unknown> }).where(eq(searches.id, searchId));
  const facets = {
    cities: [...new Set(pool.map((c) => c.city).filter((x): x is string => Boolean(x)))].sort(),
    skills: [...new Set(pool.flatMap((c) => c.skills.map((x) => x.skill)))].sort().map((k) => ({ skill: k, title: skillTitle(k) })),
  };
  return {
    search: { id: s.id, needId: s.needId, createdAt: s.createdAt, query: s.query, need: need ? { id: need.id, title: need.title, specialization: need.specialization, grade: need.grade, stack: need.stack, salaryFrom: need.salaryFrom, salaryTo: need.salaryTo, format: need.format, city: need.city } : null },
    baseTotal: snap.length,
    dropped: snap.length - pool.length,
    total: all.length,
    page,
    pageSize,
    items: all.slice((page - 1) * pageSize, page * pageSize),
    filters,
    facets,
  };
}

export async function listSearches(employerId: string, limit = 20) {
  return db()
    .select({ id: searches.id, needId: searches.needId, createdAt: searches.createdAt, query: searches.query, total: sql<number>`jsonb_array_length(${searches.baseSnapshot})` })
    .from(searches)
    .where(eq(searches.employerId, employerId))
    .orderBy(desc(searches.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------- shortlist

export async function addToShortlist(employerId: string, profileId: string, note?: string) {
  const pool = await loadPool({ profileIds: [profileId] });
  if (!pool.length) throw notFound("Кандидат не найден");
  await db().insert(shortlist).values({ employerId, profileId, note: note ?? null }).onConflictDoNothing();
  return { ok: true };
}

export async function removeFromShortlist(employerId: string, profileId: string) {
  await db().delete(shortlist).where(and(eq(shortlist.employerId, employerId), eq(shortlist.profileId, profileId)));
  return { ok: true };
}

export async function listShortlist(employerId: string, now = new Date()) {
  const rows = await db().select().from(shortlist).where(eq(shortlist.employerId, employerId)).orderBy(desc(shortlist.createdAt));
  const pool = await loadPool({ profileIds: rows.map((r) => r.profileId) });
  const byId = new Map(pool.map((c) => [c.profileId, c]));
  const rel = await relations(employerId, pool.map((c) => c.profileId));
  return rows
    .map((r) => {
      const c = byId.get(r.profileId);
      if (!c) return null;
      const res = scoreCandidate({ grade: c.grade, stack: [], salaryFrom: null, salaryTo: null, format: null, city: null }, c, now);
      return { ...toCard(c, res, { match: res.match, near: false, shortlisted: true, invitation: rel.inv.get(c.profileId) ?? null }), note: r.note, addedAt: r.createdAt };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

export { loadPool };

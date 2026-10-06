import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../db";
import { needs, searches } from "../db/schema";
import { notFound } from "../lib/errors";
import type { needCreateSchema } from "../schemas/needs";

type NeedInput = z.infer<typeof needCreateSchema>;

export async function createNeed(employerId: string, input: NeedInput) {
  const [n] = await db()
    .insert(needs)
    .values({
      employerId,
      title: input.title,
      specialization: input.specialization,
      grade: input.grade,
      stack: input.stack,
      salaryFrom: input.salaryFrom,
      salaryTo: input.salaryTo,
      format: input.format ?? null,
      city: input.city ?? null,
      teamAbout: input.teamAbout ?? null,
      rawText: input.rawText ?? null,
      parsedBy: input.parsedBy,
    })
    .returning();
  return n!;
}

export async function getNeed(employerId: string, id: string) {
  const [n] = await db().select().from(needs).where(and(eq(needs.id, id), eq(needs.employerId, employerId)));
  if (!n) throw notFound("Потребность не найдена");
  return n;
}

export async function listNeeds(employerId: string) {
  return db()
    .select({
      need: needs,
      searches: sql<number>`(SELECT count(*)::int FROM ${searches} s WHERE s.need_id = ${needs.id})`,
      lastSearchId: sql<string | null>`(SELECT s.id FROM ${searches} s WHERE s.need_id = ${needs.id} ORDER BY s.created_at DESC LIMIT 1)`,
    })
    .from(needs)
    .where(eq(needs.employerId, employerId))
    .orderBy(desc(needs.createdAt));
}

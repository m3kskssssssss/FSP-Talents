import { z } from "zod";
import { normalizeSkill } from "../matching/skills";
import { gradeSchema, salaryRangeShape, specializationSchema, workFormatSchema, withSalaryRange } from "./common";

export const stackSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((xs) => [...new Set(xs.map((x) => normalizeSkill(x) ?? x.toLowerCase()))]);

export const needCreateSchema = withSalaryRange({
  title: z.string().trim().min(3, "Название — минимум 3 символа").max(160),
  specialization: specializationSchema,
  grade: gradeSchema,
  stack: stackSchema.default([]),
  format: workFormatSchema.nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  teamAbout: z.string().trim().max(3000).nullable().optional(),
  rawText: z.string().max(20000).nullable().optional(),
  parsedBy: z.enum(["llm", "form", "rules"]).default("form"),
});

export const needParseSchema = z.object({ text: z.string().trim().min(20, "Вставьте текст вакансии (минимум 20 символов)").max(20000) });

export const baseSearchSchema = z
  .object({
    specialization: specializationSchema,
    grades: z.array(gradeSchema).max(3).optional(),
    stack: stackSchema.default([]),
    salaryFrom: salaryRangeShape.salaryFrom.nullable().optional(),
    salaryTo: salaryRangeShape.salaryTo.nullable().optional(),
    format: workFormatSchema.nullable().optional(),
    city: z.string().trim().max(80).nullable().optional(),
  })
  .refine((v) => !v.salaryFrom || !v.salaryTo || v.salaryFrom <= v.salaryTo, { message: "«от» больше «до»", path: ["salaryTo"] });

const csv = <T extends z.ZodType>(inner: T) => z.preprocess((v) => (typeof v === "string" ? (v ? v.split(",") : []) : v), inner);
const bool = z.preprocess((v) => v === "1" || v === "true" || v === true, z.boolean());

export const searchFiltersSchema = z.object({
  grades: csv(z.array(gradeSchema)).optional(),
  stack: csv(z.array(z.string().max(40)).max(20)).optional(),
  confirmedOnly: bool.optional(),
  onlyFsp: bool.optional(),
  minScore: z.coerce.number().min(0).max(30).optional(),
  city: z.string().max(80).optional(),
  format: workFormatSchema.optional(),
  includeNear: z.preprocess((v) => (v === undefined ? undefined : v === "1" || v === "true"), z.boolean().optional()),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

export const rephraseSchema = z.object({ profileIds: z.array(z.uuid()).min(1).max(10) });

import { z } from "zod";
import { gradeSchema, specializationSchema, workFormatSchema, withSalaryRange } from "./common";
import { stackSchema } from "./needs";

/** Hard rule #1 applies to vacancies too. */
export const vacancyCreateSchema = withSalaryRange({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20, "Опишите вакансию — минимум 20 символов").max(6000),
  specialization: specializationSchema,
  grade: gradeSchema,
  stack: stackSchema.default([]),
  format: workFormatSchema.nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
});

export const vacancyListSchema = z.object({ specialization: specializationSchema.optional(), mine: z.preprocess((v) => v === "1", z.boolean()).optional() });
export const applySchema = z.object({ coverLetter: z.string().trim().max(3000).optional() });
export const applicationStatusSchema = z.object({ status: z.enum(["viewed", "accepted", "declined"]) });

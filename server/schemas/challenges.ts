import { z } from "zod";
import { TESTABLE_SPECIALIZATIONS } from "../config";
import { gradeSchema } from "./common";

export const challengeCreateSchema = z
  .object({
    title: z.string().trim().min(3, "Название — минимум 3 символа").max(160),
    statement: z.string().trim().min(20, "Опишите задачу хотя бы в 20 символах").max(4000),
    specialization: z.enum(TESTABLE_SPECIALIZATIONS),
    grade: gradeSchema.nullable().optional(),
    kind: z.enum(["exact", "open"]),
    expectedAnswer: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => v.kind === "open" || Boolean(v.expectedAnswer), {
    message: "Для задачи с проверкой по ответу укажите эталон",
    path: ["expectedAnswer"],
  });

export const challengeAnswerSchema = z.object({
  answer: z.string().trim().min(1, "Пустой ответ").max(4000, "Ответ длиннее 4000 символов"),
});

export const challengeGradeSchema = z.object({
  score: z.number().int().min(0).max(3),
  feedback: z.string().trim().max(1000).nullable().optional(),
});

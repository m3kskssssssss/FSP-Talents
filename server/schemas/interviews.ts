import { z } from "zod";

export const INTERVIEW_LANGUAGES = ["python", "javascript", "sql"] as const;
/** One data-channel message carries the whole editor, so the code stays small. */
export const INTERVIEW_CODE_MAX = 8000;

export const interviewCreateSchema = z.object({
  scheduledAt: z.coerce.date({ error: "Укажите дату и время" }),
  durationMin: z.coerce
    .number()
    .int()
    .min(15, "Не короче 15 минут")
    .max(180, "Не длиннее 3 часов")
    .default(60),
  language: z.enum(INTERVIEW_LANGUAGES).default("python"),
  task: z.string().trim().max(4000, "Задание длиннее 4000 символов").optional(),
});

export const interviewCodeSchema = z.object({
  code: z.string().max(INTERVIEW_CODE_MAX, `Код длиннее ${INTERVIEW_CODE_MAX} символов`),
  language: z.enum(INTERVIEW_LANGUAGES),
});

export const interviewFinishSchema = z.object({
  rating: z.coerce.number().int().min(1, "Оценка от 1 до 5").max(5, "Оценка от 1 до 5"),
  notes: z.string().trim().max(4000, "Заметки длиннее 4000 символов").optional(),
});

import { z } from "zod";
import { TESTABLE_SPECIALIZATIONS } from "../config";
import { salaryRangeShape, workFormatSchema } from "./common";
import { stackSchema } from "./needs";

const opt = <T extends z.ZodType>(s: T) => s.nullable().optional();

export const profileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2, "Укажите имя").max(200),
    city: opt(z.string().trim().max(80)),
    about: opt(z.string().trim().max(3000)),
    experienceYears: opt(z.number().min(0).max(60)),
    salaryExpectFrom: opt(salaryRangeShape.salaryFrom),
    salaryExpectTo: opt(salaryRangeShape.salaryTo),
    workFormat: opt(workFormatSchema),
    survey: opt(
      z.object({
        specialization: z.enum(TESTABLE_SPECIALIZATIONS),
        interests: z.array(z.string().max(60)).max(15).default([]),
        yearsInSpec: z.number().min(0).max(60).optional(),
      }),
    ),
    onboarded: z.boolean().optional(),
  })
  .refine((v) => !v.salaryExpectFrom || !v.salaryExpectTo || v.salaryExpectFrom <= v.salaryExpectTo, { message: "«от» больше «до»", path: ["salaryExpectTo"] });

export const contactsSchema = z.object({
  email: z.email("Некорректный email").max(200).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(40).regex(/^[+\d\s()-]*$/, "Только цифры, пробелы, + ( ) -").optional(),
  telegram: z.string().trim().max(40).regex(/^@?[\w]{0,32}$/, "Например, @username").optional(),
  links: z.array(z.url("Некорректная ссылка").max(300)).max(5).optional(),
});

export const skillsSchema = z.object({ skills: stackSchema });
export const visibilitySchema = z.object({ visibility: z.enum(["visible", "hidden"]) });
export const consentSchema = z.object({ kind: z.enum(["pd_processing", "privacy_policy", "marketing"]), granted: z.boolean() });
export const fspLinkSchema = z.object({ fspId: z.string().trim().toUpperCase().regex(/^FSP-\d{6}$/, "Формат ФСП ID: FSP-123456") });
export const selfAchievementSchema = z.object({
  competition: z.string().trim().min(3).max(200),
  discipline: z.enum(["алгоритмическое", "продуктовое", "ИБ", "робототехника", "БАС"]),
  stage: z.enum(["regional", "district", "final"]),
  year: z.number().int().min(2015).max(new Date().getFullYear()),
  place: z.number().int().min(1).max(1000).nullable().optional(),
});
export const deleteAccountSchema = z.object({ confirm: z.literal("УДАЛИТЬ", { error: "Введите слово УДАЛИТЬ" }) });

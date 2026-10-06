import { z } from "zod";
import { GRADES, SALARY_LIMITS, SPECIALIZATIONS, WORK_FORMATS } from "../config";

export const specializationSchema = z.enum(SPECIALIZATIONS);
export const gradeSchema = z.enum(GRADES);
export const workFormatSchema = z.enum(WORK_FORMATS);
export const uuidSchema = z.uuid();

const rub = (label: string) =>
  z
    .number({ error: `${label}: укажите сумму в рублях` })
    .int(`${label}: целое число рублей`)
    .min(SALARY_LIMITS.min, `${label}: сумма должна быть больше 0`)
    .max(SALARY_LIMITS.max, `${label}: слишком большая сумма`);

/**
 * Hard rule #1: every vacancy, need and invitation carries a salary range in
 * roubles, integers, 0 < from <= to. Missing range -> 422.
 */
export const salaryRangeShape = {
  salaryFrom: rub("Зарплата «от»"),
  salaryTo: rub("Зарплата «до»"),
};

export type SalaryRange = { salaryFrom: number; salaryTo: number };

export function withSalaryRange<T extends z.ZodRawShape>(shape: T) {
  return z
    .object({ ...shape, ...salaryRangeShape })
    .refine((v) => (v as SalaryRange).salaryFrom <= (v as SalaryRange).salaryTo, {
      message: "Зарплата «от» не может быть больше «до»",
      path: ["salaryTo"],
    });
}

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

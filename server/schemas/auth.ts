import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Пароль — минимум 8 символов")
  .max(128, "Пароль слишком длинный")
  .regex(/[A-Za-zА-Яа-я]/, "Пароль должен содержать буквы")
  .regex(/\d/, "Пароль должен содержать цифры");

export const registerSchema = z
  .object({
    email: z.email("Некорректный email").max(200).transform((s) => s.trim().toLowerCase()),
    password: passwordSchema,
    role: z.enum(["candidate", "employer"]),
    fullName: z.string().trim().max(200).optional(),
    companyName: z.string().trim().max(200).optional(),
    consents: z.object({
      pd_processing: z.literal(true, { error: "Нужно согласие на обработку персональных данных" }),
      privacy_policy: z.literal(true, { error: "Нужно принять политику конфиденциальности" }),
      marketing: z.boolean().optional(),
    }),
  })
  .refine((v) => v.role !== "employer" || (v.companyName && v.companyName.length >= 2), {
    message: "Укажите название компании",
    path: ["companyName"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export const verifyEmailSchema = z.object({ token: z.string().min(10).max(200) });

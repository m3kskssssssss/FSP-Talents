import { z } from "zod";
import { uuidSchema, withSalaryRange, workFormatSchema } from "./common";

/** Hard rule #1: the salary range is mandatory in every invitation. */
export const invitationCreateSchema = withSalaryRange({
  profileId: uuidSchema,
  needId: uuidSchema.nullable().optional(),
  title: z.string().trim().min(3, "Укажите должность").max(160),
  description: z.string().trim().min(10, "Опишите задачу — минимум 10 символов").max(4000),
  format: workFormatSchema.nullable().optional(),
});
export type InvitationCreate = z.infer<typeof invitationCreateSchema>;

export const invitationDecisionSchema = z.object({
  decision: z.enum(["accept", "decline"]),
  reason: z.string().trim().max(1000).optional(),
});

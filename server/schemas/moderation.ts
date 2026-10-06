import { z } from "zod";

export const reviewSchema = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().trim().max(1000).optional() });
export const templateStatusSchema = z.object({ status: z.enum(["active", "flagged", "retired"]) });
export const attemptsFilterSchema = z.object({
  level: z.enum(["low", "medium", "high"]).optional(),
  pending: z.preprocess((v) => v === "1" || v === "true", z.boolean()).optional(),
});

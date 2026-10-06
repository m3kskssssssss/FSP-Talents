import { z } from "zod";
import { TESTABLE_SPECIALIZATIONS } from "../config";
import { gradeSchema } from "./common";

export const startAttemptSchema = z.object({
  specialization: z.enum(TESTABLE_SPECIALIZATIONS),
  grade: gradeSchema,
  acknowledgeMonitoring: z.literal(true, { error: "Подтвердите, что ознакомлены с правилами прохождения" }),
});

const json = z.unknown();
const codeOutput = z.union([z.object({ ok: z.literal(true), value: json }), z.object({ ok: z.literal(false), error: z.string().max(2000) })]);

export const answerSchema = z.object({
  timeMs: z.number().int().min(0).max(4 * 60 * 60 * 1000).optional(),
  skipped: z.boolean().optional(),
  answer: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("code"),
        language: z.enum(["python", "javascript"]),
        code: z.string().max(50_000),
        outputs: z.array(codeOutput).max(200),
      }),
      z.object({
        kind: z.literal("sql"),
        code: z.string().max(20_000),
        result: z.union([
          z.object({ columns: z.array(z.string()).max(50), rows: z.array(z.array(json)).max(5000) }),
          z.object({ error: z.string().max(2000) }),
        ]),
      }),
      z.object({ kind: z.literal("calc"), value: z.string().max(100) }),
      z.object({ kind: z.literal("quiz"), selected: z.array(z.string().max(20)).max(10) }),
    ])
    .optional(),
});

export const attemptEventsSchema = z.object({
  events: z
    .array(
      z.object({
        type: z.enum(["visibility_hidden", "blur", "copy", "paste", "fullscreen_exit", "fullscreen_enter", "bulk_insert", "context_menu", "devtools"]),
        itemId: z.uuid().optional(),
        // Only sizes/timings, never the clipboard content itself.
        payload: z.record(z.string(), z.union([z.number(), z.string().max(50), z.boolean()])).optional(),
        at: z.number().int().optional(),
      }),
    )
    .max(100),
});

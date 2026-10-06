import type { Specialization } from "../../config";
import type { Template } from "../types";
import { backendCalc } from "./backend/calc";
import { backendCode } from "./backend/code";
import { backendQuiz } from "./backend/quiz";
import { backendSql } from "./backend/sql";
import { dataBank } from "./data";
import { frontendCode } from "./frontend/code";
import { frontendCalc, frontendQuiz } from "./frontend/other";
import { qaBank } from "./qa";

/** Single registry of all task templates (generator code lives in the repo, metadata is synced to DB). */
export const BANK: Template[] = [
  ...backendCode,
  ...backendSql,
  ...backendCalc,
  ...backendQuiz,
  ...frontendCode,
  ...frontendCalc,
  ...frontendQuiz,
  ...dataBank,
  ...qaBank,
];

const byId = new Map(BANK.map((t) => [t.id, t]));

export function getTemplate(id: string): Template {
  const t = byId.get(id);
  if (!t) throw new Error(`unknown template ${id}`);
  return t;
}

export const templatesFor = (spec: Specialization) => BANK.filter((t) => t.specialization === spec);

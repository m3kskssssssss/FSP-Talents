import type { Specialization } from "../../config";
import type { Template } from "../types";
import { backendCalc } from "./backend/calc";
import { backendCode } from "./backend/code";
import { backendQuiz } from "./backend/quiz";
import { backendSql } from "./backend/sql";

/** Single registry of all task templates (generator code lives in the repo, metadata is synced to DB). */
export const BANK: Template[] = [...backendCode, ...backendSql, ...backendCalc, ...backendQuiz];

const byId = new Map(BANK.map((t) => [t.id, t]));

export function getTemplate(id: string): Template {
  const t = byId.get(id);
  if (!t) throw new Error(`unknown template ${id}`);
  return t;
}

export const templatesFor = (spec: Specialization) => BANK.filter((t) => t.specialization === spec);

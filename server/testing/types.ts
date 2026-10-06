/* eslint-disable @typescript-eslint/no-explicit-any -- templates carry heterogeneous param types */
import type { Specialization } from "../config";
import type { Rng } from "./rng";

export type TaskKind = "code" | "sql" | "calc" | "quiz";
export type CodeLanguage = "python" | "javascript";

/** A piece of statement text. `twin` renders `shown` on screen but `dom` in the DOM text (trap #4). */
export type Inline = string | { code: string } | { twin: { shown: string; dom: string } } | { b: string };

export type Block =
  | { type: "p"; parts: Inline[] }
  | { type: "code"; text: string; lang?: string }
  | { type: "list"; items: Inline[][] }
  | { type: "table"; head: string[]; rows: (Inline | number)[][] };

/** Helper passed to statement renderers: wraps a param value as a twin if it is the twin param. */
export interface TwinCtx {
  v(key: string, value: string | number): Inline;
}

export type Value = unknown;
export type Compare = "exact" | "unordered" | { float: number };

interface BaseTemplate<P> {
  id: string;
  specialization: Specialization;
  title: string;
  /** Skills confirmed by a correct answer. */
  skills: string[];
  /** Expert IRT parameters (2PL); recalibrated by scripts/calibrate.ts. */
  b: number;
  a: number;
  params(rng: Rng): P;
  /**
   * Trap #4 (value twin): returns params where one shown constant is replaced
   * by a different value that only exists in the DOM text.
   */
  twin?: { key: string; alt(p: P, rng: Rng): P };
  statement(p: P, t: TwinCtx): Block[];
}

export interface CodeTemplate<P = any> extends BaseTemplate<P> {
  kind: "code";
  languages: CodeLanguage[];
  fn: { name: string; args: { name: string; type: string }[]; returns: string };
  examples(p: P, rng: Rng): Value[][];
  hidden(p: P, rng: Rng): Value[][];
  solve(p: P, args: Value[]): Value;
  compare?: Compare;
  /** Reference solutions as source code; verified against `solve` in unit tests. */
  reference: Partial<Record<CodeLanguage, (p: P) => string>>;
}

export interface SqlTemplate<P = any> extends BaseTemplate<P> {
  kind: "sql";
  schema: string;
  /** INSERT statements for a dataset; public (shown) and hidden ones use different rngs. */
  data(p: P, rng: Rng, size: "public" | "hidden"): string;
  reference(p: P): string;
  ordered: boolean;
}

export interface CalcTemplate<P = any> extends BaseTemplate<P> {
  kind: "calc";
  answer(p: P): number | string;
  /** Hint shown under the input, e.g. "целое число" */
  answerHint: string;
  tolerance?: number;
}

export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizTemplate<P = any> extends BaseTemplate<P> {
  kind: "quiz";
  options(p: P, rng: Rng): QuizOption[];
  multi?: boolean;
}

export type Template = CodeTemplate | SqlTemplate | CalcTemplate | QuizTemplate;

export interface RegisteredBank {
  templates: Template[];
}

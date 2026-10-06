import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { attemptItems } from "../server/db/schema";
import { getTemplate } from "../server/testing/bank";
import { instanceParams, referenceAnswer, renderItem } from "../server/testing/engine";
import type { CodeTemplate } from "../server/testing/types";

/**
 * Plays the role of a strong candidate: reads the current item's secret seed
 * from the database (the browser never has it) and produces the reference
 * solution to type into the UI. Used only by end-to-end tests.
 */
const sql = postgres(process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://fsp:fsp@localhost:5432/fsp", { max: 1, onnotice: () => {} });
const db = drizzle(sql);

export type Solution =
  | { kind: "code"; language: "javascript"; code: string }
  | { kind: "sql"; code: string }
  | { kind: "calc"; value: string }
  | { kind: "quiz"; texts: string[] };

export async function solutionFor(itemId: string): Promise<Solution> {
  const [item] = await db.select().from(attemptItems).where(eq(attemptItems.id, itemId));
  if (!item) throw new Error(`item ${itemId} not found`);
  const t = getTemplate(item.templateId);
  if (t.kind === "code") {
    const { p } = instanceParams(t, item.seed);
    return { kind: "code", language: "javascript", code: (t as CodeTemplate).reference.javascript(p) };
  }
  if (t.kind === "sql") return { kind: "sql", code: t.reference(instanceParams(t, item.seed).p) };
  const ref = await referenceAnswer(t, item.seed, "none");
  if (ref.kind === "calc") return { kind: "calc", value: ref.value };
  if (ref.kind !== "quiz") throw new Error("unexpected kind");
  const { view } = await renderItem(t, item.seed, item.marker);
  return { kind: "quiz", texts: view.quiz!.options.filter((o) => ref.selected.includes(o.id)).map((o) => o.text) };
}

export async function closeDb() {
  await sql.end();
}

import { z } from "zod";
import { structured } from "../llm";

export interface Arguments {
  id: string;
  pros: string[];
  cons: string[];
}

const numbers = (s: string) => new Set((s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => x.replace(",", ".")));

/** Guard against hallucinations: the rephrased text may not contain numbers absent from the source. */
export function introducesNewFacts(source: string[], out: string[]) {
  const allowed = numbers(source.join(" "));
  return out.some((s) => [...numbers(s)].some((n) => !allowed.has(n)));
}

const outSchema = z.object({
  items: z.array(z.object({ id: z.string(), pros: z.array(z.string().max(220)), cons: z.array(z.string().max(220)) })),
});

/**
 * One LLM call per request (no chains): rewrites deterministic arguments into
 * natural Russian WITHOUT adding facts. Any item that fails validation keeps
 * its template text.
 */
export async function rephraseArguments(items: Arguments[]): Promise<{ items: Arguments[]; source: "llm" | "templates" }> {
  const res = await structured(
    "rephrase_arguments",
    outSchema,
    [
      {
        role: "system",
        content:
          "Ты редактор. Перефразируй доводы «за» и «против» кандидата для работодателя живым деловым русским языком. " +
          "Строгие правила: не добавляй никаких новых фактов, чисел, навыков, оценок и выводов; сохрани количество и порядок доводов; " +
          "каждый довод — одно короткое предложение до 120 символов. Слова «не проверено тестом», «заявлено» сохраняй по смыслу.",
      },
      { role: "user", content: JSON.stringify({ items }) },
    ],
    { maxTokens: 1500, budgetMs: 20000 },
  );
  if (!res) return { items, source: "templates" };
  const byId = new Map(res.items.map((i) => [i.id, i]));
  const merged = items.map((orig) => {
    const r = byId.get(orig.id);
    if (!r || r.pros.length !== orig.pros.length || r.cons.length !== orig.cons.length) return orig;
    if (introducesNewFacts([...orig.pros, ...orig.cons], [...r.pros, ...r.cons])) return orig;
    return { id: orig.id, pros: r.pros, cons: r.cons };
  });
  return { items: merged, source: "llm" };
}

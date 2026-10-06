import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { llmCache } from "../db/schema";
import { env } from "../env";
import { sha256 } from "../lib/crypto";

/**
 * RouterAI (OpenAI-compatible) client. Rules:
 *  - server-only, key never reaches the client;
 *  - explicit timeout, retries with exponential backoff, token limit;
 *  - structured output validated by Zod (json_schema, falling back to JSON
 *    mode + validation + one retry);
 *  - results cached by input hash;
 *  - every caller has a deterministic fallback: null means "use rules".
 */
export const llmEnabled = () => Boolean(env().LLM_API_KEY);

type Msg = { role: "system" | "user"; content: string };

let clientPromise: Promise<import("openai").default> | null = null;
async function client() {
  if (!clientPromise) {
    clientPromise = import("openai").then(
      ({ default: OpenAI }) =>
        new OpenAI({ baseURL: env().LLM_BASE_URL, apiKey: env().LLM_API_KEY, timeout: env().LLM_TIMEOUT_MS, maxRetries: 0 }),
    );
  }
  return clientPromise;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const status = (e as { status?: number }).status;
      if (status && status < 500 && status !== 429) break; // client errors are not retried
      await sleep(400 * 2 ** i);
    }
  }
  throw last;
}

export interface StructuredOpts {
  model?: "fast" | "strong";
  maxTokens?: number;
  cacheKey?: string;
  /** Overall budget for this call, ms (keeps serverless functions within limits). */
  budgetMs?: number;
}

export async function structured<T extends z.ZodType>(
  name: string,
  schema: T,
  messages: Msg[],
  opts: StructuredOpts = {},
): Promise<z.infer<T> | null> {
  if (!llmEnabled()) return null;
  const e = env();
  const model = opts.model === "strong" ? e.LLM_MODEL_STRONG : e.LLM_MODEL;
  const key = sha256(JSON.stringify({ name, model, messages, v: 1 }));
  try {
    const [hit] = await db().select().from(llmCache).where(eq(llmCache.key, key));
    if (hit) {
      const parsed = schema.safeParse(hit.value);
      if (parsed.success) return parsed.data;
    }
  } catch {
    /* cache is best effort */
  }

  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  const deadline = Date.now() + (opts.budgetMs ?? e.LLM_TIMEOUT_MS);
  const c = await client();

  const call = async (mode: "schema" | "json", extra: Msg[] = []) => {
    const left = deadline - Date.now();
    if (left < 1000) throw new Error("llm budget exhausted");
    const res = await c.chat.completions.create(
      {
        model,
        messages: [...messages, ...extra],
        max_tokens: opts.maxTokens ?? 1200,
        temperature: 0,
        response_format:
          mode === "schema"
            ? { type: "json_schema", json_schema: { name, schema: jsonSchema, strict: false } }
            : { type: "json_object" },
      },
      { timeout: left },
    );
    const text = res.choices[0]?.message?.content ?? "";
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as unknown;
  };

  try {
    let raw: unknown;
    try {
      raw = await withRetry(() => call("schema"));
    } catch {
      raw = await withRetry(() =>
        call("json", [{ role: "system", content: `Ответь строго JSON по схеме:\n${JSON.stringify(jsonSchema)}` }]),
      );
    }
    let parsed = schema.safeParse(raw);
    if (!parsed.success) {
      // One repair attempt with the validation errors.
      raw = await call("json", [
        { role: "system", content: `Предыдущий ответ не прошёл проверку: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Верни исправленный JSON по схеме ${JSON.stringify(jsonSchema)}` },
      ]);
      parsed = schema.safeParse(raw);
    }
    if (!parsed.success) return null;
    try {
      await db().insert(llmCache).values({ key, value: parsed.data as object }).onConflictDoNothing();
    } catch {
      /* ignore */
    }
    return parsed.data;
  } catch (err) {
    console.warn(`[llm] ${name} failed, using fallback:`, (err as Error).message);
    return null;
  }
}

export async function embed(texts: string[]): Promise<number[][] | null> {
  if (!llmEnabled() || !texts.length) return null;
  try {
    const c = await client();
    const res = await withRetry(() => c.embeddings.create({ model: env().LLM_EMBEDDING_MODEL, input: texts }, { timeout: env().LLM_TIMEOUT_MS }));
    return res.data.map((d) => d.embedding);
  } catch (err) {
    console.warn("[llm] embeddings failed:", (err as Error).message);
    return null;
  }
}

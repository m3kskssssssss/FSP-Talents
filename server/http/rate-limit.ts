import { env } from "../env";

type Result = { ok: boolean; remaining: number };

/**
 * Fixed-window rate limiter. Uses Upstash Redis when configured; otherwise an
 * in-memory map. NB: on serverless the in-memory variant is per-instance and
 * therefore only a best-effort guard (documented in docs/security.md).
 */
const memory = new Map<string, { count: number; resetAt: number }>();
let upstash: ((key: string, limit: number, windowSec: number) => Promise<Result>) | null | undefined;

async function getUpstash() {
  if (upstash !== undefined) return upstash;
  const e = env();
  if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) return (upstash = null);
  const { Redis } = await import("@upstash/redis");
  const { Ratelimit } = await import("@upstash/ratelimit");
  const redis = new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN });
  const cache = new Map<string, InstanceType<typeof Ratelimit>>();
  upstash = async (key, limit, windowSec) => {
    const id = `${limit}:${windowSec}`;
    let rl = cache.get(id);
    if (!rl) {
      rl = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(limit, `${windowSec} s`), prefix: "fsp-rl" });
      cache.set(id, rl);
    }
    const r = await rl.limit(key);
    return { ok: r.success, remaining: r.remaining };
  };
  return upstash;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<Result> {
  if (env().NODE_ENV === "test" && !process.env.RATE_LIMIT_IN_TESTS) return { ok: true, remaining: limit };
  const u = await getUpstash();
  if (u) return u(key, limit, windowSec);
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1 };
  }
  cur.count++;
  return { ok: cur.count <= limit, remaining: Math.max(0, limit - cur.count) };
}

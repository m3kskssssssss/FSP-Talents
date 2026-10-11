import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgres://fsp:fsp@localhost:5432/fsp"),
  /** Base URL for links in emails; see appUrl() for the fallback. */
  APP_URL: z.string().optional(),
  /** Set by Vercel: production domain and per-deployment domain, without scheme. */
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  AUTH_SECRET: z.string().optional(),
  DEMO_MODE: bool,
  AUTH_KEYCLOAK_ENABLED: bool,
  AUTH_KEYCLOAK_ID: z.string().optional(),
  AUTH_KEYCLOAK_SECRET: z.string().optional(),
  AUTH_KEYCLOAK_ISSUER: z.string().optional(),
  MAIL_FROM: z.string().default("ФСП Таланты <no-reply@fsp-talents.local>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(1025),
  RESEND_API_KEY: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  STORAGE_DIR: z.string().default("./storage"),
  LLM_BASE_URL: z.string().default("https://routerai.ru/api/v1"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("openai/gpt-6-luna-pro"),
  LLM_MODEL_STRONG: z.string().default("openai/gpt-6-luna-pro"),
  LLM_EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  LLM_TIMEOUT_MS: z.coerce.number().default(20000),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  /** Video interviews (LiveKit Cloud): wss URL of the project and an API key pair. */
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parsed lazily so that `next build` works without runtime secrets. */
export function env(): Env {
  if (!cached) cached = envSchema.parse(process.env);
  return cached;
}

/**
 * Public base URL without a trailing slash. On Vercel a missing or localhost
 * APP_URL would send users to their own machine, so the project domain wins.
 */
export function appUrl(): string {
  const e = env();
  const vercelHost = e.VERCEL_PROJECT_PRODUCTION_URL || e.VERCEL_URL;
  const explicit = e.APP_URL && !(vercelHost && /\/\/(localhost|127\.0\.0\.1)\b/.test(e.APP_URL)) ? e.APP_URL : undefined;
  const url = explicit ?? (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

/** Test helper: drop cached env after mutating process.env. */
export function resetEnvCache() {
  cached = null;
}

import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgres://fsp:fsp@localhost:5432/fsp"),
  APP_URL: z.string().default("http://localhost:3000"),
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
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parsed lazily so that `next build` works without runtime secrets. */
export function env(): Env {
  if (!cached) cached = envSchema.parse(process.env);
  return cached;
}

/** Test helper: drop cached env after mutating process.env. */
export function resetEnvCache() {
  cached = null;
}

import { afterAll } from "vitest";
import { TEST_DATABASE_URL } from "./env";

process.env.DATABASE_URL = TEST_DATABASE_URL;
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.APP_URL = "http://localhost:3000";
process.env.DEMO_MODE = "true";
process.env.LLM_API_KEY = "";

afterAll(async () => {
  const { closeDb } = await import("@/server/db");
  await closeDb();
});

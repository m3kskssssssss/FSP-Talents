import { afterEach, describe, expect, it } from "vitest";
import { appUrl, resetEnvCache } from "@/server/env";
import { localHref } from "@/lib/api-client";

const keys = ["APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));

function setEnv(vars: Partial<Record<(typeof keys)[number], string>>) {
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, vars);
  resetEnvCache();
}

describe("appUrl", () => {
  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetEnvCache();
  });

  it("uses APP_URL when set", () => {
    setEnv({ APP_URL: "https://talents.example.ru/" });
    expect(appUrl()).toBe("https://talents.example.ru");
  });

  it("falls back to the Vercel production domain", () => {
    setEnv({ VERCEL_PROJECT_PRODUCTION_URL: "fsp-talents.vercel.app", VERCEL_URL: "fsp-talents-abc.vercel.app" });
    expect(appUrl()).toBe("https://fsp-talents.vercel.app");
  });

  it("ignores a localhost APP_URL on Vercel", () => {
    setEnv({ APP_URL: "http://localhost:3000", VERCEL_URL: "fsp-talents-abc.vercel.app" });
    expect(appUrl()).toBe("https://fsp-talents-abc.vercel.app");
  });

  it("defaults to localhost locally", () => {
    setEnv({});
    expect(appUrl()).toBe("http://localhost:3000");
  });
});

describe("localHref", () => {
  it("drops the host so the link opens on the current site", () => {
    expect(localHref("http://localhost:3000/verify-email?token=a-b_c")).toBe("/verify-email?token=a-b_c");
  });
});

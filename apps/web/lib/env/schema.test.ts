import { describe, expect, it } from "vitest";

import { validateServerEnv } from "./schema";

const FULL_ENV: Record<string, string> = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  STRIPE_SECRET_KEY: "sk_test_x",
  STRIPE_WEBHOOK_SECRET: "whsec_x",
  STRIPE_PRICE_PRO_MONTHLY: "price_1",
  STRIPE_PRICE_PRO_ANNUAL: "price_2",
  STRIPE_PRICE_STUDIO_MONTHLY: "price_3",
  STRIPE_PRICE_STUDIO_ANNUAL: "price_4",
  STRIPE_PRICE_AGENCY_MONTHLY: "price_5",
  STRIPE_PRICE_AGENCY_ANNUAL: "price_6",
  STRIPE_PRICE_CREDIT_PACK: "price_7",
};

describe("validateServerEnv", () => {
  it("accepts a complete development environment", () => {
    const result = validateServerEnv(FULL_ENV);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.env.MODEL_FREE).toBe("claude-haiku-4-5");
      expect(result.env.CREDIT_PACK_UNITS).toBe(100);
    }
  });

  it("reports every missing variable by name", () => {
    const result = validateServerEnv({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("DATABASE_URL");
      expect(result.missing).toContain("STRIPE_SECRET_KEY");
      expect(result.missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });

  it("requires Upstash in production but not development", () => {
    const dev = validateServerEnv({ ...FULL_ENV, NODE_ENV: "development" });
    expect(dev.ok).toBe(true);

    const prod = validateServerEnv({ ...FULL_ENV, NODE_ENV: "production" });
    expect(prod.ok).toBe(false);
    if (!prod.ok) {
      expect(prod.missing).toEqual([
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ]);
    }

    const prodFull = validateServerEnv({
      ...FULL_ENV,
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    expect(prodFull.ok).toBe(true);
  });

  it("rejects malformed URLs", () => {
    const result = validateServerEnv({ ...FULL_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    expect(result.ok).toBe(false);
  });
});

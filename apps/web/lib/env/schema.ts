import { z } from "zod";

/**
 * Pure schema module (no `server-only`) so it is unit-testable. Runtime access
 * goes through `@/lib/env`, which is server-only.
 *
 * Every price ID, model ID, and quota knob lives here — never in code.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Database (Supabase Postgres; use the transaction-pooler URL in serverless)
  DATABASE_URL: z.string().min(1),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe — platform billing
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_PRO_ANNUAL: z.string().min(1),
  STRIPE_PRICE_STUDIO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_STUDIO_ANNUAL: z.string().min(1),
  STRIPE_PRICE_AGENCY_MONTHLY: z.string().min(1),
  STRIPE_PRICE_AGENCY_ANNUAL: z.string().min(1),
  // Overage credit pack (one-time payment). Units per pack alongside it.
  STRIPE_PRICE_CREDIT_PACK: z.string().min(1),
  CREDIT_PACK_UNITS: z.coerce.number().int().positive().default(100),
  // Custom-domain add-on (per-domain subscription item) — wired in Phase 5.
  STRIPE_PRICE_DOMAIN_ADDON: z.string().min(1).optional(),

  // Upstash (rate limiting / cache). Optional in dev — limiter fails open
  // with a loud warning; required in production.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Anthropic (Phase 3+). Optional until the generation pipeline lands.
  ANTHROPIC_API_KEY: z.string().optional(),
  MODEL_FREE: z.string().default("claude-haiku-4-5"),
  MODEL_STANDARD: z.string().default("claude-sonnet-5"),
  MODEL_COMPLEX: z.string().default("claude-opus-4-8"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Vars a production boot cannot proceed without, even if dev tolerates their absence. */
const PRODUCTION_REQUIRED_OPTIONALS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const satisfies readonly (keyof ServerEnv)[];

export type EnvValidation =
  | { ok: true; env: ServerEnv }
  | { ok: false; missing: string[] };

export function validateServerEnv(
  raw: Record<string, string | undefined>,
): EnvValidation {
  const parsed = serverEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const missing = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
    return { ok: false, missing };
  }
  if (parsed.data.NODE_ENV === "production") {
    const missing = PRODUCTION_REQUIRED_OPTIONALS.filter((k) => !parsed.data[k]);
    if (missing.length > 0) return { ok: false, missing: [...missing] };
  }
  return { ok: true, env: parsed.data };
}

import "server-only";

import { validateServerEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | null = null;

function parseOrThrow(): ServerEnv {
  const result = validateServerEnv(process.env);
  if (!result.ok) {
    throw new Error(
      `Invalid server environment. Missing/invalid: ${result.missing.join(", ")}.\n` +
        `Copy apps/web/.env.example to apps/web/.env.local and fill in the values.`,
    );
  }
  return result.env;
}

/**
 * Lazy so `next build` (which prerenders only env-free routes) succeeds without
 * secrets; any runtime access without them fails immediately and loudly.
 * `assertServerEnv` is called from instrumentation for fail-fast-at-boot.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    cached ??= parseOrThrow();
    return cached[prop as keyof ServerEnv];
  },
});

export function assertServerEnv(opts: { throwOnMissing: boolean }): void {
  const result = validateServerEnv(process.env);
  if (result.ok) {
    cached = result.env;
    return;
  }
  const message = `[env] Missing/invalid server environment: ${result.missing.join(", ")}`;
  if (opts.throwOnMissing) throw new Error(message);
  console.warn(`${message} — features touching those services will fail until configured.`);
}

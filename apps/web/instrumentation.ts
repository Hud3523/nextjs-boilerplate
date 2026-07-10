/**
 * Runs once at server boot (Next.js instrumentation hook).
 * Production refuses to start with a malformed environment; development
 * warns and lets you work on whatever doesn't need the missing service.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertServerEnv } = await import("./lib/env");
    assertServerEnv({ throwOnMissing: process.env.NODE_ENV === "production" });
  }
}

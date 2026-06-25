// Shared contract every server-side connector adapter implements. This is the
// real "wiring" surface: the Tool Manager talks to connectors only through this.

export type LiveHealth = "healthy" | "degraded" | "offline" | "unconfigured";

export interface HealthResult {
  status: LiveHealth;
  detail?: string;
  latencyMs?: number;
}

export interface TestResult {
  ok: boolean;
  /** A small, non-secret sample payload proving the connector works. */
  data?: unknown;
  error?: string;
  latencyMs?: number;
}

export interface ServerConnector {
  id: string;
  /** True when the required credentials/config for this connector are present. */
  configured(): boolean;
  /** Lightweight liveness probe. Must never throw. */
  health(): Promise<HealthResult>;
  /** Run a representative capability and return a sample result. Must never throw. */
  test(params?: Record<string, unknown>): Promise<TestResult>;
}

/** Reject a promise if it doesn't settle within `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

import { errMsg, withTimeout, type HealthResult, type TestResult } from "./types";

// Shared helper for connectors that are EXTERNAL SERVICES reached over HTTP
// (OpenClaw, Hermes). Endpoints are configurable so the adapter adapts to each
// service's real API without code changes.

export interface HttpServiceConfig {
  baseUrl?: string;
  apiKey?: string;
  healthPath: string; // e.g. "/health"
  testPath: string; // e.g. "/v1/models"
  testMethod?: "GET" | "POST";
  testBody?: unknown;
}

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function call(
  cfg: HttpServiceConfig,
  path: string,
  method: "GET" | "POST",
  body?: unknown
) {
  const url = `${cfg.baseUrl!.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders(cfg.apiKey),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof parsed === "string" ? parsed.slice(0, 200) : res.statusText}`);
  return parsed;
}

export async function serviceHealth(cfg: HttpServiceConfig): Promise<HealthResult> {
  if (!cfg.baseUrl) return { status: "unconfigured", detail: "Service URL not set" };
  const start = Date.now();
  try {
    await withTimeout(call(cfg, cfg.healthPath, "GET"), 8000, "service health");
    return { status: "healthy", detail: `${cfg.baseUrl} reachable`, latencyMs: Date.now() - start };
  } catch (e) {
    return { status: "offline", detail: errMsg(e), latencyMs: Date.now() - start };
  }
}

export async function serviceTest(cfg: HttpServiceConfig): Promise<TestResult> {
  if (!cfg.baseUrl) return { ok: false, error: "Service URL not set" };
  const start = Date.now();
  try {
    const data = await withTimeout(
      call(cfg, cfg.testPath, cfg.testMethod ?? "GET", cfg.testBody),
      12000,
      "service test"
    );
    return { ok: true, data, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: errMsg(e), latencyMs: Date.now() - start };
  }
}

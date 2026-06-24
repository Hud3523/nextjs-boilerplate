import { db, getSetting, setSetting } from "./db.js";
import { config } from "./config.js";
import { emit, logActivity } from "./bus.js";

/** Dashboard guardrail flags. */
export const flags = {
  dryRun: () => getSetting<boolean>("dryRun", true),
  armed: () => getSetting<boolean>("armed", false),
  emergencyStop: () => getSetting<boolean>("emergencyStop", false),
  budgetCapUsd: () => getSetting<number>("budgetCapUsd", config.defaults.budgetCapUsd),
};
export function setFlag(key: "dryRun" | "armed" | "emergencyStop", value: boolean) { setSetting(key, value); }
export function frozen(): boolean { return flags.emergencyStop(); }

/** Running spend = sum of recorded task costs (real OpenRouter cost when live). */
export function totalSpend(): number {
  const r = db.prepare("SELECT COALESCE(SUM(cost_usd),0) AS s FROM tasks").get() as { s: number };
  return Math.round(r.s * 1e6) / 1e6;
}

export function budgetOk(): boolean {
  const cap = flags.budgetCapUsd();
  if (cap <= 0) return true;
  if (totalSpend() >= cap) {
    if (!flags.emergencyStop()) {
      setFlag("emergencyStop", true);
      logActivity("system", `Budget cap $${cap.toFixed(2)} reached — execution halted.`);
      emit({ type: "stats", payload: { halted: true } });
    }
    return false;
  }
  return true;
}

/**
 * Optional: read live OpenRouter credit balance with the operator's key.
 * Returns null when no key is set or the call fails (kept non-fatal).
 */
export async function openRouterCredits(): Promise<{ usage: number; limit: number | null } | null> {
  if (!config.openRouterKey) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${config.openRouterKey}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const d = data.data ?? data;
    return { usage: Number(d.total_usage ?? d.usage ?? 0), limit: d.total_credits != null ? Number(d.total_credits) : null };
  } catch {
    return null;
  }
}

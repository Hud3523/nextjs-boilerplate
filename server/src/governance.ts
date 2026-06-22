/**
 * Governance & safety — the money guardrails. Built before any competition
 * logic so the league can never run real spend without these in place.
 *
 *   - Dry-run: zero real spend (default ON until explicitly armed).
 *   - Emergency stop: instantly freezes every floor and agent.
 *   - Pause: operator-initiated soft halt.
 *   - Master fund cap: ceiling across ALL agencies (your AUM).
 *   - Per-agency drawdown breaker: liquidate an agency that loses X% of capital.
 *   - Recursion caps: depth / agents-per-floor / active-floors at spawn time.
 */
import { db, getSetting, setSetting } from "./db.js";

export const gov = {
  dryRun: () => getSetting<boolean>("dryRun", true),
  emergencyStop: () => getSetting<boolean>("emergencyStop", false),
  paused: () => getSetting<boolean>("paused", false),
  budgetCapUsd: () => getSetting<number>("budgetCapUsd", 5),
  masterFundCapUsd: () => getSetting<number>("masterFundCapUsd", 25),
  drawdownPct: () => getSetting<number>("drawdownPct", 50),
  maxDepth: () => getSetting<number>("maxDepth", 3),
  maxAgentsPerFloor: () => getSetting<number>("maxAgentsPerFloor", 6),
  maxActiveFloors: () => getSetting<number>("maxActiveFloors", 8),
  tournamentMode: () => getSetting<string>("tournamentMode", "profit"),
};

/** True when execution is globally frozen (emergency stop OR paused). */
export function frozen(): boolean {
  return gov.emergencyStop() || gov.paused();
}

/** Real money only flows when NOT dry-run and a key is configured (checked elsewhere). */
export function liveSpendAllowed(): boolean {
  return !gov.dryRun();
}

export function setFlag(key: "dryRun" | "emergencyStop" | "paused", value: boolean) {
  setSetting(key, value);
}

/** Count active (non-terminal) floors for the active-floors cap. */
export function activeFloorCount(): number {
  const r = db
    .prepare("SELECT COUNT(*) AS c FROM floors WHERE status NOT IN ('done','killed') AND permanent = 0")
    .get() as { c: number };
  return r.c;
}

export interface SpawnCheck {
  ok: boolean;
  reason?: string;
}

/** Enforce recursion caps before spawning a floor at a given depth. */
export function canSpawnFloor(depth: number, agentCount: number): SpawnCheck {
  if (gov.emergencyStop()) return { ok: false, reason: "EMERGENCY STOP is engaged." };
  if (depth > gov.maxDepth()) return { ok: false, reason: `Max floor depth (${gov.maxDepth()}) reached.` };
  if (agentCount > gov.maxAgentsPerFloor())
    return { ok: false, reason: `Max agents per floor (${gov.maxAgentsPerFloor()}) exceeded.` };
  if (activeFloorCount() >= gov.maxActiveFloors())
    return { ok: false, reason: `Max active floors (${gov.maxActiveFloors()}) reached.` };
  return { ok: true };
}

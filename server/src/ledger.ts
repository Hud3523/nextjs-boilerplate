import { nanoid } from "nanoid";
import { db, getSetting, setSetting } from "./db.js";
import { emit, logActivity } from "./bus.js";
import { raiseAttention } from "./attention.js";
import { gov } from "./governance.js";
import { listAgencies, agencyEquity, getAgency, liquidateAgency, pauseAgency } from "./agencies.js";
import { activeSeasonId } from "./seasons.js";

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function recordLedger(
  type: "revenue" | "spend",
  amountUsd: number,
  opts: { description?: string; taskId?: string; floorId?: string; agencyId?: string; model?: string; simulated?: boolean } = {},
) {
  const row = {
    id: nanoid(),
    ts: Date.now(),
    type,
    amount_usd: amountUsd,
    description: opts.description ?? null,
    task_id: opts.taskId ?? null,
    floor_id: opts.floorId ?? null,
    agency_id: opts.agencyId ?? null,
    season_id: activeSeasonId(),
    simulated: opts.simulated ? 1 : 0,
    model: opts.model ?? null,
  };
  db.prepare(
    `INSERT INTO ledger (id, ts, type, amount_usd, description, task_id, floor_id, agency_id, season_id, simulated, model)
     VALUES (@id, @ts, @type, @amount_usd, @description, @task_id, @floor_id, @agency_id, @season_id, @simulated, @model)`,
  ).run(row);
  emit({ type: "ledger", payload: row });
}

/** REAL (non-simulated) spend today, across the whole fund. */
export function realSpendToday(): number {
  return (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='spend' AND simulated=0 AND ts>=?")
    .get(startOfTodayMs()) as { s: number }).s;
}

/** Total real fund spend (lifetime) — checked against the master fund cap. */
export function fundSpend(): number {
  return (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='spend' AND simulated=0")
    .get() as { s: number }).s;
}

export function totalRevenue(): number {
  return (db.prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='revenue'").get() as { s: number }).s;
}

export function cyclesToday(): number {
  return (db
    .prepare("SELECT COUNT(*) AS c FROM activity WHERE type='run_end' AND ts>=?")
    .get(startOfTodayMs()) as { c: number }).c;
}

/**
 * Master fund cap: total REAL spend across all agencies must not exceed AUM.
 * Returns true if real spend may proceed. Dry-run never touches this.
 */
export function fundCapOk(): boolean {
  const cap = gov.masterFundCapUsd();
  if (cap <= 0) return true;
  const spent = fundSpend();
  if (spent >= cap) {
    if (!getSetting<boolean>("emergencyStop", false)) {
      setSetting("emergencyStop", true);
      logActivity("system", `Master fund cap $${cap.toFixed(2)} reached — EMERGENCY STOP engaged.`);
      raiseAttention({
        kind: "alert",
        severity: "critical",
        title: "Master fund cap reached",
        body: `Real spend ($${spent.toFixed(2)}) hit the fund cap ($${cap.toFixed(2)}). The whole league is frozen. Raise the cap or release the stop in the control room.`,
        dedupe: true,
      });
    }
    return false;
  }
  return true;
}

export function lowCreditWarning(): boolean {
  const cap = gov.masterFundCapUsd();
  return cap > 0 && fundSpend() >= cap * 0.8;
}

/**
 * Per-agency drawdown circuit breaker. An agency that loses more than the
 * configured % of its capital is auto-paused (and liquidated if it goes to ~0).
 */
export function checkDrawdownBreakers() {
  const limit = gov.drawdownPct() / 100;
  for (const a of listAgencies()) {
    if (a.status !== "active") continue;
    const equity = agencyEquity(a.id);
    const loss = a.capital_usd > 0 ? (a.capital_usd - equity) / a.capital_usd : 0;
    if (equity <= 0) {
      liquidateAgency(a.id, `equity wiped out (drawdown ${(loss * 100).toFixed(0)}%)`);
      raiseAttention({ kind: "alert", severity: "critical", title: `${a.name} liquidated`, body: `Drawdown breaker: capital exhausted.`, agencyId: a.id, dedupe: true });
    } else if (loss >= limit) {
      pauseAgency(a.id, `drawdown ${(loss * 100).toFixed(0)}% ≥ limit ${(limit * 100).toFixed(0)}%`);
      raiseAttention({ kind: "alert", severity: "warn", title: `${a.name} hit drawdown limit`, body: `Lost ${(loss * 100).toFixed(0)}% of capital; auto-paused. Promote, top up, or disband.`, agencyId: a.id, dedupe: true });
    }
  }
}

export { startOfTodayMs };

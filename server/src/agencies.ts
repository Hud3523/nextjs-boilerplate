import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit, logActivity } from "./bus.js";

export interface Doctrine {
  riskTolerance: number; // 0..1
  nicheFocus: string;
  speedVsQuality: number; // 0 = quality, 1 = speed
  contentVsCommerce: number; // 0 = content, 1 = commerce
  validationThreshold: number; // 0..1 confidence required to pursue
  spendAggressiveness: number; // 0..1
}

export interface AgencyRow {
  id: string;
  name: string;
  doctrine: string;
  capital_usd: number;
  status: "active" | "paused" | "liquidated";
  is_league: number;
  generation: number;
  season_id: string | null;
  created_at: number;
}

export function createAgency(input: {
  name: string;
  doctrine: Doctrine;
  capitalUsd: number;
  isLeague?: boolean;
  generation?: number;
  seasonId?: string;
  id?: string;
}): AgencyRow {
  const row: AgencyRow = {
    id: input.id ?? `agcy-${nanoid(8)}`,
    name: input.name,
    doctrine: JSON.stringify(input.doctrine),
    capital_usd: input.capitalUsd,
    status: "active",
    is_league: input.isLeague ? 1 : 0,
    generation: input.generation ?? 1,
    season_id: input.seasonId ?? null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO agencies (id, name, doctrine, capital_usd, status, is_league, generation, season_id, created_at)
     VALUES (@id, @name, @doctrine, @capital_usd, @status, @is_league, @generation, @season_id, @created_at)`,
  ).run(row);
  emit({ type: "agency", payload: row } as never);
  return row;
}

export function getAgency(id: string): AgencyRow | undefined {
  return db.prepare("SELECT * FROM agencies WHERE id = ?").get(id) as AgencyRow | undefined;
}

export function listAgencies(opts: { includeLeague?: boolean } = {}): AgencyRow[] {
  if (opts.includeLeague) return db.prepare("SELECT * FROM agencies ORDER BY created_at").all() as AgencyRow[];
  return db.prepare("SELECT * FROM agencies WHERE is_league = 0 ORDER BY created_at").all() as AgencyRow[];
}

export function updateAgency(id: string, patch: Partial<AgencyRow>): AgencyRow | undefined {
  const cur = getAgency(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  db.prepare(
    `UPDATE agencies SET name=@name, doctrine=@doctrine, capital_usd=@capital_usd, status=@status,
       generation=@generation, season_id=@season_id WHERE id=@id`,
  ).run(next);
  emit({ type: "agency", payload: next } as never);
  return next;
}

/** Per-agency spend / revenue / net P&L from the ledger (current season-agnostic). */
export function agencyPnl(agencyId: string): { spend: number; revenue: number; net: number; roi: number | null } {
  const spend = (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='spend' AND agency_id=?")
    .get(agencyId) as { s: number }).s;
  const revenue = (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='revenue' AND agency_id=?")
    .get(agencyId) as { s: number }).s;
  const net = revenue - spend;
  const roi = spend > 0 ? net / spend : null;
  return { spend, revenue, net, roi };
}

/** Live capital = allocated capital + net P&L. Drives the drawdown breaker. */
export function agencyEquity(agencyId: string): number {
  const a = getAgency(agencyId);
  if (!a) return 0;
  return a.capital_usd + agencyPnl(agencyId).net;
}

export function pauseAgency(id: string, reason: string) {
  const a = getAgency(id);
  if (!a || a.status !== "active") return;
  updateAgency(id, { status: "paused" });
  logActivity("system", `Agency ${a.name} auto-paused: ${reason}`);
}

export function liquidateAgency(id: string, reason: string) {
  const a = getAgency(id);
  if (!a) return;
  updateAgency(id, { status: "liquidated" });
  // Halt the agency's floors.
  db.prepare("UPDATE floors SET status='killed' WHERE agency_id=? AND permanent=0 AND status NOT IN ('done','killed')").run(id);
  logActivity("system", `Agency ${a.name} LIQUIDATED: ${reason}`);
}

export function parseDoctrine(a: AgencyRow): Doctrine {
  try {
    return JSON.parse(a.doctrine) as Doctrine;
  } catch {
    return {
      riskTolerance: 0.5, nicheFocus: "general", speedVsQuality: 0.5,
      contentVsCommerce: 0.5, validationThreshold: 0.5, spendAggressiveness: 0.5,
    };
  }
}

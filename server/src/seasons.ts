import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export interface SeasonRow {
  id: string;
  name: string;
  mode: "profit" | "efficiency" | "survival" | "niche";
  status: "running" | "settled";
  number: number;
  started_at: number;
  ends_at: number | null;
  created_at: number;
}

export function currentSeason(): SeasonRow | undefined {
  return db.prepare("SELECT * FROM seasons WHERE status='running' ORDER BY number DESC LIMIT 1").get() as
    | SeasonRow
    | undefined;
}

export function activeSeasonId(): string | null {
  return currentSeason()?.id ?? null;
}

export function createSeason(input: {
  mode?: SeasonRow["mode"];
  durationMinutes?: number;
  number?: number;
}): SeasonRow {
  const number = input.number ?? ((db.prepare("SELECT COALESCE(MAX(number),0) AS n FROM seasons").get() as { n: number }).n + 1);
  const now = Date.now();
  const row: SeasonRow = {
    id: `season-${nanoid(6)}`,
    name: `Season ${number}`,
    mode: input.mode ?? "profit",
    status: "running",
    number,
    started_at: now,
    ends_at: input.durationMinutes ? now + input.durationMinutes * 60_000 : null,
    created_at: now,
  };
  db.prepare(
    `INSERT INTO seasons (id, name, mode, status, number, started_at, ends_at, created_at)
     VALUES (@id, @name, @mode, @status, @number, @started_at, @ends_at, @created_at)`,
  ).run(row);
  emit({ type: "season", payload: row } as never);
  return row;
}

export function settleSeasonRow(id: string) {
  db.prepare("UPDATE seasons SET status='settled' WHERE id=?").run(id);
}

export function listSeasons(): SeasonRow[] {
  return db.prepare("SELECT * FROM seasons ORDER BY number DESC").all() as SeasonRow[];
}

/** Per-agency net P&L within a season, from the ledger. */
export function seasonPnl(agencyId: string, seasonId: string) {
  const spend = (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='spend' AND agency_id=? AND season_id=?")
    .get(agencyId, seasonId) as { s: number }).s;
  const revenue = (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='revenue' AND agency_id=? AND season_id=?")
    .get(agencyId, seasonId) as { s: number }).s;
  return { spend, revenue, net: revenue - spend, roi: spend > 0 ? (revenue - spend) / spend : null };
}

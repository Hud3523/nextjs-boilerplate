import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export interface FloorRow {
  id: string;
  agency_id: string;
  parent_floor_id: string | null;
  name: string;
  mission: string;
  definition_of_done: string | null;
  budget_usd: number;
  status: "spawning" | "executing" | "reporting" | "done" | "killed" | "paused";
  depth: number;
  permanent: number;
  directive_id: string | null;
  opportunity_id: string | null;
  created_at: number;
}

export function createFloor(input: {
  id?: string;
  agencyId: string;
  parentFloorId?: string | null;
  name: string;
  mission: string;
  definitionOfDone?: string;
  budgetUsd: number;
  depth: number;
  permanent?: boolean;
  directiveId?: string;
  opportunityId?: string;
  status?: FloorRow["status"];
}): FloorRow {
  const row: FloorRow = {
    id: input.id ?? `floor-${nanoid(8)}`,
    agency_id: input.agencyId,
    parent_floor_id: input.parentFloorId ?? null,
    name: input.name,
    mission: input.mission,
    definition_of_done: input.definitionOfDone ?? null,
    budget_usd: input.budgetUsd,
    status: input.status ?? "executing",
    depth: input.depth,
    permanent: input.permanent ? 1 : 0,
    directive_id: input.directiveId ?? null,
    opportunity_id: input.opportunityId ?? null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO floors (id, agency_id, parent_floor_id, name, mission, definition_of_done, budget_usd, status, depth, permanent, directive_id, opportunity_id, created_at)
     VALUES (@id, @agency_id, @parent_floor_id, @name, @mission, @definition_of_done, @budget_usd, @status, @depth, @permanent, @directive_id, @opportunity_id, @created_at)`,
  ).run(row);
  emit({ type: "floor", payload: row } as never);
  return row;
}

export function getFloor(id: string): FloorRow | undefined {
  return db.prepare("SELECT * FROM floors WHERE id = ?").get(id) as FloorRow | undefined;
}

export function listFloors(opts: { agencyId?: string } = {}): FloorRow[] {
  if (opts.agencyId)
    return db.prepare("SELECT * FROM floors WHERE agency_id = ? ORDER BY depth, created_at").all(opts.agencyId) as FloorRow[];
  return db.prepare("SELECT * FROM floors ORDER BY depth, created_at").all() as FloorRow[];
}

export function updateFloor(id: string, patch: Partial<FloorRow>): FloorRow | undefined {
  const cur = getFloor(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  db.prepare(
    `UPDATE floors SET name=@name, mission=@mission, definition_of_done=@definition_of_done,
       budget_usd=@budget_usd, status=@status WHERE id=@id`,
  ).run(next);
  emit({ type: "floor", payload: next } as never);
  return next;
}

/** Floor-scoped spend from the ledger. */
export function floorSpend(floorId: string): number {
  return (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='spend' AND floor_id=?")
    .get(floorId) as { s: number }).s;
}

export function floorRevenue(floorId: string): number {
  return (db
    .prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='revenue' AND floor_id=?")
    .get(floorId) as { s: number }).s;
}

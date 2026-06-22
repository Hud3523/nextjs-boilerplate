import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export type AgentTrigger = "cycle" | "event" | "solo";
export type AgentStatus = "idle" | "working" | "needs-setup" | "blocked";

export interface AgentRow {
  id: string;
  callsign: string;
  role: string;
  floor_id: string;
  agency_id: string;
  reputation_key: string | null;
  bay: string;
  trigger: AgentTrigger;
  interval_minutes: number | null;
  model: string | null;
  system_prompt: string;
  allowed_tools: string; // JSON
  guardrails: string; // JSON
  sandboxed: number;
  permanent: number;
  enabled: number;
  status: AgentStatus;
  last_action: string | null;
  last_run_at: number | null;
  next_run_at: number | null;
  created_at: number;
}

/** Global guardrails every agent — seeded or spawned — inherits. */
export const GLOBAL_GUARDRAILS = [
  "No external publishing without explicit operator approval.",
  "Budget-bound: stop if the floor/agency/fund cap is hit.",
  "Tools limited to the vetted Tool Registry.",
  "Never fabricate completed external actions.",
];

export function createAgent(input: {
  id?: string;
  callsign: string;
  role: string;
  floorId: string;
  agencyId: string;
  bay: string;
  trigger: AgentTrigger;
  intervalMinutes?: number;
  model?: string;
  systemPrompt: string;
  allowedTools: string[];
  sandboxed?: boolean;
  permanent?: boolean;
  reputationKey?: string;
}): AgentRow {
  const row: AgentRow = {
    id: input.id ?? `agent-${nanoid(8)}`,
    callsign: input.callsign,
    role: input.role,
    floor_id: input.floorId,
    agency_id: input.agencyId,
    reputation_key: input.reputationKey ?? input.callsign.toLowerCase(),
    bay: input.bay,
    trigger: input.trigger,
    interval_minutes: input.intervalMinutes ?? null,
    model: input.model ?? null,
    system_prompt: input.systemPrompt,
    allowed_tools: JSON.stringify(input.allowedTools),
    guardrails: JSON.stringify(GLOBAL_GUARDRAILS),
    sandboxed: input.sandboxed ? 1 : 0,
    permanent: input.permanent ? 1 : 0,
    enabled: 1,
    status: "idle",
    last_action: null,
    last_run_at: null,
    next_run_at: null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO agents (id, callsign, role, floor_id, agency_id, reputation_key, bay, trigger, interval_minutes,
       model, system_prompt, allowed_tools, guardrails, sandboxed, permanent, enabled, status, last_action,
       last_run_at, next_run_at, created_at)
     VALUES (@id, @callsign, @role, @floor_id, @agency_id, @reputation_key, @bay, @trigger, @interval_minutes,
       @model, @system_prompt, @allowed_tools, @guardrails, @sandboxed, @permanent, @enabled, @status, @last_action,
       @last_run_at, @next_run_at, @created_at)`,
  ).run(row);
  emit({ type: "agent", payload: row } as never);
  return row;
}

export function getAgent(id: string): AgentRow | undefined {
  return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow | undefined;
}

export function getAgentByRole(agencyId: string, ...callsigns: string[]): AgentRow | undefined {
  for (const c of callsigns) {
    const row = db
      .prepare("SELECT * FROM agents WHERE agency_id = ? AND lower(callsign) = lower(?) LIMIT 1")
      .get(agencyId, c) as AgentRow | undefined;
    if (row) return row;
  }
  return undefined;
}

export function listAgents(opts: { floorId?: string; agencyId?: string } = {}): AgentRow[] {
  if (opts.floorId) return db.prepare("SELECT * FROM agents WHERE floor_id = ? ORDER BY created_at").all(opts.floorId) as AgentRow[];
  if (opts.agencyId) return db.prepare("SELECT * FROM agents WHERE agency_id = ? ORDER BY created_at").all(opts.agencyId) as AgentRow[];
  return db.prepare("SELECT * FROM agents ORDER BY created_at").all() as AgentRow[];
}

export function countAgentsOnFloor(floorId: string): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM agents WHERE floor_id = ?").get(floorId) as { c: number }).c;
}

export function tools(a: AgentRow): string[] {
  try {
    return JSON.parse(a.allowed_tools) as string[];
  } catch {
    return [];
  }
}

export function setAgentStatus(agentId: string, status: AgentStatus, lastAction?: string) {
  db.prepare(
    `UPDATE agents SET status = ?, last_action = COALESCE(?, last_action), last_run_at = ? WHERE id = ?`,
  ).run(status, lastAction ?? null, Date.now(), agentId);
  emit({ type: "agent", payload: { id: agentId, status, last_action: lastAction } } as never);
}

export function setAgentNextRun(agentId: string, nextRunAt: number | null) {
  db.prepare("UPDATE agents SET next_run_at = ? WHERE id = ?").run(nextRunAt, agentId);
  emit({ type: "agent", payload: { id: agentId, next_run_at: nextRunAt } } as never);
}

export function setAgentEnabled(agentId: string, enabled: boolean) {
  db.prepare("UPDATE agents SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, agentId);
  emit({ type: "agent", payload: { id: agentId, enabled } } as never);
}

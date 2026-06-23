import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export interface AttentionRow {
  id: string;
  ts: number;
  kind: "approval" | "blocker" | "escalation" | "alert" | "agent_review" | "opportunity" | "directive";
  severity: "info" | "warn" | "critical";
  title: string;
  body: string | null;
  payload: string | null;
  task_id: string | null;
  agent_id: string | null;
  floor_id: string | null;
  agency_id: string | null;
  status: "open" | "resolved";
}

export function raiseAttention(input: {
  kind: AttentionRow["kind"];
  title: string;
  body?: string;
  severity?: AttentionRow["severity"];
  payload?: unknown;
  taskId?: string;
  agentId?: string;
  floorId?: string;
  agencyId?: string;
  dedupe?: boolean;
}): AttentionRow {
  if (input.dedupe) {
    const existing = db
      .prepare("SELECT * FROM attention WHERE status='open' AND title=? AND IFNULL(agent_id,'')=IFNULL(?,'')")
      .get(input.title, input.agentId ?? null) as AttentionRow | undefined;
    if (existing) return existing;
  }
  const row: AttentionRow = {
    id: nanoid(),
    ts: Date.now(),
    kind: input.kind,
    severity: input.severity ?? "info",
    title: input.title,
    body: input.body ?? null,
    payload: input.payload != null ? JSON.stringify(input.payload) : null,
    task_id: input.taskId ?? null,
    agent_id: input.agentId ?? null,
    floor_id: input.floorId ?? null,
    agency_id: input.agencyId ?? null,
    status: "open",
  };
  db.prepare(
    `INSERT INTO attention (id, ts, kind, severity, title, body, payload, task_id, agent_id, floor_id, agency_id, status)
     VALUES (@id, @ts, @kind, @severity, @title, @body, @payload, @task_id, @agent_id, @floor_id, @agency_id, @status)`,
  ).run(row);
  emit({ type: "attention", payload: row });
  // Surface notable items as ephemeral toasts (not the noisy per-cycle approvals).
  if (row.severity !== "info" || row.kind === "escalation" || row.kind === "blocker") {
    emit({ type: "toast", payload: { severity: row.severity, title: row.title, kind: row.kind } });
  }
  return row;
}

export function getAttention(id: string): AttentionRow | undefined {
  return db.prepare("SELECT * FROM attention WHERE id = ?").get(id) as AttentionRow | undefined;
}

export function resolveAttention(id: string) {
  db.prepare("UPDATE attention SET status='resolved' WHERE id = ?").run(id);
  emit({ type: "attention", payload: { id, status: "resolved" } });
}

export function resolveAttentionForTask(taskId: string) {
  const rows = db.prepare("SELECT id FROM attention WHERE task_id=? AND status='open'").all(taskId) as { id: string }[];
  for (const r of rows) resolveAttention(r.id);
}

export function listAttention(): AttentionRow[] {
  return db.prepare("SELECT * FROM attention WHERE status='open' ORDER BY ts DESC").all() as AttentionRow[];
}

import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";
import { getAgent } from "./agents.js";

export type TaskStatus =
  | "queued"
  | "running"
  | "reviewing"
  | "needs_review"
  | "approved"
  | "rejected"
  | "done";

export interface TaskRow {
  id: string;
  agent_id: string;
  floor_id: string | null;
  title: string;
  input: string;
  output: string | null;
  status: TaskStatus;
  review_status: string | null;
  review_notes: string | null;
  attempts: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string | null;
  sandboxed: number;
  structured: number;
  valid: number | null;
  raw_prompt: string | null;
  raw_response: string | null;
  edited: number;
  created_at: number;
  updated_at: number;
}

export function createTask(input: {
  agentId: string;
  title: string;
  input: string;
  status?: TaskStatus;
}): TaskRow {
  const agent = getAgent(input.agentId);
  const now = Date.now();
  const row: TaskRow = {
    id: nanoid(),
    agent_id: input.agentId,
    floor_id: agent?.floor_id ?? null,
    title: input.title,
    input: input.input,
    output: null,
    status: input.status ?? "queued",
    review_status: null,
    review_notes: null,
    attempts: 0,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
    model: null,
    sandboxed: agent?.sandboxed ? 1 : 0,
    structured: 0,
    valid: null,
    raw_prompt: null,
    raw_response: null,
    edited: 0,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO tasks (id, agent_id, floor_id, title, input, output, status, review_status, review_notes, attempts,
       input_tokens, output_tokens, cost_usd, model, sandboxed, structured, valid, raw_prompt, raw_response, edited, created_at, updated_at)
     VALUES (@id, @agent_id, @floor_id, @title, @input, @output, @status, @review_status, @review_notes, @attempts,
       @input_tokens, @output_tokens, @cost_usd, @model, @sandboxed, @structured, @valid, @raw_prompt, @raw_response, @edited, @created_at, @updated_at)`,
  ).run(row);
  emit({ type: "task", payload: row });
  return row;
}

export function getTask(id: string): TaskRow | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
}

export function updateTask(id: string, patch: Partial<TaskRow>): TaskRow | undefined {
  const current = getTask(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updated_at: Date.now() };
  db.prepare(
    `UPDATE tasks SET title=@title, input=@input, output=@output, status=@status, review_status=@review_status,
       review_notes=@review_notes, attempts=@attempts, input_tokens=@input_tokens, output_tokens=@output_tokens,
       cost_usd=@cost_usd, model=@model, sandboxed=@sandboxed, structured=@structured, valid=@valid,
       raw_prompt=@raw_prompt, raw_response=@raw_response, edited=@edited, updated_at=@updated_at WHERE id=@id`,
  ).run(next);
  emit({ type: "task", payload: next });
  return next;
}

export function listTasks(opts: { agentId?: string; floorId?: string; limit?: number } = {}): TaskRow[] {
  const limit = opts.limit ?? 100;
  if (opts.agentId)
    return db.prepare("SELECT * FROM tasks WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?").all(opts.agentId, limit) as TaskRow[];
  if (opts.floorId)
    return db.prepare("SELECT * FROM tasks WHERE floor_id = ? ORDER BY created_at DESC LIMIT ?").all(opts.floorId, limit) as TaskRow[];
  return db.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?").all(limit) as TaskRow[];
}

export function nextQueuedTask(agentId: string): TaskRow | undefined {
  return db
    .prepare("SELECT * FROM tasks WHERE agent_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1")
    .get(agentId) as TaskRow | undefined;
}

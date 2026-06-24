import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export type TaskStatus = "queued" | "running" | "needs_review" | "approved" | "rejected" | "error";

export interface TaskRow {
  id: string; agent_id: string; agent_name: string | null; instruction: string; output: string | null;
  status: TaskStatus; model: string | null; cost_usd: number; tokens_in: number; tokens_out: number;
  edited: number; created_at: number; updated_at: number;
}

export function createTask(input: { agentId: string; agentName?: string; instruction: string }): TaskRow {
  const now = Date.now();
  const row: TaskRow = {
    id: nanoid(), agent_id: input.agentId, agent_name: input.agentName ?? null, instruction: input.instruction,
    output: null, status: "queued", model: null, cost_usd: 0, tokens_in: 0, tokens_out: 0, edited: 0, created_at: now, updated_at: now,
  };
  db.prepare(`INSERT INTO tasks (id, agent_id, agent_name, instruction, output, status, model, cost_usd, tokens_in, tokens_out, edited, created_at, updated_at)
    VALUES (@id,@agent_id,@agent_name,@instruction,@output,@status,@model,@cost_usd,@tokens_in,@tokens_out,@edited,@created_at,@updated_at)`).run(row);
  emit({ type: "task", payload: row });
  return row;
}

export function getTask(id: string): TaskRow | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
}

export function updateTask(id: string, patch: Partial<TaskRow>): TaskRow | undefined {
  const cur = getTask(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch, updated_at: Date.now() };
  db.prepare(`UPDATE tasks SET agent_name=@agent_name, instruction=@instruction, output=@output, status=@status,
    model=@model, cost_usd=@cost_usd, tokens_in=@tokens_in, tokens_out=@tokens_out, edited=@edited, updated_at=@updated_at WHERE id=@id`).run(next);
  emit({ type: "task", payload: next });
  return next;
}

export function listTasks(limit = 100): TaskRow[] {
  return db.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?").all(limit) as TaskRow[];
}

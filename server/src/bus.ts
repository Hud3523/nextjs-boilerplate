import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import { db } from "./db.js";

/** Central event bus → SSE. Every dashboard state change is broadcast here. */
export const bus = new EventEmitter();
bus.setMaxListeners(100);

export interface ServerEvent {
  type: "activity" | "task" | "agents" | "stats" | "token";
  payload: unknown;
}

export function emit(event: ServerEvent) {
  bus.emit("event", event);
}

export interface ActivityRow {
  id: string; ts: number; agent_id: string | null; task_id: string | null; type: string; message: string;
}

export function logActivity(type: string, message: string, opts: { agentId?: string | null; taskId?: string | null } = {}): ActivityRow {
  const row: ActivityRow = { id: nanoid(), ts: Date.now(), agent_id: opts.agentId ?? null, task_id: opts.taskId ?? null, type, message };
  db.prepare(`INSERT INTO activity (id, ts, agent_id, task_id, type, message) VALUES (@id,@ts,@agent_id,@task_id,@type,@message)`).run(row);
  emit({ type: "activity", payload: row });
  return row;
}

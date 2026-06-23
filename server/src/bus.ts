import { EventEmitter } from "node:events";
import { nanoid } from "nanoid";
import { db } from "./db.js";

/**
 * Central event bus. Every state change in the system is emitted here; the SSE
 * route subscribes and forwards events to the dashboard so it live-updates.
 */
export const bus = new EventEmitter();
bus.setMaxListeners(100);

/**
 * Every server→client event. `type` is the channel the dashboard switches on;
 * `payload` is the changed row or delta. New event kinds (agency, floor,
 * season, opportunity, …) are allowed without widening a union everywhere.
 */
export interface ServerEvent {
  type:
    | "activity" | "task" | "agent" | "attention" | "ledger" | "token" | "stats"
    | "agency" | "floor" | "memory" | "board" | "audit" | "reputation"
    | "season" | "directive" | "opportunity" | "progression" | "toast";
  payload: unknown;
}

export interface ActivityRow {
  id: string;
  ts: number;
  agent_id: string | null;
  task_id: string | null;
  floor_id: string | null;
  type: string;
  message: string;
}

export function emit(event: ServerEvent) {
  bus.emit("event", event);
}

/** Write an activity-feed entry to the DB and broadcast it. */
export function logActivity(
  type: string,
  message: string,
  opts: { agentId?: string | null; taskId?: string | null; floorId?: string | null } = {},
): ActivityRow {
  const row: ActivityRow = {
    id: nanoid(),
    ts: Date.now(),
    agent_id: opts.agentId ?? null,
    task_id: opts.taskId ?? null,
    floor_id: opts.floorId ?? null,
    type,
    message,
  };
  db.prepare(
    `INSERT INTO activity (id, ts, agent_id, task_id, floor_id, type, message) VALUES (@id, @ts, @agent_id, @task_id, @floor_id, @type, @message)`,
  ).run(row);
  emit({ type: "activity", payload: row });
  return row;
}

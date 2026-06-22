import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export interface BoardRow {
  id: string;
  floor_id: string;
  agent_id: string | null;
  type: "message" | "task" | "status" | "handoff";
  content: string;
  created_at: number;
}

/** Each floor's shared board + message bus — agents collaborate without relaying through the operator. */
export function postToBoard(input: {
  floorId: string;
  agentId?: string | null;
  type?: BoardRow["type"];
  content: string;
}): BoardRow {
  const row: BoardRow = {
    id: nanoid(),
    floor_id: input.floorId,
    agent_id: input.agentId ?? null,
    type: input.type ?? "message",
    content: input.content,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO board (id, floor_id, agent_id, type, content, created_at)
     VALUES (@id, @floor_id, @agent_id, @type, @content, @created_at)`,
  ).run(row);
  emit({ type: "board", payload: row } as never);
  return row;
}

export function listBoard(floorId: string, limit = 50): BoardRow[] {
  return db.prepare("SELECT * FROM board WHERE floor_id=? ORDER BY created_at DESC LIMIT ?").all(floorId, limit) as BoardRow[];
}

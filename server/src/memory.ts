import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

export type MemoryKind = "opportunity" | "research" | "decision" | "lesson";

export interface MemoryRow {
  id: string;
  kind: MemoryKind;
  title: string;
  content: string;
  floor_id: string | null;
  agent_id: string | null;
  created_at: number;
}

/** Shared knowledge base: opportunities, research, decisions, lessons learned. */
export function remember(input: {
  kind: MemoryKind;
  title: string;
  content: string;
  floorId?: string;
  agentId?: string;
}): MemoryRow {
  const row: MemoryRow = {
    id: nanoid(),
    kind: input.kind,
    title: input.title,
    content: input.content,
    floor_id: input.floorId ?? null,
    agent_id: input.agentId ?? null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO memory (id, kind, title, content, floor_id, agent_id, created_at)
     VALUES (@id, @kind, @title, @content, @floor_id, @agent_id, @created_at)`,
  ).run(row);
  emit({ type: "memory", payload: row } as never);
  return row;
}

export function listMemory(opts: { kind?: MemoryKind; limit?: number } = {}): MemoryRow[] {
  if (opts.kind)
    return db.prepare("SELECT * FROM memory WHERE kind=? ORDER BY created_at DESC LIMIT ?").all(opts.kind, opts.limit ?? 50) as MemoryRow[];
  return db.prepare("SELECT * FROM memory ORDER BY created_at DESC LIMIT ?").all(opts.limit ?? 80) as MemoryRow[];
}

/** Compact recent lessons to inject into agent prompts so we don't repeat mistakes. */
export function recentLessons(limit = 5): string {
  const rows = db.prepare("SELECT title, content FROM memory WHERE kind='lesson' ORDER BY created_at DESC LIMIT ?").all(limit) as {
    title: string;
    content: string;
  }[];
  if (!rows.length) return "";
  return rows.map((r) => `- ${r.title}: ${r.content}`).join("\n");
}

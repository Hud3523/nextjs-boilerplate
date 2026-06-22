import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit } from "./bus.js";

/** Audit log: every spawn, decision, and approval — replayable for trust/debug. */
export function audit(actor: string, action: string, detail?: unknown) {
  const row = {
    id: nanoid(),
    ts: Date.now(),
    actor,
    action,
    detail: detail != null ? JSON.stringify(detail) : null,
  };
  db.prepare("INSERT INTO audit (id, ts, actor, action, detail) VALUES (@id, @ts, @actor, @action, @detail)").run(row);
  emit({ type: "audit", payload: row } as never);
}

export function listAudit(limit = 200) {
  return db.prepare("SELECT * FROM audit ORDER BY ts ASC LIMIT ?").all(limit);
}

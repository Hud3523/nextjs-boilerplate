import { db } from "./db.js";
import { emit } from "./bus.js";

/**
 * Agent reputation accrues across seasons. High-rep agents earn more autonomy
 * (fewer forced QA passes); low-rep agents get more oversight. Keyed by role so
 * the track record survives respawns.
 */
export interface ReputationRow {
  agent_key: string;
  score: number;
  wins: number;
  tasks: number;
  updated_at: number;
}

export function bumpReputation(key: string, delta: number, opts: { win?: boolean } = {}) {
  const cur = (db.prepare("SELECT * FROM reputation WHERE agent_key=?").get(key) as ReputationRow | undefined) ?? {
    agent_key: key,
    score: 0,
    wins: 0,
    tasks: 0,
    updated_at: Date.now(),
  };
  const next: ReputationRow = {
    agent_key: key,
    score: Math.max(0, Math.round((cur.score + delta) * 100) / 100),
    wins: cur.wins + (opts.win ? 1 : 0),
    tasks: cur.tasks + 1,
    updated_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO reputation (agent_key, score, wins, tasks, updated_at) VALUES (@agent_key, @score, @wins, @tasks, @updated_at)
     ON CONFLICT(agent_key) DO UPDATE SET score=@score, wins=@wins, tasks=@tasks, updated_at=@updated_at`,
  ).run(next);
  emit({ type: "reputation", payload: next } as never);
}

export function getReputation(key: string): number {
  const r = db.prepare("SELECT score FROM reputation WHERE agent_key=?").get(key) as { score: number } | undefined;
  return r?.score ?? 0;
}

export function listReputation(): ReputationRow[] {
  return db.prepare("SELECT * FROM reputation ORDER BY score DESC").all() as ReputationRow[];
}

/** Trusted agents (rep ≥ threshold) can skip a mandatory QA pass. */
export function isTrusted(key: string): boolean {
  return getReputation(key) >= 5;
}

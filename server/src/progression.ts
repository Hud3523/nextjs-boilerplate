import { db } from "./db.js";
import { emit, logActivity } from "./bus.js";

/**
 * Gamification — XP, levels, and badges. Agents earn XP for completing graded
 * work and for outputs you approve. Keyed by role so the track record persists
 * across respawns. Levels follow xp = 40·(level−1)².
 */
export interface Progression {
  agent_key: string;
  xp: number;
  level: number;
  badges: string[];
  updated_at: number;
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 40)) + 1;
}
export function xpForLevel(level: number): number {
  return 40 * (level - 1) ** 2;
}

const BADGES: { key: string; label: string; at: (p: { xp: number; reason: string }) => boolean }[] = [
  { key: "rookie", label: "🥉 Rookie", at: (p) => p.xp >= 1 },
  { key: "centurion", label: "💯 Centurion", at: (p) => p.xp >= 100 },
  { key: "veteran", label: "🎖️ Veteran", at: (p) => p.xp >= 300 },
  { key: "ace", label: "🏅 Ace", at: (p) => p.xp >= 700 },
  { key: "scholar", label: "🎓 Scholar", at: (p) => p.reason === "training_A" },
  { key: "rainmaker", label: "🌧️ Rainmaker", at: (p) => p.reason === "approved" },
];

function read(key: string): Progression {
  const row = db.prepare("SELECT * FROM progression WHERE agent_key=?").get(key) as
    | { agent_key: string; xp: number; level: number; badges: string; updated_at: number }
    | undefined;
  if (!row) return { agent_key: key, xp: 0, level: 1, badges: [], updated_at: Date.now() };
  return { ...row, badges: safe(row.badges) };
}

/** Award XP; returns whether the agent levelled up. Emits live updates + toasts. */
export function awardXp(agentKey: string, amount: number, reason: string): { leveledUp: boolean; level: number } {
  if (!agentKey) return { leveledUp: false, level: 1 };
  const cur = read(agentKey);
  const xp = Math.round((cur.xp + amount) * 10) / 10;
  const level = levelForXp(xp);
  const leveledUp = level > cur.level;
  const badges = new Set(cur.badges);
  for (const b of BADGES) if (b.at({ xp, reason }) && !badges.has(b.key)) badges.add(b.key);

  db.prepare(
    `INSERT INTO progression (agent_key, xp, level, badges, updated_at) VALUES (@agent_key,@xp,@level,@badges,@updated_at)
     ON CONFLICT(agent_key) DO UPDATE SET xp=@xp, level=@level, badges=@badges, updated_at=@updated_at`,
  ).run({ agent_key: agentKey, xp, level, badges: JSON.stringify([...badges]), updated_at: Date.now() });

  emit({ type: "progression", payload: { agentKey, xp, level, badges: [...badges] } } as never);
  if (leveledUp) {
    logActivity("system", `⭐ ${agentKey} reached level ${level}!`);
    emit({ type: "toast", payload: { severity: "info", title: `⭐ Level up — ${agentKey} is now L${level}`, kind: "levelup" } } as never);
  }
  return { leveledUp, level };
}

export function getProgression(agentKey: string) {
  const p = read(agentKey);
  return {
    xp: p.xp, level: p.level, badges: p.badges,
    badgeLabels: p.badges.map((k) => BADGES.find((b) => b.key === k)?.label ?? k),
    intoLevel: p.xp - xpForLevel(p.level),
    nextLevelXp: xpForLevel(p.level + 1) - xpForLevel(p.level),
  };
}

export function listProgression() {
  return (db.prepare("SELECT * FROM progression ORDER BY xp DESC").all() as { agent_key: string; xp: number; level: number; badges: string }[])
    .map((r) => ({ agentKey: r.agent_key, xp: r.xp, level: r.level, badges: safe(r.badges) }));
}

function safe(s: string): string[] { try { return JSON.parse(s); } catch { return []; } }

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/**
 * SCHEMA — Expansion II: a self-expanding hierarchical org.
 *
 * The enabling primitive: agents and floors are DATA, not code. Creating one
 * writes a row; the scheduler/engine read rows every tick, so a new agent or
 * floor is live immediately — no redeploy. `agents.config` seeds Floor 1 only.
 */
db.exec(`
  -- Expansion III: the league. Fund (singleton settings) → Agency → Floor → Agent.
  CREATE TABLE IF NOT EXISTS agencies (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    doctrine    TEXT NOT NULL DEFAULT '{}',   -- JSON strategy DNA
    capital_usd REAL NOT NULL DEFAULT 0,       -- allocated capital (budget slice)
    status      TEXT NOT NULL DEFAULT 'active',-- active|paused|liquidated
    is_league   INTEGER NOT NULL DEFAULT 0,    -- the fund's own HQ staff
    generation  INTEGER NOT NULL DEFAULT 1,    -- for the evolution engine
    season_id   TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    mode       TEXT NOT NULL DEFAULT 'profit',  -- profit|efficiency|survival|niche
    status     TEXT NOT NULL DEFAULT 'running', -- running|settled
    number     INTEGER NOT NULL DEFAULT 1,
    started_at INTEGER NOT NULL,
    ends_at    INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reputation (
    agent_key  TEXT PRIMARY KEY,   -- callsign/role key, persists across seasons
    score      REAL NOT NULL DEFAULT 0,
    wins       INTEGER NOT NULL DEFAULT 0,
    tasks      INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS floors (
    id                 TEXT PRIMARY KEY,
    agency_id          TEXT NOT NULL,
    parent_floor_id    TEXT,
    name               TEXT NOT NULL,
    mission            TEXT NOT NULL,
    definition_of_done TEXT,
    budget_usd         REAL NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT 'executing', -- spawning|executing|reporting|done|killed|paused
    depth              INTEGER NOT NULL DEFAULT 0,
    permanent          INTEGER NOT NULL DEFAULT 0,
    directive_id       TEXT,
    opportunity_id     TEXT,
    created_at         INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agents (
    id             TEXT PRIMARY KEY,
    callsign       TEXT NOT NULL,
    role           TEXT NOT NULL,
    floor_id       TEXT NOT NULL,
    agency_id      TEXT NOT NULL DEFAULT 'league',
    reputation_key TEXT,
    bay            TEXT NOT NULL,
    trigger        TEXT NOT NULL DEFAULT 'event', -- cycle|event|solo
    interval_minutes INTEGER,
    model          TEXT,
    system_prompt  TEXT NOT NULL,
    allowed_tools  TEXT NOT NULL DEFAULT '[]',     -- JSON array of tool-registry keys
    guardrails     TEXT NOT NULL DEFAULT '[]',     -- JSON array of inherited guardrails
    sandboxed      INTEGER NOT NULL DEFAULT 0,
    permanent      INTEGER NOT NULL DEFAULT 0,     -- Floor 1 crew can't be disbanded
    enabled        INTEGER NOT NULL DEFAULT 1,
    status         TEXT NOT NULL DEFAULT 'idle',   -- idle|working|needs-setup|blocked
    last_action    TEXT,
    last_run_at    INTEGER,
    next_run_at    INTEGER,
    created_at     INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL,
    floor_id      TEXT,
    title         TEXT NOT NULL,
    input         TEXT NOT NULL,
    output        TEXT,
    status        TEXT NOT NULL DEFAULT 'queued',  -- queued|running|reviewing|needs_review|approved|rejected|done
    review_status TEXT,                            -- pending|passed|failed
    review_notes  TEXT,
    attempts      INTEGER NOT NULL DEFAULT 0,
    input_tokens  INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd      REAL NOT NULL DEFAULT 0,
    model         TEXT,
    sandboxed     INTEGER NOT NULL DEFAULT 0,
    structured    INTEGER NOT NULL DEFAULT 0,    -- output is validated JSON
    valid         INTEGER,                       -- schema validation result
    raw_prompt    TEXT,                          -- exact prompt sent (debug)
    raw_response  TEXT,                          -- exact model response (debug)
    edited        INTEGER NOT NULL DEFAULT 0,    -- operator edited the draft
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  -- Training Academy: golden test cases + grades over time (report card).
  CREATE TABLE IF NOT EXISTS test_cases (
    id         TEXT PRIMARY KEY,
    agent_key  TEXT NOT NULL,
    name       TEXT NOT NULL,
    input      TEXT NOT NULL,
    rubric     TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS grades (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT,
    agent_key  TEXT NOT NULL,
    score      REAL NOT NULL,        -- 0..100
    letter     TEXT NOT NULL,
    kind       TEXT NOT NULL,        -- train|task
    detail     TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS directives (
    id          TEXT PRIMARY KEY,
    text        TEXT NOT NULL,
    plan        TEXT,
    status      TEXT NOT NULL DEFAULT 'drafting', -- drafting|researching|awaiting_approval|spawning|executing|reporting|done|killed
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id               TEXT PRIMARY KEY,
    directive_id     TEXT,
    agency_id        TEXT,             -- which agency surfaced/pursues it
    title            TEXT NOT NULL,
    thesis           TEXT,
    market           TEXT,
    effort           TEXT,
    risk             TEXT,
    projected_return TEXT,
    confidence       REAL NOT NULL DEFAULT 0.5,
    playbook         TEXT,
    contested        INTEGER NOT NULL DEFAULT 0,
    claimed_by       TEXT,             -- agency id that won a contested race
    status           TEXT NOT NULL DEFAULT 'proposed', -- proposed|approved|killed|claimed
    floor_id         TEXT,
    created_at       INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memory (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,        -- opportunity|research|decision|lesson
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    floor_id   TEXT,
    agent_id   TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS board (
    id         TEXT PRIMARY KEY,
    floor_id   TEXT NOT NULL,
    agent_id   TEXT,
    type       TEXT NOT NULL DEFAULT 'message', -- message|task|status|handoff
    content    TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity (
    id       TEXT PRIMARY KEY,
    ts       INTEGER NOT NULL,
    agent_id TEXT,
    task_id  TEXT,
    floor_id TEXT,
    type     TEXT NOT NULL,
    message  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id          TEXT PRIMARY KEY,
    ts          INTEGER NOT NULL,
    type        TEXT NOT NULL,      -- revenue|spend
    amount_usd  REAL NOT NULL,
    description TEXT,
    task_id     TEXT,
    floor_id    TEXT,
    agency_id   TEXT,
    season_id   TEXT,
    simulated   INTEGER NOT NULL DEFAULT 0,
    model       TEXT
  );

  CREATE TABLE IF NOT EXISTS attention (
    id        TEXT PRIMARY KEY,
    ts        INTEGER NOT NULL,
    kind      TEXT NOT NULL,        -- approval|blocker|escalation|alert|agent_review|opportunity|directive
    severity  TEXT NOT NULL DEFAULT 'info',
    title     TEXT NOT NULL,
    body      TEXT,
    payload   TEXT,                 -- JSON, for rich approval cards (e.g. proposed agent config)
    task_id   TEXT,
    agent_id  TEXT,
    floor_id  TEXT,
    agency_id TEXT,
    status    TEXT NOT NULL DEFAULT 'open'
  );

  CREATE TABLE IF NOT EXISTS audit (
    id     TEXT PRIMARY KEY,
    ts     INTEGER NOT NULL,
    actor  TEXT NOT NULL,           -- operator|system|<agent id>
    action TEXT NOT NULL,
    detail TEXT
  );

  -- Gamification: XP / level / badges, keyed by agent role (survives respawn).
  CREATE TABLE IF NOT EXISTS progression (
    agent_key  TEXT PRIMARY KEY,
    xp         REAL NOT NULL DEFAULT 0,
    level      INTEGER NOT NULL DEFAULT 1,
    badges     TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts);
  CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
  CREATE INDEX IF NOT EXISTS idx_agents_floor ON agents(floor_id);
  CREATE INDEX IF NOT EXISTS idx_attention_status ON attention(status);
  CREATE INDEX IF NOT EXISTS idx_board_floor ON board(floor_id);
`);

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, JSON.stringify(value));
}

/** Seed governance settings from .env defaults on first boot only. */
export function seedSettings() {
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'model'").get()) return;
  setSetting("model", config.defaults.model);
  setSetting("budgetCapUsd", config.defaults.budgetCapUsd);
  setSetting("paused", false);
  setSetting("emergencyStop", false);
  setSetting("dryRun", !config.defaults.apiKey); // default to safe dry-run when no key
  setSetting("maxDepth", config.defaults.maxDepth);
  setSetting("maxAgentsPerFloor", config.defaults.maxAgentsPerFloor);
  setSetting("maxActiveFloors", config.defaults.maxActiveFloors);
  // League / fund-level governance.
  setSetting("masterFundCapUsd", config.defaults.masterFundCapUsd);
  setSetting("drawdownPct", config.defaults.drawdownPct); // auto-liquidate at this loss %
  setSetting("tournamentMode", "profit");
}

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

/**
 * Dashboard-only state. NOT agent memory (Hermes owns that).
 *   tasks    — the jobs you send to Hermes + their approval lifecycle
 *   activity — the dashboard's own timestamped feed
 *   settings — dry-run/armed/emergency-stop/budget
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    agent_name  TEXT,
    instruction TEXT NOT NULL,
    output      TEXT,
    status      TEXT NOT NULL DEFAULT 'queued', -- queued|running|needs_review|approved|rejected|error
    model       TEXT,
    cost_usd    REAL NOT NULL DEFAULT 0,
    tokens_in   INTEGER NOT NULL DEFAULT 0,
    tokens_out  INTEGER NOT NULL DEFAULT 0,
    edited      INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity (
    id       TEXT PRIMARY KEY,
    ts       INTEGER NOT NULL,
    agent_id TEXT,
    task_id  TEXT,
    type     TEXT NOT NULL,
    message  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity(ts);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
`);

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}

export function setSetting(key: string, value: unknown) {
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, JSON.stringify(value));
}

export function seedSettings() {
  if (db.prepare("SELECT 1 FROM settings WHERE key='dryRun'").get()) return;
  setSetting("dryRun", true);          // dry-run by default
  setSetting("armed", false);          // real actions disarmed
  setSetting("emergencyStop", false);
  setSetting("budgetCapUsd", config.defaults.budgetCapUsd);
}

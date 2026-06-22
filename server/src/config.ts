import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Runtime configuration, sourced from .env with sensible defaults. */
export const config = {
  port: Number(process.env.PORT) || 4000,
  dbPath: path.resolve(__dirname, "../../data/mission-control.db"),
  // Settings below are seeded into the DB on first boot, then editable in the
  // Settings panel (the DB copy wins after that). .env is the initial source.
  defaults: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.MODEL || "claude-opus-4-8",
    budgetCapUsd: Number(process.env.BUDGET_CAP_USD ?? 5),
    seedRevenueUsd: Number(process.env.SEED_REVENUE_USD ?? 1280),
    // Recursion / governance caps — keep a self-spawning org terminable.
    maxDepth: Number(process.env.MAX_FLOOR_DEPTH ?? 3),
    maxAgentsPerFloor: Number(process.env.MAX_AGENTS_PER_FLOOR ?? 6),
    maxActiveFloors: Number(process.env.MAX_ACTIVE_FLOORS ?? 8),
    // League fund-level controls (Expansion III).
    masterFundCapUsd: Number(process.env.MASTER_FUND_CAP_USD ?? 25),
    drawdownPct: Number(process.env.DRAWDOWN_PCT ?? 50),
  },
};

/**
 * Per-1M-token pricing (USD) used to compute real API spend from usage.
 * Source: Anthropic pricing. Falls back to Opus-tier rates for unknown IDs.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function priceFor(model: string) {
  return MODEL_PRICING[model] ?? { input: 5, output: 25 };
}

export function costUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = priceFor(model);
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

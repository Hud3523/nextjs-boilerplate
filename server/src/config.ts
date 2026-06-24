import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dashboard configuration. The dashboard stores ONLY its own state (approval
 * queue, settings, cost log) — agent memory/scheduling lives in Hermes.
 */
export const config = {
  port: Number(process.env.PORT) || 4000,
  dbPath: path.resolve(__dirname, "../../data/dashboard.db"),
  // OpenRouter is where spend happens (Hermes calls models through it).
  openRouterKey: process.env.OPENROUTER_API_KEY || "",
  hermesMode: (process.env.HERMES_MODE || "mock").toLowerCase(),
  defaults: {
    budgetCapUsd: Number(process.env.BUDGET_CAP_USD ?? 5),
  },
};

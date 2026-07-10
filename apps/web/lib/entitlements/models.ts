import type { Tier } from "./matrix";

export type TaskComplexity = "simple" | "complex";

interface ModelConfig {
  free: string;
  standard: string;
  complex: string;
}

/**
 * Tier-routed model selection (DECISIONS #11). Agency gets the complex model
 * only when the task warrants it — Opus-for-everything would make Agency
 * *slower* than Studio on simple edits.
 */
export function modelFor(
  tier: Tier,
  complexity: TaskComplexity,
  config: ModelConfig,
): string {
  if (tier === "free") return config.free;
  if (tier === "agency" && complexity === "complex") return config.complex;
  return config.standard;
}

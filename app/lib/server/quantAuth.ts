import { env } from "./env";

// Simple shared code word that unlocks the quant bots. Configure via env
// QUANT_CODE_WORD (default "Money"). Case-insensitive, whitespace-trimmed.
export function codeOk(input: unknown): boolean {
  const expected = (env("QUANT_CODE_WORD") ?? "Money").trim().toLowerCase();
  return typeof input === "string" && input.trim().toLowerCase() === expected;
}

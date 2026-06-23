import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit, logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { raiseAttention } from "./attention.js";
import { validateListing, simulateListing } from "./listing.js";
import { gov } from "./governance.js";
import { getAgent, tools as agentTools, type AgentRow } from "./agents.js";
import { produce, hasApiKey } from "./engine.js";
import { awardXp } from "./progression.js";

// ── Grading: deterministic checks + a heuristic/judge score ──────────────────
export interface Grade {
  score: number;
  letter: string;
  detail: string;
}

function letterFor(score: number): string {
  if (score >= 93) return "A";
  if (score >= 85) return "A-";
  if (score >= 78) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

/**
 * Grade an output. For structured listings this is fully deterministic
 * (schema + field-quality checks); for prose it's a heuristic stand-in for the
 * Claude judge (sufficient in dry-run; the live judge would replace it).
 */
export function gradeText(_agentKey: string, _input: string, output: string, isListing: boolean): Grade {
  if (isListing) {
    const v = validateListing(output);
    if (!v.valid) return { score: 25, letter: "F", detail: `Schema invalid: ${v.errors.join(" ")}` };
    const l = v.value!;
    let score = 60;
    const notes: string[] = ["valid JSON ✓"];
    if (l.title.length >= 10 && l.title.length <= 140) { score += 12; notes.push("title length ✓"); } else notes.push("title length off");
    if (l.description.length >= 80) { score += 16; notes.push("rich description ✓"); } else notes.push("description thin");
    if (l.tags.length >= 3 && l.tags.length <= 12) { score += 12; notes.push("tag count ✓"); } else notes.push("tag count off");
    return { score: Math.min(100, score), letter: letterFor(Math.min(100, score)), detail: notes.join(", ") };
  }
  // prose heuristic: length, structure, concreteness
  const len = output.trim().length;
  let score = 55;
  if (len > 200) score += 15;
  if (/\n|[-•]|\d\./.test(output)) score += 15; // has structure
  if (/\b(recommend|next step|because|projected|confidence)\b/i.test(output)) score += 15;
  score = Math.min(100, score);
  return { score, letter: letterFor(score), detail: `Heuristic grade (length ${len}, structure & specificity checks).` };
}

export function recordGrade(input: { agentId?: string; agentKey: string; score: number; letter: string; kind: "train" | "task"; detail?: string }) {
  const row = {
    id: nanoid(),
    agent_id: input.agentId ?? null,
    agent_key: input.agentKey,
    score: input.score,
    letter: input.letter,
    kind: input.kind,
    detail: input.detail ?? null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO grades (id, agent_id, agent_key, score, letter, kind, detail, created_at)
     VALUES (@id,@agent_id,@agent_key,@score,@letter,@kind,@detail,@created_at)`,
  ).run(row);
  emit({ type: "agent", payload: { id: input.agentId, grade: input.letter, score: input.score } } as never);
}

/** Latest grade (report card headline) for an agent. */
export function reportCard(agentKey: string): { latest: number | null; letter: string | null; history: { score: number; ts: number }[] } {
  const rows = db.prepare("SELECT score, created_at FROM grades WHERE agent_key=? ORDER BY created_at DESC LIMIT 20").all(agentKey) as {
    score: number;
    created_at: number;
  }[];
  if (!rows.length) return { latest: null, letter: null, history: [] };
  return { latest: rows[0].score, letter: letterFor(rows[0].score), history: rows.map((r) => ({ score: r.score, ts: r.created_at })).reverse() };
}

// ── Golden test cases ────────────────────────────────────────────────────────
export interface TestCase {
  id: string;
  agent_key: string;
  name: string;
  input: string;
  rubric: string | null;
  created_at: number;
}

export function listTestCases(agentKey: string): TestCase[] {
  return db.prepare("SELECT * FROM test_cases WHERE agent_key=? ORDER BY created_at").all(agentKey) as TestCase[];
}

export function addTestCase(agentKey: string, name: string, input: string, rubric?: string): TestCase {
  const row: TestCase = { id: nanoid(), agent_key: agentKey, name, input, rubric: rubric ?? null, created_at: Date.now() };
  db.prepare("INSERT INTO test_cases (id, agent_key, name, input, rubric, created_at) VALUES (@id,@agent_key,@name,@input,@rubric,@created_at)").run(row);
  return row;
}

export function seedGoldenTests() {
  if (db.prepare("SELECT 1 FROM test_cases LIMIT 1").get()) return;
  // Forge: structured-listing tests (schema-graded).
  addTestCase("forge", "Wireless earbuds", "Product: noise-cancelling wireless earbuds, 30h battery, USB-C, sweatproof.", "Valid JSON listing; compelling title; benefit-led description; 4-8 relevant tags.");
  addTestCase("forge", "Ceramic mug", "Product: handmade 350ml ceramic coffee mug, matte glaze, dishwasher safe.", "Valid JSON listing; artisanal tone; 4-8 tags.");
  addTestCase("forge", "Yoga mat", "Product: 6mm eco TPE yoga mat, non-slip, with carry strap.", "Valid JSON listing; wellness tone; tags include material + use.");
  // Role-appropriate prose tests for the rest of the core crew.
  addTestCase("vega", "Market scan", "Research the market for reusable food wraps: size, top competitors, a gap we could exploit.", "Clear findings, a named opportunity, and a confidence read.");
  addTestCase("vega", "Keyword brief", "Find 8 high-intent keywords for a budget home-espresso niche and why each matters.", "Concrete keywords with rationale.");
  addTestCase("nova", "Ad caption", "Write 3 ad captions for a sleep tea brand, different angles, with the channel noted.", "3 distinct, on-voice variations.");
  addTestCase("nova", "Video hook", "Write a 5-second hook for a TikTok about a desk organiser.", "A punchy, scroll-stopping hook.");
  addTestCase("orbit", "Launch post", "Draft a launch announcement post for a new phone grip, flag the platform.", "Clear post + target platform; nothing auto-published.");
  addTestCase("orbit", "Outreach DM", "Draft a cold outreach DM to a micro-influencer for a skincare sample.", "Warm, concise, non-spammy.");
  addTestCase("relay", "Refund reply", "Draft a reply to a customer asking for a refund on a late order.", "Empathetic, on-brand, flags the edge case for review.");
  addTestCase("muse", "Idea burst", "Give ideas for a cheap weekend digital product.", "Ranked, varied, concrete ideas with a top pick.");
}

// ── Training run: grade each golden test (Mock or Dry-run) ───────────────────
export async function runTraining(agentId: string, mode: "mock" | "dry-run" = "dry-run") {
  const agent = getAgent(agentId);
  if (!agent) return { error: "Unknown agent" };
  const key = agent.reputation_key ?? agent.id;
  let cases = listTestCases(key);
  if (!cases.length) {
    // No curated tests → fall back to generic role-based ones so EVERY agent
    // (including runtime-spawned ones) can be trained and graded.
    const now = Date.now();
    cases = [
      { id: `gen-${key}-1`, agent_key: key, name: "Representative task", input: `As ${agent.role}, produce your best work for a typical request in your domain. Be concrete and specific.`, rubric: null, created_at: now },
      { id: `gen-${key}-2`, agent_key: key, name: "Tricky case", input: `As ${agent.role}, handle an ambiguous or harder-than-usual request in your domain. Show judgement and structure.`, rubric: null, created_at: now + 1 },
    ];
  }
  const isListing = agentTools(agent).includes("draft_listing");
  logActivity("system", `Training run for ${agent.callsign} (${mode}) over ${cases.length} golden cases…`, { agentId });

  const results: { name: string; score: number; letter: string }[] = [];
  for (const tc of cases) {
    let output: string;
    if (mode === "mock") {
      output = mockOutput(agent, tc.input, isListing);
    } else if (isListing && (gov.dryRun() || !hasApiKey())) {
      // dry-run: deterministic schema-valid listing (matches the task pipeline)
      output = JSON.stringify(simulateListing(tc.input));
    } else {
      const sys = isListing
        ? `${agent.system_prompt}\n\nRespond with ONLY valid JSON: {"title": string, "description": string, "tags": string[]}`
        : agent.system_prompt;
      const r = await produce(agent, sys, tc.input);
      output = r.text;
    }
    const g = gradeText(key, tc.input, output, isListing);
    results.push({ name: tc.name, score: g.score, letter: g.letter });
  }
  const avg = Math.round(results.reduce((n, r) => n + r.score, 0) / results.length);
  recordGrade({ agentId, agentKey: key, score: avg, letter: letterForAvg(avg), kind: "train", detail: results.map((r) => `${r.name}: ${r.letter}`).join("; ") });
  audit("operator", "training_run", { agent: agentId, mode, avg });
  logActivity("system", `${agent.callsign} training run complete: avg ${avg} (${letterForAvg(avg)}).`, { agentId });

  if (avg >= 90) awardXp(key, 15, "training_A"); // Scholar badge + XP for acing training
  // Prompt-improvement loop: if weak, propose a refined prompt for approval.
  if (avg < 85) proposePromptImprovement(agent, avg);
  return { avg, letter: letterForAvg(avg), results };
}

function letterForAvg(avg: number) {
  return letterFor(avg);
}

function mockOutput(agent: AgentRow, input: string, isListing: boolean): string {
  if (isListing) return JSON.stringify({ title: "Mock Title — Edition", description: "Mock description ".repeat(8), tags: ["mock", "test", "demo", "sample"] });
  return `Mock choreography output for: ${input}`;
}

/** Suggest a tightened prompt; operator approves before it goes live (versioned). */
function proposePromptImprovement(agent: AgentRow, avg: number) {
  const improved = `${agent.system_prompt}\n\nIMPROVE: Be more specific and concrete. For listings, write a benefit-led description ≥ 80 chars and 4-8 precise tags. Always return valid JSON only.`;
  raiseAttention({
    kind: "approval",
    severity: "info",
    title: `Prompt improvement for ${agent.callsign} (grade ${avg})`,
    body: `Training scored ${avg}. Architect proposes a refined system prompt. Approve to version it live (rollback-able), or Kill.`,
    payload: { kind: "prompt_improvement", agentId: agent.id, improved },
    agentId: agent.id,
  });
  logActivity("system", `Proposed a prompt improvement for ${agent.callsign} — awaiting approval.`, { agentId: agent.id });
}

/** Feasibility check for the Test Lab: would this task even work? */
export function feasibility(agentId: string, input: string) {
  const agent = getAgent(agentId);
  if (!agent) return { error: "Unknown agent" };
  const tools = agentTools(agent);
  let confidence = 0.5;
  const reasons: string[] = [];
  if (tools.length) { confidence += 0.2; reasons.push(`Has ${tools.length} registry tool(s).`); }
  if (input.trim().length > 20) { confidence += 0.15; reasons.push("Request is specific enough to act on."); }
  if (tools.some((t) => t === "draft_listing") && /product/i.test(input)) { confidence += 0.15; reasons.push("Matches the agent's core capability."); }
  confidence = Math.min(0.97, Math.round(confidence * 100) / 100);
  return { confidence, reasoning: reasons.join(" ") || "Limited signal; proceed with a dry-run to verify." };
}

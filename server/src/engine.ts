import Anthropic from "@anthropic-ai/sdk";
import { config, costUsd } from "./config.js";
import { db, getSetting } from "./db.js";
import { emit, logActivity } from "./bus.js";
import { gov, frozen, liveSpendAllowed } from "./governance.js";
import { getTool, unconfiguredExternal } from "./registry.js";
import { raiseAttention } from "./attention.js";
import { recordLedger, fundCapOk, checkDrawdownBreakers } from "./ledger.js";
import { remember, recentLessons } from "./memory.js";
import { postToBoard } from "./board.js";
import { bumpReputation, isTrusted } from "./reputation.js";
import { getAgency, parseDoctrine } from "./agencies.js";
import { getFloor } from "./floors.js";
import {
  getAgent,
  getAgentByRole,
  tools as agentTools,
  setAgentStatus,
  type AgentRow,
} from "./agents.js";
import { getTask, updateTask, type TaskRow } from "./tasks.js";
import { validateListing, simulateListing } from "./listing.js";
import { proposeCommand, simulateShellPlan } from "./shell.js";
import { gradeText, recordGrade } from "./academy.js";
import { awardXp } from "./progression.js";

const MAX_QA_PASSES = 2;

export function hasApiKey(): boolean {
  return Boolean(config.defaults.apiKey);
}

function model(agent?: AgentRow): string {
  return agent?.model || getSetting<string>("model", config.defaults.model);
}

/** dry-run, or live-but-no-key → simulate. */
function simulating(): boolean {
  return gov.dryRun() || !hasApiKey();
}

export function restingStatus(agent: AgentRow): "idle" | "needs-setup" | "blocked" {
  if (!hasApiKey() && !gov.dryRun()) return "needs-setup";
  const blocker = db
    .prepare("SELECT 1 FROM attention WHERE agent_id=? AND kind='blocker' AND status='open'")
    .get(agent.id);
  return blocker ? "blocked" : "idle";
}

export function settleAgent(agent: AgentRow, lastAction?: string) {
  setAgentStatus(agent.id, restingStatus(agent), lastAction);
}

/**
 * Stream a model response (or a simulated one). Reusable by the task pipeline
 * and the Training Academy. Returns text, token usage, and the raw prompt +
 * response for the debug log (guardrail: raw I/O is logged, secrets are not).
 */
export async function produce(
  agent: AgentRow,
  systemPrompt: string,
  userInput: string,
  taskId?: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number; simulated: boolean; raw: string }> {
  if (simulating()) {
    const text = await simulate(agent, userInput, (d) => {
      if (taskId) emit({ type: "token", payload: { taskId, agentId: agent.id, text: d } });
    });
    return { text, inputTokens: 0, outputTokens: 0, simulated: true, raw: text };
  }
  const client = new Anthropic({ apiKey: config.defaults.apiKey });
  let text = "";
  const stream = client.messages.stream({
    model: model(agent),
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userInput }],
  });
  stream.on("text", (d) => {
    text += d;
    if (taskId) emit({ type: "token", payload: { taskId, agentId: agent.id, text: d } });
  });
  const final = await stream.finalMessage();
  if (!text)
    text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  return { text, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, simulated: false, raw: text };
}

/**
 * Run one task end-to-end: generate → Sentinel QA (bounded retry) → Aegis
 * safety → approval. Records cost (real or simulated) and reputation.
 */
export async function runTask(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) return;
  const agent = getAgent(task.agent_id);
  if (!agent) return;

  if (frozen()) {
    updateTask(taskId, { status: "queued" });
    return;
  }
  const agency = getAgency(agent.agency_id);
  if (agency && agency.status !== "active") {
    updateTask(taskId, { status: "queued" });
    return;
  }
  if (agent.enabled === 0) return;
  // Real-money gate.
  if (liveSpendAllowed() && !fundCapOk()) {
    updateTask(taskId, { status: "queued" });
    return;
  }

  updateTask(taskId, { status: "running", model: model(agent), attempts: task.attempts + 1 });
  setAgentStatus(agent.id, "working", `Running: ${task.title}`);
  logActivity("run_start", `${agent.callsign} started "${task.title}".`, { agentId: agent.id, taskId, floorId: agent.floor_id });
  if (agent.floor_id) postToBoard({ floorId: agent.floor_id, agentId: agent.id, type: "status", content: `Working on: ${task.title}` });

  // Inject lessons learned so the org compounds instead of starting cold (Lattice).
  const lessons = recentLessons();
  const isListing = agentTools(agent).includes("draft_listing");
  const isShell = agentTools(agent).includes("shell");
  let sys = lessons ? `${agent.system_prompt}\n\nRELEVANT LESSONS LEARNED:\n${lessons}` : agent.system_prompt;
  if (isListing)
    sys += `\n\nRespond with ONLY valid JSON matching this exact shape (no prose, no markdown fences):\n{"title": string, "description": string, "tags": string[]}`;

  let result;
  try {
    if (isShell && simulating()) {
      const plan = simulateShellPlan(task.input);
      const raw = JSON.stringify(plan, null, 2);
      for (const w of raw.split(/(\s+)/)) emit({ type: "token", payload: { taskId, agentId: agent.id, text: w } });
      result = { text: raw, inputTokens: 0, outputTokens: 0, simulated: true, raw };
    } else if (isListing && simulating()) {
      // deterministic, schema-valid dry-run listing
      const listing = simulateListing(task.input);
      const raw = JSON.stringify(listing, null, 2);
      for (const w of raw.split(/(\s+)/)) emit({ type: "token", payload: { taskId, agentId: agent.id, text: w } });
      result = { text: raw, inputTokens: 0, outputTokens: 0, simulated: true, raw };
    } else {
      result = await produce(agent, sys, task.input, taskId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateTask(taskId, { status: "queued", output: `Run failed: ${message}` });
    logActivity("run_end", `${agent.callsign} run failed: ${message}`, { agentId: agent.id, taskId });
    raiseAttention({ kind: "escalation", severity: "warn", title: `${agent.callsign} run failed`, body: message, agentId: agent.id, taskId, dedupe: true });
    settleAgent(agent, `Run failed: ${task.title}`);
    return;
  }

  let { text, inputTokens, outputTokens, simulated } = result;
  // Persist raw prompt + response for debugging (never contains secrets).
  updateTask(taskId, { raw_prompt: `SYSTEM:\n${sys}\n\nUSER:\n${task.input}`, raw_response: result.raw });

  // ── shell agents: propose commands for per-command operator approval ──────
  if (isShell) {
    let commands: { cmd: string; why: string }[] = [];
    let plan = text;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text);
      plan = parsed.plan ?? text;
      commands = Array.isArray(parsed.commands) ? parsed.commands.filter((c: { cmd?: unknown }) => typeof c.cmd === "string") : [];
    } catch {
      raiseAttention({ kind: "escalation", severity: "warn", title: `${agent.callsign}: could not parse a command plan`, body: text.slice(0, 400), agentId: agent.id, taskId });
    }
    updateTask(taskId, { status: "done", output: plan + (commands.length ? `\n\nProposed commands:\n${commands.map((c) => `$ ${c.cmd}  — ${c.why}`).join("\n")}` : "") });
    for (const c of commands) proposeCommand(agent, c.cmd, c.why);
    logActivity("run_end", `${agent.callsign} proposed ${commands.length} command(s) for "${task.title}" — awaiting your approval.`, { agentId: agent.id, taskId, floorId: agent.floor_id });
    settleAgent(agent, `Proposed ${commands.length} command(s)`);
    return;
  }

  // Validated-outputs gate (guardrail #8): Forge listings must be valid JSON.
  if (isListing) {
    const v = validateListing(text);
    updateTask(taskId, { structured: 1, valid: v.valid ? 1 : 0 });
    if (!v.valid) {
      updateTask(taskId, { status: "needs_review", output: text, review_status: "failed", review_notes: `Invalid listing JSON: ${v.errors.join(" ")}` });
      raiseAttention({ kind: "escalation", severity: "warn", title: `${agent.callsign}: invalid structured output`, body: v.errors.join(" "), agentId: agent.id, taskId, floorId: agent.floor_id });
      logActivity("run_end", `${agent.callsign}'s output failed schema validation — not actionable.`, { agentId: agent.id, taskId });
      settleAgent(agent, `Invalid output: ${task.title}`);
      return;
    }
    text = JSON.stringify(v.value, null, 2); // normalised
  } else if (simulated) {
    text = `⚠️ [DRY-RUN — simulated output, $0 real spend]\n\n${text}`;
  }

  // ── cost: real spend counts to the fund cap; dry-run logs simulated spend ──
  const realCost = simulated ? 0 : costUsd(model(agent), inputTokens, outputTokens);
  const doctrine = agency ? parseDoctrine(agency) : null;
  const simSpend = simulated ? round(0.02 + (doctrine?.spendAggressiveness ?? 0.5) * 0.18 * (0.5 + Math.random())) : 0;
  const spendAmt = simulated ? simSpend : realCost;
  if (spendAmt > 0) {
    recordLedger("spend", spendAmt, {
      description: `${agent.callsign}: ${task.title}`,
      taskId,
      floorId: agent.floor_id,
      agencyId: agent.agency_id,
      model: model(agent),
      simulated,
    });
  }

  updateTask(taskId, { output: text, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: spendAmt });

  // ── Sentinel QA: review the work; bounded retry on FAIL ──────────────────
  const skipQA = ["sentinel", "aegis", "arbiter"].includes(agent.reputation_key ?? "") || isTrusted(agent.reputation_key ?? "");
  if (!skipQA) {
    updateTask(taskId, { status: "reviewing" });
    const review = await sentinelReview(agent, task, text);
    updateTask(taskId, { review_status: review.passed ? "passed" : "failed", review_notes: review.notes });
    logActivity("info", `Sentinel review of "${task.title}": ${review.passed ? "PASS" : "FAIL"}.`, { agentId: agent.id, taskId });
    if (!review.passed) {
      bumpReputation(agent.reputation_key ?? agent.id, -0.5);
      if (task.attempts + 1 < MAX_QA_PASSES) {
        // retry: feed the fixes back in
        updateTask(taskId, {
          status: "queued",
          input: `${task.input}\n\n[SENTINEL RETURNED FIXES — revise accordingly]\n${review.notes}`,
        });
        logActivity("info", `${agent.callsign} retrying "${task.title}" with Sentinel's fixes.`, { agentId: agent.id, taskId });
        settleAgent(agent, `Revising: ${task.title}`);
        return;
      }
      // exhausted: escalate, write a lesson
      remember({ kind: "lesson", title: `QA failure: ${task.title}`, content: review.notes || "Repeated QA failure.", floorId: agent.floor_id ?? undefined, agentId: agent.id });
      raiseAttention({ kind: "escalation", severity: "warn", title: `${agent.callsign}: QA failed after ${MAX_QA_PASSES} passes`, body: review.notes ?? undefined, agentId: agent.id, taskId, floorId: agent.floor_id });
      settleAgent(agent, `Escalated: ${task.title}`);
      logActivity("run_end", `${agent.callsign} escalated "${task.title}" to operator after QA failures.`, { agentId: agent.id, taskId });
      return;
    }
  }

  // ── Aegis safety gate: any external-facing output is checked first ───────
  const externalKeys = agentTools(agent).filter((k) => getTool(k)?.external);
  if (externalKeys.length) {
    const safety = await aegisReview(agent, task, text);
    if (!safety.safe) {
      updateTask(taskId, { status: "needs_review", review_notes: `Aegis flagged: ${safety.notes}` });
      raiseAttention({ kind: "escalation", severity: "warn", title: `Aegis flagged ${agent.callsign}'s output`, body: safety.notes, agentId: agent.id, taskId, floorId: agent.floor_id });
      logActivity("run_end", `Aegis flagged "${task.title}" for safety review.`, { agentId: agent.id, taskId });
      settleAgent(agent, `Aegis-flagged: ${task.title}`);
      return;
    }
  }

  // ── passed QA + safety → approval gate ──────────────────────────────────
  updateTask(taskId, { status: "needs_review" });
  bumpReputation(agent.reputation_key ?? agent.id, 0.5);
  // Grade this output for the agent's live report card.
  const g = gradeText(agent.reputation_key ?? agent.id, task.input, text, isListing);
  recordGrade({ agentId: agent.id, agentKey: agent.reputation_key ?? agent.id, score: g.score, letter: g.letter, kind: "task", detail: g.detail });
  awardXp(agent.reputation_key ?? agent.id, 4 + g.score / 20, "task"); // XP for completing graded work
  logActivity(
    "run_end",
    `${agent.callsign} finished "${task.title}" — ${outputTokens} out tok, $${spendAmt.toFixed(4)}${simulated ? " (sim)" : ""}.`,
    { agentId: agent.id, taskId, floorId: agent.floor_id },
  );
  if (agent.floor_id) postToBoard({ floorId: agent.floor_id, agentId: agent.id, type: "handoff", content: `Draft ready for approval: ${task.title}` });

  raiseAttention({
    kind: "approval",
    severity: "info",
    title: `Approve: ${task.title}`,
    body: `${agent.callsign} prepared a draft (QA passed${externalKeys.length ? ", Aegis cleared" : ""}). Approve to accept, or Kill to discard.`,
    agentId: agent.id,
    taskId,
    floorId: agent.floor_id,
    agencyId: agent.agency_id,
  });

  // External, unconfigured platform → honest blocker (never fakes a post).
  const blocked = unconfiguredExternal(agentTools(agent));
  if (blocked.length) {
    raiseAttention({
      kind: "blocker",
      severity: "warn",
      title: `${agent.callsign} blocked: ${blocked[0].label} not configured`,
      body: `Can draft but can't publish — ${blocked[0].setupHint ?? "configure credentials and implement publish()."}`,
      agentId: agent.id,
      floorId: agent.floor_id,
      agencyId: agent.agency_id,
      dedupe: true,
    });
  }

  checkDrawdownBreakers();
  settleAgent(agent, `Drafted: ${task.title}`);
}

// ── critics ────────────────────────────────────────────────────────────────
async function sentinelReview(agent: AgentRow, task: TaskRow, output: string): Promise<{ passed: boolean; notes: string }> {
  if (simulating()) {
    // Demonstrate the loop: ~80% pass, fail on a first attempt sometimes.
    const passed = Math.random() > 0.2 || task.attempts >= 1;
    return { passed, notes: passed ? "Meets the task spec." : "Be more specific and add concrete next steps; tighten the structure." };
  }
  const sentinel = getAgentByRole(agent.agency_id, "Sentinel") || getAgentByRole("league", "Sentinel");
  const sys = sentinel?.system_prompt ?? "You are a strict QA critic. Reply 'VERDICT: PASS' or 'VERDICT: FAIL' then reasoning.";
  const review = await rawCall(sys, `TASK: ${task.title}\nINPUT: ${task.input}\n\nOUTPUT TO REVIEW:\n${output}`);
  const passed = /VERDICT:\s*PASS/i.test(review);
  return { passed, notes: review.replace(/VERDICT:\s*(PASS|FAIL)/i, "").trim().slice(0, 600) };
}

async function aegisReview(agent: AgentRow, task: TaskRow, output: string): Promise<{ safe: boolean; notes: string }> {
  if (simulating()) {
    const safe = Math.random() > 0.1;
    return { safe, notes: safe ? "No brand/policy/legal concerns." : "Contains an unverifiable claim; soften or substantiate before any external use." };
  }
  const sys =
    "You are AEGIS, a brand/policy/legal/quality safety reviewer for external-facing content. Reply 'SAFE' or 'UNSAFE' on the first line, then a one-line reason. Be strict about unverifiable claims, policy violations, and anything that could harm the brand.";
  const review = await rawCall(sys, `Proposed external content from ${agent.callsign}:\n${output}`);
  const safe = /^\s*SAFE/i.test(review);
  return { safe, notes: review.replace(/^\s*(SAFE|UNSAFE)/i, "").trim().slice(0, 400) };
}

/** One-shot non-streaming call for internal critics. */
async function rawCall(system: string, userInput: string): Promise<string> {
  const client = new Anthropic({ apiKey: config.defaults.apiKey });
  const res = await client.messages.create({
    model: getSetting<string>("model", config.defaults.model),
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: userInput }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Streamed, templated stand-in for dry-run / no-key mode. */
async function simulate(agent: AgentRow, userInput: string, onDelta: (s: string) => void): Promise<string> {
  const text =
    `${agent.callsign} — ${agent.role}\n\n` +
    `[Dry-run draft. No live model was called and no real budget was spent.]\n\n` +
    `Re: ${userInput.slice(0, 160)}\n\n` +
    `This is the full human-in-the-loop pipeline running safely: the draft is generated, reviewed by Sentinel (QA), ` +
    `cleared by Aegis if it targets an external platform, and queued for your approval. Set ANTHROPIC_API_KEY and arm ` +
    `live mode in the control room to have ${agent.callsign} produce real output. Nothing publishes without your sign-off.`;
  for (const w of text.split(/(\s+)/)) {
    onDelta(w);
    await new Promise((r) => setTimeout(r, 8));
  }
  return text;
}

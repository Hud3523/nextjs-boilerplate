import { Router } from "express";
import { db, getSetting, setSetting } from "../db.js";
import { config } from "../config.js";
import { emit, logActivity } from "../bus.js";
import { hermes } from "../hermes/index.js";
import { flags, setFlag, totalSpend, openRouterCredits } from "../ledger.js";
import { createTask, getTask, updateTask, listTasks } from "../tasks.js";
import { runTask, working } from "../runner.js";

export const api = Router();

let rosterCache: { ts: number; agents: any[] } = { ts: 0, agents: [] };
async function roster() {
  // brief cache so /state doesn't hammer the CLI/HTTP gateway
  if (Date.now() - rosterCache.ts < 2500 && rosterCache.agents.length) return rosterCache.agents;
  const agents = await hermes().listAgents().catch(() => []);
  const view = agents.map((a) => ({ ...a, status: working.has(a.id) ? "working" : a.status }));
  rosterCache = { ts: Date.now(), agents: view };
  return view;
}

function stats() {
  const cap = flags.budgetCapUsd();
  const spend = totalSpend();
  return {
    spendUsd: spend, budgetCapUsd: cap, creditsRemainingUsd: cap > 0 ? Math.max(0, cap - spend) : null,
    dryRun: flags.dryRun(), emergencyStop: flags.emergencyStop(),
    hermesMode: hermes().mode, openRouterConfigured: Boolean(config.openRouterKey),
    needsReview: (db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status='needs_review'").get() as { c: number }).c,
  };
}

api.get("/state", async (_req, res) => {
  const health = await hermes().health();
  res.json({
    agents: await roster(),
    tasks: listTasks(80),
    activity: db.prepare("SELECT * FROM activity ORDER BY ts DESC LIMIT 80").all(),
    stats: stats(),
    hermes: { mode: hermes().mode, health },
    settings: { budgetCapUsd: flags.budgetCapUsd(), dryRun: flags.dryRun(), emergencyStop: flags.emergencyStop(), openRouterConfigured: Boolean(config.openRouterKey) },
  });
});

api.get("/agents", async (_req, res) => res.json(await roster()));

// ── tasks: assign a job → Hermes → approval queue ────────────────────────────
api.post("/tasks", async (req, res) => {
  const { agentId, instruction } = req.body ?? {};
  if (!agentId || !instruction) return res.status(400).json({ error: "agentId and instruction are required" });
  const agents = await roster();
  const agent = agents.find((a) => a.id === agentId);
  const task = createTask({ agentId, agentName: agent?.name, instruction });
  logActivity("info", `Job queued for ${agent?.name ?? agentId}: ${instruction.slice(0, 80)}`, { agentId, taskId: task.id });
  void runTask(task.id);
  res.status(201).json(task);
});

api.patch("/tasks/:id", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Unknown task" });
  if (typeof req.body?.output !== "string") return res.status(400).json({ error: "output required" });
  updateTask(task.id, { output: req.body.output, edited: 1 });
  logActivity("info", `Operator edited result for "${task.instruction.slice(0, 60)}".`, { taskId: task.id });
  res.json(getTask(task.id));
});

api.post("/tasks/:id/approve", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Unknown task" });
  updateTask(task.id, { status: "approved" });
  logActivity("approval", `Approved ${task.agent_name ?? task.agent_id}'s result${flags.dryRun() ? " (dry-run — not executed externally)" : ""}.`, { agentId: task.agent_id, taskId: task.id });
  res.json(getTask(task.id));
});

api.post("/tasks/:id/reject", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Unknown task" });
  updateTask(task.id, { status: "rejected" });
  logActivity("approval", `Killed ${task.agent_name ?? task.agent_id}'s result.`, { agentId: task.agent_id, taskId: task.id });
  res.json(getTask(task.id));
});

// ── cost ─────────────────────────────────────────────────────────────────────
api.get("/cost", async (_req, res) => {
  res.json({ spendUsd: totalSpend(), budgetCapUsd: flags.budgetCapUsd(), openRouter: await openRouterCredits() });
});

// ── settings + guardrail controls ────────────────────────────────────────────
api.get("/settings", (_req, res) => res.json({ budgetCapUsd: flags.budgetCapUsd(), dryRun: flags.dryRun(), emergencyStop: flags.emergencyStop() }));

api.post("/settings", (req, res) => {
  if (typeof req.body?.budgetCapUsd === "number") setSetting("budgetCapUsd", req.body.budgetCapUsd);
  logActivity("system", "Settings updated.");
  emit({ type: "stats", payload: stats() });
  res.json({ budgetCapUsd: flags.budgetCapUsd() });
});

api.post("/control/arm", (req, res) => {
  const on = req.body?.on === true;
  if (on && Number(req.body?.confirm) < 3) return res.status(428).json({ error: "Arming real actions requires triple-confirm.", needConfirm: 3 });
  setFlag("dryRun", !on);
  logActivity("system", on ? "⚡ Real actions ARMED — approved actions can now run for real." : "Switched to DRY-RUN — results display only.");
  emit({ type: "stats", payload: stats() });
  res.json({ dryRun: !on });
});

api.post("/control/estop", (req, res) => {
  const on = req.body?.on !== false;
  setFlag("emergencyStop", on);
  logActivity("system", on ? "🛑 EMERGENCY STOP — execution frozen." : "Emergency stop released.");
  emit({ type: "stats", payload: stats() });
  res.json({ emergencyStop: on });
});

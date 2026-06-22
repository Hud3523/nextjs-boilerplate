import { Router } from "express";
import { db, getSetting, setSetting } from "../db.js";
import { config } from "../config.js";
import { emit, logActivity } from "../bus.js";
import { audit, listAudit } from "../audit.js";
import { gov, setFlag } from "../governance.js";
import { listTools, getTool } from "../registry.js";
import { hasApiKey, settleAgent } from "../engine.js";
import {
  listAgencies, getAgency, agencyPnl, agencyEquity, parseDoctrine, updateAgency,
} from "../agencies.js";
import { listFloors, getFloor, floorSpend, floorRevenue } from "../floors.js";
import {
  listAgents, getAgent, tools as agentTools, setAgentEnabled, type AgentRow,
} from "../agents.js";
import {
  createTask, getTask, updateTask, listTasks,
} from "../tasks.js";
import {
  listAttention, getAttention, resolveAttention, resolveAttentionForTask, raiseAttention,
} from "../attention.js";
import {
  totalRevenue, fundSpend, realSpendToday, cyclesToday, recordLedger, lowCreditWarning,
} from "../ledger.js";
import { listMemory } from "../memory.js";
import { listBoard } from "../board.js";
import { listReputation } from "../reputation.js";
import { currentSeason, listSeasons } from "../seasons.js";
import {
  createDirective, listDirectives, listOpportunities, getOpportunity,
  approveOpportunity, killOpportunity,
} from "../directives.js";
import {
  leaderboard, analytics, dailyBriefing, settleSeason, whatIf,
  createContestedOpportunity, refereeContested,
} from "../league.js";
import { proposeAgent, materializeAgent, spawnAgency } from "../factory.js";
import { processQueue } from "../scheduler.js";
import {
  reportCard, listTestCases, addTestCase, runTraining, feasibility,
} from "../academy.js";

export const api = Router();

// ── shaping helpers ──────────────────────────────────────────────────────
function agentView(a: AgentRow) {
  return {
    id: a.id, callsign: a.callsign, role: a.role, floorId: a.floor_id, agencyId: a.agency_id,
    bay: a.bay, trigger: a.trigger, intervalMinutes: a.interval_minutes,
    model: a.model || getSetting<string>("model", config.defaults.model),
    allowedTools: agentTools(a), guardrails: safeParse(a.guardrails, []),
    sandboxed: Boolean(a.sandboxed), permanent: Boolean(a.permanent), enabled: Boolean(a.enabled),
    status: a.status, lastAction: a.last_action, lastRunAt: a.last_run_at, nextRunAt: a.next_run_at,
    reputationKey: a.reputation_key,
    report: reportCard(a.reputation_key ?? a.id),
  };
}

function safeParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function stats() {
  const fundCap = gov.masterFundCapUsd();
  const spent = fundSpend();
  const nextRuns = (db.prepare("SELECT next_run_at FROM agents WHERE next_run_at IS NOT NULL").all() as { next_run_at: number }[])
    .map((r) => r.next_run_at);
  return {
    revenueUsd: totalRevenue(),
    fundSpendUsd: spent,
    realSpendTodayUsd: realSpendToday(),
    masterFundCapUsd: fundCap,
    creditsRemainingUsd: fundCap > 0 ? Math.max(0, fundCap - spent) : null,
    lowCredit: lowCreditWarning(),
    model: getSetting<string>("model", config.defaults.model),
    cyclesToday: cyclesToday(),
    nextRunAt: nextRuns.length ? Math.min(...nextRuns) : null,
    paused: gov.paused(),
    emergencyStop: gov.emergencyStop(),
    dryRun: gov.dryRun(),
    apiKeyConfigured: hasApiKey(),
    tournamentMode: gov.tournamentMode(),
  };
}

function settingsView() {
  return {
    model: getSetting<string>("model", config.defaults.model),
    budgetCapUsd: gov.budgetCapUsd(),
    masterFundCapUsd: gov.masterFundCapUsd(),
    drawdownPct: gov.drawdownPct(),
    maxDepth: gov.maxDepth(),
    maxAgentsPerFloor: gov.maxAgentsPerFloor(),
    maxActiveFloors: gov.maxActiveFloors(),
    tournamentMode: gov.tournamentMode(),
    dryRun: gov.dryRun(),
    paused: gov.paused(),
    emergencyStop: gov.emergencyStop(),
    apiKeyConfigured: hasApiKey(),
  };
}

function agencyView(id: string) {
  const a = getAgency(id);
  if (!a) return null;
  return { ...a, doctrine: parseDoctrine(a), pnl: agencyPnl(id), equity: agencyEquity(id) };
}

// ── full snapshot ─────────────────────────────────────────────────────────
api.get("/state", (_req, res) => {
  res.json({
    agencies: listAgencies({ includeLeague: true }).map((a) => agencyView(a.id)),
    floors: listFloors().map((f) => ({ ...f, spend: floorSpend(f.id), revenue: floorRevenue(f.id) })),
    agents: listAgents().map(agentView),
    leaderboard: leaderboard(),
    tasks: listTasks({ limit: 80 }),
    attention: listAttention(),
    opportunities: listOpportunities(),
    directives: listDirectives(),
    tools: listTools(),
    activity: db.prepare("SELECT * FROM activity ORDER BY ts DESC LIMIT 80").all(),
    memory: listMemory({ limit: 40 }),
    reputation: listReputation(),
    season: currentSeason() ?? null,
    seasons: listSeasons(),
    analytics: analytics(),
    briefing: dailyBriefing(),
    stats: stats(),
    settings: settingsView(),
  });
});

// ── hierarchy ───────────────────────────────────────────────────────────
api.get("/agencies", (_req, res) => res.json(listAgencies({ includeLeague: true }).map((a) => agencyView(a.id))));

api.get("/agencies/:id", (req, res) => {
  const view = agencyView(req.params.id);
  if (!view) return res.status(404).json({ error: "Unknown agency" });
  res.json({
    ...view,
    floors: listFloors({ agencyId: req.params.id }).map((f) => ({ ...f, spend: floorSpend(f.id), revenue: floorRevenue(f.id) })),
    agents: listAgents({ agencyId: req.params.id }).map(agentView),
  });
});

api.post("/agencies", (req, res) => {
  const { name, doctrine, capitalUsd } = req.body ?? {};
  if (!name || !doctrine || typeof capitalUsd !== "number") return res.status(400).json({ error: "name, doctrine, capitalUsd required" });
  const agency = spawnAgency({ name, doctrine, capitalUsd, seasonId: currentSeason()?.id });
  res.status(201).json(agencyView(agency.id));
});

api.post("/agencies/:id/promote", (req, res) => {
  const a = getAgency(req.params.id);
  if (!a) return res.status(404).json({ error: "Unknown agency" });
  const add = typeof req.body?.amount === "number" ? req.body.amount : a.capital_usd * 0.5;
  updateAgency(a.id, { capital_usd: Math.round((a.capital_usd + add) * 100) / 100, status: "active" });
  audit("operator", "promote_agency", { agency: a.id, add });
  logActivity("system", `Operator promoted ${a.name}: +$${add.toFixed(2)} capital.`);
  res.json(agencyView(a.id));
});

api.post("/agencies/:id/disband", (req, res) => {
  const a = getAgency(req.params.id);
  if (!a) return res.status(404).json({ error: "Unknown agency" });
  updateAgency(a.id, { status: "liquidated" });
  db.prepare("UPDATE floors SET status='killed' WHERE agency_id=? AND permanent=0 AND status NOT IN ('done','killed')").run(a.id);
  audit("operator", "disband_agency", { agency: a.id });
  logActivity("system", `Operator disbanded ${a.name}.`);
  res.json(agencyView(a.id));
});

api.get("/floors", (req, res) => {
  const agencyId = typeof req.query.agencyId === "string" ? req.query.agencyId : undefined;
  res.json(listFloors({ agencyId }).map((f) => ({ ...f, spend: floorSpend(f.id), revenue: floorRevenue(f.id) })));
});

api.get("/floors/:id", (req, res) => {
  const f = getFloor(req.params.id);
  if (!f) return res.status(404).json({ error: "Unknown floor" });
  res.json({
    ...f, spend: floorSpend(f.id), revenue: floorRevenue(f.id),
    agents: listAgents({ floorId: f.id }).map(agentView),
    tasks: listTasks({ floorId: f.id, limit: 30 }),
    board: listBoard(f.id, 40),
  });
});

api.get("/agents/:id", (req, res) => {
  const a = getAgent(req.params.id);
  if (!a) return res.status(404).json({ error: "Unknown agent" });
  res.json({
    ...agentView(a),
    systemPrompt: a.system_prompt,
    tasks: listTasks({ agentId: a.id, limit: 25 }),
    activity: db.prepare("SELECT * FROM activity WHERE agent_id=? ORDER BY ts DESC LIMIT 40").all(a.id),
  });
});

api.post("/agents/:id/toggle", (req, res) => {
  const a = getAgent(req.params.id);
  if (!a) return res.status(404).json({ error: "Unknown agent" });
  const enabled = a.enabled === 0;
  setAgentEnabled(a.id, enabled);
  logActivity("system", `${a.callsign} ${enabled ? "enabled" : "disabled"}.`, { agentId: a.id });
  res.json({ id: a.id, enabled });
});

// ── Training Academy + Test Lab ───────────────────────────────────────────
api.get("/agents/:id/tests", (req, res) => {
  const a = getAgent(req.params.id);
  if (!a) return res.status(404).json({ error: "Unknown agent" });
  res.json({ report: reportCard(a.reputation_key ?? a.id), tests: listTestCases(a.reputation_key ?? a.id) });
});

api.post("/agents/:id/tests", (req, res) => {
  const a = getAgent(req.params.id);
  if (!a) return res.status(404).json({ error: "Unknown agent" });
  const { name, input, rubric } = req.body ?? {};
  if (!name || !input) return res.status(400).json({ error: "name, input required" });
  res.status(201).json(addTestCase(a.reputation_key ?? a.id, name, input, rubric));
});

api.post("/agents/:id/train", async (req, res) => {
  const mode = req.body?.mode === "mock" ? "mock" : "dry-run";
  const result = await runTraining(req.params.id, mode);
  if ("error" in result) return res.status(400).json(result);
  res.json(result);
});

api.post("/agents/:id/feasibility", (req, res) => {
  const input = typeof req.body?.input === "string" ? req.body.input : "";
  const result = feasibility(req.params.id, input);
  if ("error" in result) return res.status(404).json(result);
  res.json(result);
});

// org-graph tree
api.get("/orgtree", (_req, res) => {
  const tree = listAgencies({ includeLeague: true }).map((a) => ({
    ...agencyView(a.id),
    floors: listFloors({ agencyId: a.id }).map((f) => ({
      ...f,
      agents: listAgents({ floorId: f.id }).map((ag) => ({ id: ag.id, callsign: ag.callsign, role: ag.role, status: ag.status, bay: ag.bay })),
    })),
  }));
  res.json(tree);
});

// ── tasks ───────────────────────────────────────────────────────────────
api.get("/tasks", (req, res) => {
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
  const floorId = typeof req.query.floorId === "string" ? req.query.floorId : undefined;
  res.json(listTasks({ agentId, floorId, limit: 100 }));
});

api.post("/tasks", (req, res) => {
  const { agentId, title, input } = req.body ?? {};
  if (!agentId || !title || !input) return res.status(400).json({ error: "agentId, title, input required" });
  const agent = getAgent(agentId);
  if (!agent) return res.status(404).json({ error: "Unknown agent" });
  const task = createTask({ agentId, title, input });
  logActivity("info", `Task queued for ${agent.callsign}: ${title}`, { agentId, taskId: task.id, floorId: agent.floor_id });
  void processQueue(agentId);
  res.status(201).json(task);
});

// Approve / Edit / Kill — edit the draft before approving.
api.patch("/tasks/:id", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Unknown task" });
  const output = typeof req.body?.output === "string" ? req.body.output : null;
  if (output == null) return res.status(400).json({ error: "output required" });
  updateTask(task.id, { output, edited: 1 });
  audit("operator", "edit_task", { task: task.id });
  logActivity("info", `Operator edited ${getAgent(task.agent_id)?.callsign ?? "agent"}'s draft "${task.title}".`, { agentId: task.agent_id, taskId: task.id });
  res.json(getTask(task.id));
});

api.post("/tasks/:id/approve", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Unknown task" });
  if (!["needs_review", "approved"].includes(task.status)) return res.status(409).json({ error: `Task is ${task.status}` });
  const agent = getAgent(task.agent_id)!;
  updateTask(task.id, { status: "approved" });
  resolveAttentionForTask(task.id);

  const target = agentTools(agent).map(getTool).find((t) => t && t.external && t.configured);
  const note = target ? `published via ${target.label}` : "filed as approved draft (no external publish configured)";
  updateTask(task.id, { status: "done" });
  audit("operator", "approve_task", { task: task.id });
  logActivity("approval", `${agent.callsign}'s "${task.title}" approved — ${note}.`, { agentId: agent.id, taskId: task.id, floorId: agent.floor_id });

  // Simulated venture revenue (clearly cosmetic; flows to the agency's P&L).
  if (!task.sandboxed && /listing|commerce|content|copy|product|outreach|message/i.test(agent.role)) {
    const amount = Math.round((10 + Math.random() * 90) * 100) / 100;
    recordLedger("revenue", amount, { description: `Approved win: ${task.title}`, taskId: task.id, floorId: agent.floor_id, agencyId: agent.agency_id, simulated: gov.dryRun() });
    logActivity("info", `Revenue +$${amount.toFixed(2)} from "${task.title}"${gov.dryRun() ? " (simulated)" : ""}.`, { agentId: agent.id, floorId: agent.floor_id });
  }
  res.json(getTask(task.id));
});

api.post("/tasks/:id/reject", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Unknown task" });
  const agent = getAgent(task.agent_id)!;
  updateTask(task.id, { status: "rejected" });
  resolveAttentionForTask(task.id);
  audit("operator", "reject_task", { task: task.id });
  logActivity("approval", `${agent.callsign}'s "${task.title}" killed by operator.`, { agentId: agent.id, taskId: task.id });
  res.json(getTask(task.id));
});

// ── attention queue (generic + rich approval cards) ──────────────────────
api.get("/attention", (_req, res) => res.json(listAttention()));

api.post("/attention/:id/act", (req, res) => {
  const item = getAttention(req.params.id);
  if (!item) return res.status(404).json({ error: "Unknown item" });
  const action = req.body?.action === "kill" ? "kill" : "approve";
  const payload = item.payload ? safeParse<Record<string, unknown>>(item.payload, {}) : {};

  // Rich agent-spec approval card → materialize the agent (hot-loaded).
  if ((payload as { kind?: string }).kind === "agent_spec") {
    if (action === "approve") {
      const p = payload as { spec: never; agencyId: string; floorId: string };
      const agent = materializeAgent(p.spec, p.agencyId, p.floorId);
      resolveAttention(item.id);
      return res.json({ ok: true, agent: agent.id });
    }
    resolveAttention(item.id);
    audit("operator", "kill_agent_spec", { attention: item.id });
    logActivity("system", "Operator declined a proposed agent.");
    return res.json({ ok: true });
  }

  // Prompt-improvement approval → version the agent's system prompt live.
  if ((payload as { kind?: string }).kind === "prompt_improvement") {
    const p = payload as { agentId: string; improved: string };
    if (action === "approve") {
      const agent = getAgent(p.agentId);
      if (agent) {
        audit("operator", "version_prompt", { agent: p.agentId, previous: agent.system_prompt });
        db.prepare("UPDATE agents SET system_prompt=? WHERE id=?").run(p.improved, p.agentId);
        logActivity("system", `${agent.callsign}'s system prompt updated (versioned, rollback-able).`, { agentId: p.agentId });
      }
    }
    resolveAttention(item.id);
    return res.json({ ok: true });
  }

  // Task approvals/blockers etc. fall back to generic resolve.
  if (item.task_id) {
    const t = getTask(item.task_id);
    if (t) {
      updateTask(t.id, { status: action === "approve" ? "done" : "rejected" });
    }
  }
  resolveAttention(item.id);
  for (const a of listAgents()) settleAgent(a);
  res.json({ ok: true });
});

api.post("/attention/:id/resolve", (req, res) => {
  resolveAttention(req.params.id);
  for (const a of listAgents()) settleAgent(a);
  res.json({ ok: true });
});

// ── directives + opportunities ───────────────────────────────────────────
api.post("/directives", (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "text required" });
  const dir = createDirective(text);
  res.status(201).json(dir);
});

api.get("/directives", (_req, res) => res.json(listDirectives()));
api.get("/opportunities", (_req, res) => res.json(listOpportunities()));

api.post("/opportunities/:id/approve", (req, res) => {
  const result = approveOpportunity(req.params.id, { agencyId: req.body?.agencyId, parentFloorId: req.body?.parentFloorId });
  if ("error" in result) return res.status(409).json(result);
  res.json(result);
});

api.post("/opportunities/:id/kill", (req, res) => {
  const result = killOpportunity(req.params.id);
  if ("error" in result) return res.status(404).json(result);
  res.json(result);
});

// ── factory ───────────────────────────────────────────────────────────────
api.post("/factory/agent", (req, res) => {
  const request = typeof req.body?.request === "string" ? req.body.request.trim() : "";
  if (!request) return res.status(400).json({ error: "request required" });
  const agencyId = req.body?.agencyId ?? "league";
  const floorId = req.body?.floorId ?? "floor-league";
  const spec = proposeAgent(request, { agencyId, floorId });
  res.status(201).json(spec);
});

// ── league ─────────────────────────────────────────────────────────────────
api.get("/leaderboard", (_req, res) => res.json(leaderboard()));
api.get("/league/analytics", (_req, res) => res.json(analytics()));
api.get("/league/briefing", (_req, res) => res.json(dailyBriefing()));

api.post("/league/season/settle", (_req, res) => {
  const result = settleSeason();
  if ("error" in result) return res.status(409).json(result);
  emit({ type: "stats", payload: stats() });
  res.json(result);
});

api.post("/league/whatif", (req, res) => res.json(whatIf(req.body ?? {})));

api.post("/league/contested", (req, res) => {
  const { title, thesis, market, projectedReturn } = req.body ?? {};
  if (!title || !thesis) return res.status(400).json({ error: "title, thesis required" });
  res.status(201).json(createContestedOpportunity({ title, thesis, market, projectedReturn }));
});

api.post("/league/contested/:id/referee", (req, res) => {
  const result = refereeContested(req.params.id);
  if ("error" in result) return res.status(409).json(result);
  res.json(result);
});

// ── memory / board / audit / tools ───────────────────────────────────────
api.get("/memory", (_req, res) => res.json(listMemory({ limit: 80 })));
api.get("/board/:floorId", (req, res) => res.json(listBoard(req.params.floorId, 60)));
api.get("/audit", (_req, res) => res.json(listAudit(300)));
api.get("/tools", (_req, res) => res.json(listTools()));
api.get("/activity", (req, res) => {
  const agentId = typeof req.query.agentId === "string" ? req.query.agentId : undefined;
  const limit = Math.min(Number(req.query.limit) || 80, 300);
  const rows = agentId
    ? db.prepare("SELECT * FROM activity WHERE agent_id=? ORDER BY ts DESC LIMIT ?").all(agentId, limit)
    : db.prepare("SELECT * FROM activity ORDER BY ts DESC LIMIT ?").all(limit);
  res.json(rows);
});
api.get("/ledger", (_req, res) => res.json(db.prepare("SELECT * FROM ledger ORDER BY ts DESC LIMIT 100").all()));

// ── settings + governance controls ───────────────────────────────────────
api.get("/settings", (_req, res) => res.json(settingsView()));

api.post("/settings", (req, res) => {
  const b = req.body ?? {};
  if (typeof b.model === "string" && b.model.trim()) setSetting("model", b.model.trim());
  if (typeof b.budgetCapUsd === "number") setSetting("budgetCapUsd", b.budgetCapUsd);
  if (typeof b.masterFundCapUsd === "number") setSetting("masterFundCapUsd", b.masterFundCapUsd);
  if (typeof b.drawdownPct === "number") setSetting("drawdownPct", b.drawdownPct);
  if (typeof b.maxDepth === "number") setSetting("maxDepth", b.maxDepth);
  if (typeof b.maxAgentsPerFloor === "number") setSetting("maxAgentsPerFloor", b.maxAgentsPerFloor);
  if (typeof b.maxActiveFloors === "number") setSetting("maxActiveFloors", b.maxActiveFloors);
  if (typeof b.tournamentMode === "string") setSetting("tournamentMode", b.tournamentMode);
  audit("operator", "update_settings", b);
  logActivity("system", "Settings updated by operator.");
  emit({ type: "stats", payload: stats() });
  res.json(settingsView());
});

api.post("/control/emergency-stop", (req, res) => {
  const on = req.body?.on !== false;
  setFlag("emergencyStop", on);
  if (!on) db.prepare("UPDATE attention SET status='resolved' WHERE kind='alert' AND status='open' AND title LIKE '%fund cap%'").run();
  audit("operator", "emergency_stop", { on });
  logActivity("system", on ? "🛑 EMERGENCY STOP engaged — the entire league is frozen." : "Emergency stop released.");
  for (const a of listAgents()) settleAgent(a);
  emit({ type: "stats", payload: stats() });
  res.json({ emergencyStop: on });
});

api.post("/control/pause", (req, res) => {
  const on = req.body?.on !== false;
  setFlag("paused", on);
  audit("operator", "pause", { on });
  logActivity("system", on ? "Operator paused all agents." : "Operator resumed all agents.");
  for (const a of listAgents()) settleAgent(a);
  emit({ type: "stats", payload: stats() });
  res.json({ paused: on });
});

api.post("/control/dryrun", (req, res) => {
  const on = req.body?.on !== false;
  if (!on) {
    // Arming live spend is a sensitive action: triple-confirm, default deny.
    if (!hasApiKey()) return res.status(400).json({ error: "Cannot arm live mode without ANTHROPIC_API_KEY set in .env." });
    if (Number(req.body?.confirm) < 3) {
      return res.status(428).json({ error: "Arming live spend requires triple-confirm.", needConfirm: 3 });
    }
  }
  setFlag("dryRun", on);
  audit("operator", "set_dryrun", { dryRun: on });
  logActivity("system", on ? "Switched to DRY-RUN — zero real spend." : "⚡ LIVE mode armed — real API spend is now possible (bounded by the fund cap).");
  for (const a of listAgents()) settleAgent(a);
  emit({ type: "stats", payload: stats() });
  res.json({ dryRun: on });
});

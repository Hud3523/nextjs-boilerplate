import { db } from "./db.js";
import { emit, logActivity } from "./bus.js";
import { frozen, gov } from "./governance.js";
import { fundCapOk, checkDrawdownBreakers } from "./ledger.js";
import { getAgency } from "./agencies.js";
import { listAgents, setAgentNextRun, getAgent, type AgentRow } from "./agents.js";
import { createTask, nextQueuedTask } from "./tasks.js";
import { runTask } from "./engine.js";
import { refereeContested } from "./league.js";
import { getOpportunity } from "./directives.js";

const TICK_MS = 5_000;
const running = new Set<string>();
let ticks = 0;

const minutesMs = (m: number) => m * 60 * 1000;

function agencyActive(agencyId: string): boolean {
  const a = getAgency(agencyId);
  return !a || a.status === "active";
}

/** Run the next queued task for an agent if idle. Used by routes and the tick. */
export async function processQueue(agentId: string): Promise<void> {
  if (running.has(agentId)) return;
  if (frozen()) return;
  const agent = getAgent(agentId);
  if (!agent || agent.enabled === 0) return;
  if (!agencyActive(agent.agency_id)) return;
  const task = nextQueuedTask(agentId);
  if (!task) return;
  running.add(agentId);
  try {
    await runTask(task.id);
  } finally {
    running.delete(agentId);
  }
}

function dueForCycle(agent: AgentRow): boolean {
  if (agent.next_run_at == null) {
    setAgentNextRun(agent.id, Date.now() + minutesMs(agent.interval_minutes ?? 60));
    return false;
  }
  return Date.now() >= agent.next_run_at;
}

function cyclePrompt(agent: AgentRow): { title: string; input: string } {
  switch (agent.reputation_key) {
    case "atlas":
      return { title: "Operations review", input: "Run your operations review: summarise the agency, decide what to assign next, and raise escalations. Be tight." };
    case "quartermaster":
      return { title: "Governance report", input: "Report spend vs. budget per floor and globally. Flag floors running hot and recommend Promote/Disband by ROI." };
    case "arbiter":
      return { title: "League scoring", input: "Score the leaderboard and note which doctrine is winning and why." };
    case "rogue":
      return { title: "Autonomous experiment", input: "Produce one small, self-contained, testable growth proposal. You are sandboxed with zero external reach." };
    default:
      return { title: `${agent.callsign} cycle`, input: `As ${agent.role}, drive your floor's mission forward: assess progress, coordinate via the board, and produce the next concrete deliverable.` };
  }
}

async function tick() {
  ticks++;
  if (!frozen()) {
    // Cycle + solo agents on their interval.
    for (const agent of listAgents()) {
      if (agent.trigger === "event") continue;
      if (agent.enabled === 0) continue;
      if (!agencyActive(agent.agency_id)) continue;
      if (running.has(agent.id)) continue;
      if (!dueForCycle(agent)) continue;

      // Arbiter also referees the oldest open contested opportunity.
      if (agent.reputation_key === "arbiter") refereeOldestContested();

      const spec = cyclePrompt(agent);
      const task = createTask({ agentId: agent.id, title: spec.title, input: spec.input });
      logActivity("info", `Scheduler triggered ${agent.callsign} (${agent.trigger}).`, { agentId: agent.id, taskId: task.id, floorId: agent.floor_id });
      setAgentNextRun(agent.id, Date.now() + minutesMs(agent.interval_minutes ?? 60));
      running.add(agent.id);
      runTask(task.id).finally(() => running.delete(agent.id));
    }

    // Drain queued work for every agent (event agents primarily).
    for (const agent of listAgents()) void processQueue(agent.id);

    // Governance sweeps.
    if (ticks % 3 === 0) checkDrawdownBreakers();
    fundCapOk();
  }

  emit({ type: "stats", payload: { tick: Date.now() } });
}

function refereeOldestContested() {
  const opp = db
    .prepare("SELECT id FROM opportunities WHERE contested=1 AND status='proposed' ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  if (opp && getOpportunity(opp.id)) refereeContested(opp.id);
}

export function startScheduler() {
  // Stagger the FIRST cycle run into the next ~30s so the deck looks alive on
  // launch; subsequent runs settle onto the agent's real interval.
  for (const agent of listAgents()) {
    if (agent.trigger !== "event" && agent.next_run_at == null) {
      setAgentNextRun(agent.id, Date.now() + 4_000 + Math.floor(Math.random() * 26_000));
    }
  }
  setInterval(tick, TICK_MS);
  logActivity("system", "Scheduler online. Cycle, solo, and league agents armed.");
}

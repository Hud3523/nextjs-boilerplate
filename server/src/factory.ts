import { logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { validToolKeys, getTool } from "./registry.js";
import { canSpawnFloor } from "./governance.js";
import { raiseAttention } from "./attention.js";
import { createAgency, type Doctrine, type AgencyRow } from "./agencies.js";
import { createFloor, getFloor, type FloorRow } from "./floors.js";
import { createAgent, countAgentsOnFloor } from "./agents.js";
import { getPlaybook, matchPlaybook, type Playbook } from "./playbooks.js";
import type { OpportunityRow } from "./directives.js";

/** A composed agent config the Factory produces. Tools validated against the registry. */
export interface AgentSpec {
  callsign: string;
  role: string;
  bay: string;
  trigger: "cycle" | "event";
  allowedTools: string[];
  systemPrompt: string;
}

function sanitizeTools(keys: string[]): string[] {
  const valid = new Set(validToolKeys());
  return keys.filter((k) => valid.has(k));
}

// ── Agencies ────────────────────────────────────────────────────────────────
/**
 * Spawn a competing agency: an org instance with a command-deck floor and a
 * lean operational crew shaped by its doctrine. Used by seeding, the
 * commissioner, and the evolution engine.
 */
export function spawnAgency(input: {
  name: string;
  doctrine: Doctrine;
  capitalUsd: number;
  generation?: number;
  seasonId?: string;
}): AgencyRow {
  const agency = createAgency({
    name: input.name,
    doctrine: input.doctrine,
    capitalUsd: input.capitalUsd,
    generation: input.generation,
    seasonId: input.seasonId,
  });
  const deck = createFloor({
    agencyId: agency.id,
    name: `${input.name} — Command Deck`,
    mission: `Run ${input.name} to maximise net profit within its doctrine and budget.`,
    definitionOfDone: "Outperform peers this season on the active tournament metric.",
    budgetUsd: input.capitalUsd,
    depth: 0,
  });

  const commerce = input.doctrine.contentVsCommerce >= 0.5;
  const crew: AgentSpec[] = [
    {
      callsign: "Lead",
      role: "Venture Lead",
      bay: "Bridge",
      trigger: "cycle",
      allowedTools: ["plan", "run_analysis"],
      systemPrompt: `You are the Venture Lead of ${input.name}. Doctrine: ${doctrineSummary(input.doctrine)}. Coordinate your crew via the shared board, drive net profit, and report to the fund. Never act externally.`,
    },
    {
      callsign: "Scout",
      role: "Research",
      bay: "Research Lab",
      trigger: "event",
      allowedTools: ["web_research", "run_analysis"],
      systemPrompt: `You are ${input.name}'s research scout. Find and rank opportunities that fit the doctrine: ${doctrineSummary(input.doctrine)}. Output options with thesis, market, effort, risk, projected return, confidence (0-1).`,
    },
    commerce
      ? {
          callsign: "Builder",
          role: "Commerce",
          bay: "Revenue Bay",
          trigger: "event",
          allowedTools: ["draft_listing", "run_analysis", "shopify"],
          systemPrompt: `You build review-ready commerce assets for ${input.name} (listings, pricing). Never publish.`,
        }
      : {
          callsign: "Builder",
          role: "Content",
          bay: "Media Lab",
          trigger: "event",
          allowedTools: ["draft_copy"],
          systemPrompt: `You build review-ready content for ${input.name} (scripts, copy). Offer variations. Never publish.`,
        },
    {
      callsign: "Promoter",
      role: "Marketing",
      bay: "Comms Array",
      trigger: "event",
      allowedTools: ["draft_message", commerce ? "x" : "tiktok"],
      systemPrompt: `You draft marketing & distribution for ${input.name}. Flag target platforms; nothing ships without operator approval.`,
    },
  ];
  for (const spec of crew) {
    createAgent({
      ...spec,
      floorId: deck.id,
      agencyId: agency.id,
      allowedTools: sanitizeTools(spec.allowedTools),
      reputationKey: spec.role.toLowerCase(),
    });
  }
  audit("system", "spawn_agency", { agency: agency.id, name: input.name, crew: crew.length });
  logActivity("system", `Agency ${input.name} spun up with ${crew.length} agents (capital $${input.capitalUsd.toFixed(2)}).`);
  return agency;
}

function doctrineSummary(d: Doctrine): string {
  return `risk ${pct(d.riskTolerance)}, ${d.contentVsCommerce >= 0.5 ? "commerce-led" : "content-led"}, ${d.speedVsQuality >= 0.5 ? "speed-first" : "quality-first"}, niche '${d.nicheFocus}', validation ≥ ${d.validationThreshold.toFixed(2)}, spend ${pct(d.spendAggressiveness)}`;
}
const pct = (n: number) => `${Math.round(n * 100)}%`;

// ── Agent Factory (single agent from a request) ──────────────────────────────
/** Architect drafts an agent from a plain-language request, gated for approval. */
export function proposeAgent(request: string, opts: { agencyId: string; floorId: string }) {
  const spec = draftAgentSpec(request);
  raiseAttention({
    kind: "approval",
    severity: "info",
    title: `New agent proposal: ${spec.callsign}`,
    body: `Architect drafted "${spec.callsign}" (${spec.role}) from your request. Tools: ${spec.allowedTools.join(", ") || "none"}. Approve to bring it online, or Kill.`,
    payload: { kind: "agent_spec", spec, agencyId: opts.agencyId, floorId: opts.floorId },
    agencyId: opts.agencyId,
    floorId: opts.floorId,
  });
  audit("architect", "propose_agent", { request, spec });
  logActivity("system", `Architect proposed agent "${spec.callsign}" — awaiting approval.`, { floorId: opts.floorId });
  return spec;
}

/** Heuristic drafter (the live path would call Architect's model for richer specs). */
export function draftAgentSpec(request: string): AgentSpec {
  const r = request.toLowerCase();
  const allowed: string[] = [];
  if (/research|market|keyword|competitor|find/.test(r)) allowed.push("web_research", "run_analysis");
  if (/listing|product|store|price|shop/.test(r)) allowed.push("draft_listing");
  if (/copy|script|caption|content|ad|write/.test(r)) allowed.push("draft_copy");
  if (/email|reply|outreach|message|support/.test(r)) allowed.push("draft_message");
  if (/analy|report|data/.test(r)) allowed.push("run_analysis");
  if (allowed.length === 0) allowed.push("run_analysis");
  const callsign = titleCase(request.split(/\s+/).slice(0, 2).join("")) || "Custom";
  return {
    callsign: callsign.slice(0, 14),
    role: titleCase(request.slice(0, 40)),
    bay: "Research Lab",
    trigger: "event",
    allowedTools: sanitizeTools([...new Set(allowed)]),
    systemPrompt: `You are a purpose-built agent created from this request: "${request}". Work to that goal, produce review-ready drafts, and never take external actions without operator approval.`,
  };
}

export function materializeAgent(spec: AgentSpec, agencyId: string, floorId: string) {
  const agent = createAgent({
    callsign: spec.callsign,
    role: spec.role,
    bay: spec.bay,
    trigger: spec.trigger,
    floorId,
    agencyId,
    allowedTools: sanitizeTools(spec.allowedTools),
    systemPrompt: spec.systemPrompt,
  });
  audit("operator", "materialize_agent", { agent: agent.id, spec });
  logActivity("system", `Agent "${agent.callsign}" came online (hot-loaded, no redeploy).`, { agentId: agent.id, floorId });
  return agent;
}

// ── Floor spawning (for an approved opportunity) ─────────────────────────────
/** Spawn a purpose-built floor for an approved opportunity. Enforces caps. */
export function spawnFloorForOpportunity(opp: OpportunityRow, agencyId: string, parentFloorId?: string): FloorRow | { error: string } {
  const playbook = (opp.playbook && getPlaybook(opp.playbook)) || matchPlaybook(`${opp.title} ${opp.thesis ?? ""}`);
  const roles = playbook ? playbook.roles : architectRoles(opp);
  const parent = parentFloorId ? getFloor(parentFloorId) : undefined;
  const depth = (parent?.depth ?? 0) + 1;

  const check = canSpawnFloor(depth, roles.length);
  if (!check.ok) {
    logActivity("system", `Floor spawn blocked for "${opp.title}": ${check.reason}`);
    raiseAttention({ kind: "alert", severity: "warn", title: `Spawn blocked: ${opp.title}`, body: check.reason, agencyId, dedupe: true });
    return { error: check.reason! };
  }

  const floor = createFloor({
    agencyId,
    parentFloorId: parentFloorId ?? null,
    name: opp.title,
    mission: opp.thesis || opp.title,
    definitionOfDone: opp.projected_return ? `Reach: ${opp.projected_return}` : "Deliver the opportunity's projected return.",
    budgetUsd: 3,
    depth,
    opportunityId: opp.id,
    status: "executing",
  });

  for (const role of roles) {
    createAgent({
      callsign: role.callsign,
      role: role.role,
      bay: role.bay,
      trigger: role.trigger,
      floorId: floor.id,
      agencyId,
      allowedTools: sanitizeTools(role.allowedTools),
      systemPrompt: role.systemPrompt,
      reputationKey: role.role.toLowerCase(),
    });
  }
  audit("architect", "spawn_floor", { floor: floor.id, opportunity: opp.id, playbook: playbook?.key ?? "custom", agents: roles.length });
  logActivity(
    "system",
    `Floor "${opp.title}" spawned (depth ${depth}, ${roles.length} agents${playbook ? `, playbook: ${playbook.label}` : ""}).`,
    { floorId: floor.id },
  );
  return floor;
}

/** When no playbook matches, Architect authors a generic venture crew. */
function architectRoles(opp: OpportunityRow): Playbook["roles"] {
  return [
    { callsign: "Lead", role: "Venture Lead", bay: "Bridge", trigger: "cycle", allowedTools: ["plan", "run_analysis"], systemPrompt: `You lead the venture: ${opp.title}. Coordinate the floor toward the definition-of-done and report up.` },
    { callsign: "Scout", role: "Researcher", bay: "Research Lab", trigger: "event", allowedTools: ["web_research"], systemPrompt: `You research everything needed to execute: ${opp.title}.` },
    { callsign: "Builder", role: "Builder", bay: "Revenue Bay", trigger: "event", allowedTools: ["draft_listing", "draft_copy"], systemPrompt: `You build review-ready assets for: ${opp.title}. Never publish.` },
  ];
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/[^A-Za-z0-9 ]/g, "").trim();
}

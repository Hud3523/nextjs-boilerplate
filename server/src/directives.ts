import { nanoid } from "nanoid";
import { db } from "./db.js";
import { emit, logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { raiseAttention, resolveAttention, getAttention } from "./attention.js";
import { remember } from "./memory.js";
import { matchPlaybook, PLAYBOOKS } from "./playbooks.js";
import { spawnFloorForOpportunity } from "./factory.js";
import { LEAGUE_AGENCY_ID } from "./seed-data.js";

export interface DirectiveRow {
  id: string;
  text: string;
  plan: string | null;
  status: "drafting" | "researching" | "awaiting_approval" | "spawning" | "executing" | "reporting" | "done" | "killed";
  created_at: number;
  updated_at: number;
}

export interface OpportunityRow {
  id: string;
  directive_id: string | null;
  agency_id: string | null;
  title: string;
  thesis: string | null;
  market: string | null;
  effort: string | null;
  risk: string | null;
  projected_return: string | null;
  confidence: number;
  playbook: string | null;
  contested: number;
  claimed_by: string | null;
  status: "proposed" | "approved" | "killed" | "claimed";
  floor_id: string | null;
  created_at: number;
}

export function getDirective(id: string): DirectiveRow | undefined {
  return db.prepare("SELECT * FROM directives WHERE id = ?").get(id) as DirectiveRow | undefined;
}
export function listDirectives(): DirectiveRow[] {
  return db.prepare("SELECT * FROM directives ORDER BY created_at DESC").all() as DirectiveRow[];
}
export function getOpportunity(id: string): OpportunityRow | undefined {
  return db.prepare("SELECT * FROM opportunities WHERE id = ?").get(id) as OpportunityRow | undefined;
}
export function listOpportunities(opts: { directiveId?: string; status?: string } = {}): OpportunityRow[] {
  if (opts.directiveId)
    return db.prepare("SELECT * FROM opportunities WHERE directive_id=? ORDER BY confidence DESC").all(opts.directiveId) as OpportunityRow[];
  if (opts.status)
    return db.prepare("SELECT * FROM opportunities WHERE status=? ORDER BY confidence DESC").all(opts.status) as OpportunityRow[];
  return db.prepare("SELECT * FROM opportunities ORDER BY created_at DESC").all() as OpportunityRow[];
}

function setDirectiveStatus(id: string, status: DirectiveRow["status"], plan?: string) {
  db.prepare("UPDATE directives SET status=?, plan=COALESCE(?,plan), updated_at=? WHERE id=?").run(status, plan ?? null, Date.now(), id);
  emit({ type: "directive", payload: { id, status, plan } } as never);
}

/**
 * Create a directive and run the pipeline:
 *   drafting → researching → awaiting_approval (operator approves opportunities).
 * Research is synthesized (dry-run safe); the live path would task Vega + scouts.
 */
export function createDirective(text: string): DirectiveRow {
  const now = Date.now();
  const row: DirectiveRow = { id: `dir-${nanoid(8)}`, text, plan: null, status: "drafting", created_at: now, updated_at: now };
  db.prepare("INSERT INTO directives (id, text, plan, status, created_at, updated_at) VALUES (@id,@text,@plan,@status,@created_at,@updated_at)").run(row);
  emit({ type: "directive", payload: row } as never);
  audit("operator", "create_directive", { directive: row.id, text });
  logActivity("system", `Directive received: "${text}". Commander decomposing…`);

  // Commander plan (heuristic; live mode would call Atlas's model).
  const plan = `Decompose "${text}" → scout opportunities → rank by ROI/confidence → operator approves → spawn purpose-built floor(s).`;
  setDirectiveStatus(row.id, "researching", plan);

  const opps = synthesizeOpportunities(row.id, text);
  for (const o of opps) {
    db.prepare(
      `INSERT INTO opportunities (id, directive_id, agency_id, title, thesis, market, effort, risk, projected_return, confidence, playbook, contested, claimed_by, status, floor_id, created_at)
       VALUES (@id,@directive_id,@agency_id,@title,@thesis,@market,@effort,@risk,@projected_return,@confidence,@playbook,@contested,@claimed_by,@status,@floor_id,@created_at)`,
    ).run(o);
    emit({ type: "opportunity", payload: o } as never);
    remember({ kind: "opportunity", title: o.title, content: o.thesis ?? "" });
    raiseAttention({
      kind: "opportunity",
      severity: "info",
      title: `Opportunity: ${o.title}`,
      body: `${o.thesis}\nMarket: ${o.market} · Effort: ${o.effort} · Risk: ${o.risk} · Projected: ${o.projected_return} · Confidence ${(o.confidence * 100).toFixed(0)}%`,
      payload: { kind: "opportunity", opportunityId: o.id, directiveId: row.id },
    });
  }
  setDirectiveStatus(row.id, "awaiting_approval");
  logActivity("system", `Vega returned ${opps.length} ranked opportunities for "${text}". Awaiting your approve/kill.`);
  return getDirective(row.id)!;
}

function synthesizeOpportunities(directiveId: string, text: string): OpportunityRow[] {
  const now = Date.now();
  // Pick the 3 most relevant playbooks as opportunity seeds.
  const ranked = [...PLAYBOOKS]
    .map((pb) => ({ pb, score: pb.match.reduce((n, kw) => (text.toLowerCase().includes(kw) ? n + 1 : n), 0) }))
    .sort((a, b) => b.score - a.score);
  const picks = ranked.slice(0, 3);
  const efforts = ["Low", "Medium", "High"];
  const risks = ["Low", "Medium", "High"];
  return picks.map(({ pb }, i) => {
    const conf = Math.round((0.5 + Math.random() * 0.45) * 100) / 100;
    return {
      id: `opp-${nanoid(8)}`,
      directive_id: directiveId,
      agency_id: null,
      title: `${pb.label} for "${text.slice(0, 40)}"`,
      thesis: `Apply the ${pb.label} blueprint to capture this goal. ${pb.description}`,
      market: pb.match[0] ?? "general",
      effort: efforts[i % 3],
      risk: risks[(i + 1) % 3],
      projected_return: `$${(200 + Math.round(Math.random() * 1800))}/mo`,
      confidence: conf,
      playbook: pb.key,
      contested: 0,
      claimed_by: null,
      status: "proposed",
      floor_id: null,
      created_at: now + i,
    };
  });
}

/** Operator approves an opportunity → spawn a purpose-built floor for it. */
export function approveOpportunity(id: string, opts: { agencyId?: string; parentFloorId?: string } = {}) {
  const opp = getOpportunity(id);
  if (!opp) return { error: "Unknown opportunity" };
  if (opp.status !== "proposed") return { error: `Opportunity already ${opp.status}` };
  const agencyId = opts.agencyId ?? opp.agency_id ?? LEAGUE_AGENCY_ID;
  const result = spawnFloorForOpportunity(opp, agencyId, opts.parentFloorId);
  if ("error" in result) return result;
  db.prepare("UPDATE opportunities SET status='approved', agency_id=?, floor_id=? WHERE id=?").run(agencyId, result.id, id);
  emit({ type: "opportunity", payload: { id, status: "approved", floor_id: result.id } } as never);
  resolveOppAttention(id);
  audit("operator", "approve_opportunity", { opportunity: id, floor: result.id, agency: agencyId });
  remember({ kind: "decision", title: `Approved: ${opp.title}`, content: `Spawned floor ${result.id} under ${agencyId}.` });
  if (opp.directive_id) setDirectiveStatus(opp.directive_id, "executing");
  logActivity("system", `Opportunity "${opp.title}" approved → floor spawned.`, { floorId: result.id });
  return { floor: result };
}

export function killOpportunity(id: string) {
  const opp = getOpportunity(id);
  if (!opp) return { error: "Unknown opportunity" };
  db.prepare("UPDATE opportunities SET status='killed' WHERE id=?").run(id);
  emit({ type: "opportunity", payload: { id, status: "killed" } } as never);
  resolveOppAttention(id);
  audit("operator", "kill_opportunity", { opportunity: id });
  remember({ kind: "decision", title: `Killed: ${opp.title}`, content: `Operator declined this opportunity.` });
  logActivity("system", `Opportunity "${opp.title}" killed by operator.`);
  return { ok: true };
}

function resolveOppAttention(opportunityId: string) {
  const rows = db.prepare("SELECT id, payload FROM attention WHERE status='open' AND kind='opportunity'").all() as {
    id: string;
    payload: string | null;
  }[];
  for (const r of rows) {
    try {
      const p = r.payload ? JSON.parse(r.payload) : {};
      if (p.opportunityId === opportunityId) resolveAttention(r.id);
    } catch {
      /* ignore */
    }
  }
}

export { getAttention };

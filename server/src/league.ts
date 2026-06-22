import { nanoid } from "nanoid";
import { db } from "./db.js";
import { logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { raiseAttention } from "./attention.js";
import { remember } from "./memory.js";
import { gov } from "./governance.js";
import {
  listAgencies,
  getAgency,
  updateAgency,
  agencyPnl,
  agencyEquity,
  parseDoctrine,
  liquidateAgency,
  type Doctrine,
} from "./agencies.js";
import { listAgents } from "./agents.js";
import { bumpReputation, listReputation } from "./reputation.js";
import { spawnAgency, spawnFloorForOpportunity } from "./factory.js";
import { currentSeason, createSeason, settleSeasonRow, seasonPnl } from "./seasons.js";
import { getOpportunity, type OpportunityRow } from "./directives.js";

// ── Leaderboard ──────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  agencyId: string;
  name: string;
  doctrine: Doctrine;
  capital: number;
  equity: number;
  status: string;
  spend: number;
  revenue: number;
  net: number;
  roi: number | null;
  score: number;
  rank: number;
}

export function leaderboard(): LeaderboardEntry[] {
  const season = currentSeason();
  const mode = gov.tournamentMode();
  const rows: LeaderboardEntry[] = listAgencies().map((a) => {
    const pnl = season ? seasonPnl(a.id, season.id) : agencyPnl(a.id);
    const equity = agencyEquity(a.id);
    const score =
      mode === "efficiency" ? (pnl.roi ?? -1) :
      mode === "survival" ? equity :
      pnl.net; // profit / niche
    return {
      agencyId: a.id, name: a.name, doctrine: parseDoctrine(a),
      capital: a.capital_usd, equity, status: a.status,
      spend: pnl.spend, revenue: pnl.revenue, net: pnl.net, roi: pnl.roi,
      score, rank: 0,
    };
  });
  rows.sort((x, y) => y.score - x.score);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

// ── Contested opportunity pool + Arbiter ─────────────────────────────────────
export function createContestedOpportunity(input: { title: string; thesis: string; market?: string; projectedReturn?: string }): OpportunityRow {
  const o = {
    id: `opp-${nanoid(8)}`,
    directive_id: null,
    agency_id: null,
    title: input.title,
    thesis: input.thesis,
    market: input.market ?? "general",
    effort: "Medium",
    risk: "Medium",
    projected_return: input.projectedReturn ?? `$${500 + Math.round(Math.random() * 2000)}/mo`,
    confidence: 0.6,
    playbook: null,
    contested: 1,
    claimed_by: null,
    status: "proposed",
    floor_id: null,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO opportunities (id, directive_id, agency_id, title, thesis, market, effort, risk, projected_return, confidence, playbook, contested, claimed_by, status, floor_id, created_at)
     VALUES (@id,@directive_id,@agency_id,@title,@thesis,@market,@effort,@risk,@projected_return,@confidence,@playbook,@contested,@claimed_by,@status,@floor_id,@created_at)`,
  ).run(o);
  logActivity("system", `Contested opportunity entered the pool: "${input.title}". Agencies may race to claim it.`);
  return o as OpportunityRow;
}

/**
 * Arbiter refereeing: the active agency whose doctrine best fits the
 * opportunity (highest fit × validation) claims it. A floor is spawned for the
 * winner. Mirrors "first agency to validate/execute claims it."
 */
export function refereeContested(opportunityId: string) {
  const opp = getOpportunity(opportunityId);
  if (!opp || opp.contested !== 1 || opp.status !== "proposed") return { error: "Not an open contested opportunity" };
  const contenders = listAgencies().filter((a) => a.status === "active");
  if (!contenders.length) return { error: "No active agencies to compete" };
  let best: { id: string; name: string; fit: number } | undefined;
  for (const a of contenders) {
    const d = parseDoctrine(a);
    const commerceBias = /shop|product|store|sell|commerce|ecom/.test(`${opp.title} ${opp.thesis}`.toLowerCase()) ? d.contentVsCommerce : 1 - d.contentVsCommerce;
    const fit = opp.confidence * (0.5 + 0.5 * commerceBias) * (0.6 + 0.4 * d.spendAggressiveness) * (0.7 + Math.random() * 0.6);
    if (!best || fit > best.fit) best = { id: a.id, name: a.name, fit };
  }
  if (!best) return { error: "No winner" };
  const result = spawnFloorForOpportunity(opp, best.id);
  if ("error" in result) return result;
  db.prepare("UPDATE opportunities SET status='claimed', claimed_by=?, agency_id=?, floor_id=? WHERE id=?").run(best.id, best.id, result.id, opportunityId);
  audit("arbiter", "award_contested", { opportunity: opportunityId, winner: best.id });
  logActivity("system", `Arbiter awarded "${opp.title}" to ${best.name} (best doctrine fit). Floor spawned.`, { floorId: result.id });
  raiseAttention({ kind: "alert", severity: "info", title: `Arbiter: ${best.name} won "${opp.title}"`, body: `Contested opportunity claimed; a floor was spun up to execute it.`, agencyId: best.id });
  return { winner: best.id, floor: result };
}

// ── Season settlement + capital reallocation + evolution ─────────────────────
export function settleSeason() {
  const season = currentSeason();
  if (!season) return { error: "No running season" };
  const board = leaderboard();
  if (!board.length) return { error: "No agencies" };

  // Reward winners, cut losers (capital flows to what works).
  const winner = board[0];
  const loser = board[board.length - 1];
  for (const e of board) {
    const a = getAgency(e.agencyId)!;
    let next = a.capital_usd;
    if (e.rank === 1) next = a.capital_usd * 1.5;
    else if (e.rank === board.length && board.length > 1) next = a.capital_usd * 0.5;
    updateAgency(e.agencyId, { capital_usd: Math.round(next * 100) / 100 });
    if (e.rank === 1) for (const ag of listAgents({ agencyId: e.agencyId })) bumpReputation(ag.reputation_key ?? ag.id, 3, { win: true });
  }
  if (board.length > 2 && loser.equity <= 0) liquidateAgency(loser.agencyId, "last place with negative equity at settlement");

  const recap =
    `${season.name} settled (${season.mode}). Winner: ${winner.name} (net $${winner.net.toFixed(2)}, ROI ${winner.roi != null ? (winner.roi * 100).toFixed(0) + "%" : "n/a"}). ` +
    `Doctrine that won: ${doctrineLabel(winner.doctrine)}. Capital reallocated toward winners.`;
  remember({ kind: "lesson", title: `${season.name} recap`, content: recap });
  audit("arbiter", "settle_season", { season: season.id, winner: winner.agencyId, board: board.map((b) => ({ id: b.agencyId, net: b.net, rank: b.rank })) });
  logActivity("system", `🏁 ${recap}`);
  raiseAttention({ kind: "alert", severity: "info", title: `${season.name} settled — ${winner.name} won`, body: recap });
  settleSeasonRow(season.id);

  // Evolution: clone + mutate the top doctrines into next season's agencies.
  const survivors = board.filter((b) => getAgency(b.agencyId)?.status !== "liquidated").slice(0, 2);
  const newSeason = createSeason({ mode: season.mode as never, number: season.number + 1 });
  for (const s of survivors) {
    const mutated = mutateDoctrine(s.doctrine);
    spawnAgency({
      name: `${s.name.split(" ")[0]}-G${(getAgency(s.agencyId)?.generation ?? 1) + 1}`,
      doctrine: mutated,
      capitalUsd: Math.max(2, getAgency(s.agencyId)!.capital_usd),
      generation: (getAgency(s.agencyId)?.generation ?? 1) + 1,
      seasonId: newSeason.id,
    });
  }
  logActivity("system", `🧬 Evolution: top doctrines cloned + mutated into ${newSeason.name}.`);
  return { recap, winner: winner.agencyId, newSeason: newSeason.id };
}

function mutateDoctrine(d: Doctrine): Doctrine {
  const jitter = (v: number) => Math.min(1, Math.max(0, Math.round((v + (Math.random() - 0.5) * 0.3) * 100) / 100));
  return {
    riskTolerance: jitter(d.riskTolerance),
    nicheFocus: d.nicheFocus,
    speedVsQuality: jitter(d.speedVsQuality),
    contentVsCommerce: jitter(d.contentVsCommerce),
    validationThreshold: jitter(d.validationThreshold),
    spendAggressiveness: jitter(d.spendAggressiveness),
  };
}

function doctrineLabel(d: Doctrine): string {
  return `${d.contentVsCommerce >= 0.5 ? "commerce" : "content"}-led, ${d.riskTolerance >= 0.5 ? "high" : "low"}-risk, ${d.speedVsQuality >= 0.5 ? "speed" : "quality"}-first`;
}

// ── What-if simulation (zero real spend) ─────────────────────────────────────
export function whatIf(scenario: { agencyId?: string; budgetMultiplier?: number; addContentAgency?: boolean; seasonShorten?: boolean }) {
  const projected = leaderboard().map((e) => {
    let net = e.net;
    if (scenario.agencyId === e.agencyId && scenario.budgetMultiplier) {
      // more budget → more attempts → roughly scales net by sqrt(multiplier)
      net = e.net * Math.sqrt(scenario.budgetMultiplier);
    }
    return { name: e.name, currentNet: e.net, projectedNet: Math.round(net * 100) / 100 };
  });
  if (scenario.addContentAgency)
    projected.push({ name: "(hypothetical) Content-led", currentNet: 0, projectedNet: Math.round((100 + Math.random() * 400) * 100) / 100 });
  return { scenario, projected, note: "Heuristic projection — no real spend, no state changes." };
}

// ── Analytics + daily briefing ───────────────────────────────────────────────
export function analytics() {
  const byDoctrine = leaderboard().map((e) => ({
    name: e.name,
    doctrine: doctrineLabel(e.doctrine),
    roi: e.roi,
    net: e.net,
    spend: e.spend,
  }));
  const tasksDone = (db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status='done'").get() as { c: number }).c;
  const tasksTotal = (db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c;
  const costPerOutcome = (() => {
    const spend = (db.prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM ledger WHERE type='spend'").get() as { s: number }).s;
    return tasksDone ? Math.round((spend / tasksDone) * 1000) / 1000 : null;
  })();
  return {
    byDoctrine,
    tasksDone,
    tasksTotal,
    winRate: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
    costPerOutcome,
    topAgents: listReputation().slice(0, 5),
  };
}

export function dailyBriefing() {
  const pendingApprovals = (db.prepare("SELECT COUNT(*) AS c FROM attention WHERE status='open' AND kind IN ('approval','opportunity')").get() as { c: number }).c;
  const blocked = (db.prepare("SELECT COUNT(*) AS c FROM attention WHERE status='open' AND kind='blocker'").get() as { c: number }).c;
  const board = leaderboard();
  const topOpps = (db.prepare("SELECT title, confidence FROM opportunities WHERE status='proposed' ORDER BY confidence DESC LIMIT 3").all()) as {
    title: string;
    confidence: number;
  }[];
  return {
    generatedAt: Date.now(),
    season: currentSeason()?.name ?? null,
    leaderboard: board.map((b) => ({ name: b.name, net: b.net, roi: b.roi, rank: b.rank, status: b.status })),
    consolidatedNet: board.reduce((n, b) => n + b.net, 0),
    pendingApprovals,
    blocked,
    topOpportunities: topOpps,
  };
}

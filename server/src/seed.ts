import { db, seedSettings } from "./db.js";
import { config } from "./config.js";
import { logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { createAgency, type Doctrine } from "./agencies.js";
import { createFloor } from "./floors.js";
import { createAgent } from "./agents.js";
import { createTask } from "./tasks.js";
import { createSeason } from "./seasons.js";
import { recordLedger } from "./ledger.js";
import { remember } from "./memory.js";
import { spawnAgency } from "./factory.js";
import { createDirective } from "./directives.js";
import { createContestedOpportunity } from "./league.js";
import { seedGoldenTests } from "./academy.js";
import { FLOOR1_CREW, FLOOR1_ID, LEAGUE_AGENCY_ID } from "./seed-data.js";

/** Idempotent: only seeds when the DB is empty. */
export function seedIfEmpty() {
  seedSettings();
  seedGoldenTests();
  const existing = db.prepare("SELECT 1 FROM agencies WHERE id = ?").get(LEAGUE_AGENCY_ID);
  if (existing) return;

  logActivity("system", "Cold boot — seeding the fund, HQ crew, and competing agencies…");

  // 1) Season 1.
  const season = createSeason({ mode: "profit" });

  // 2) League HQ (the fund's own staff) — Command Deck.
  const hqDoctrine: Doctrine = {
    riskTolerance: 0.5, nicheFocus: "governance", speedVsQuality: 0.4,
    contentVsCommerce: 0.5, validationThreshold: 0.6, spendAggressiveness: 0.3,
  };
  createAgency({ id: LEAGUE_AGENCY_ID, name: "Fund HQ", doctrine: hqDoctrine, capitalUsd: 5, isLeague: true, seasonId: season.id });
  const deck = createFloor({
    id: FLOOR1_ID, agencyId: LEAGUE_AGENCY_ID, name: "Command Deck",
    mission: "Run the fund: decompose directives, govern budgets, referee the league, keep humans in the loop.",
    definitionOfDone: "Permanent infrastructure.", budgetUsd: 5, depth: 0, permanent: true,
  });
  for (const a of FLOOR1_CREW) {
    createAgent({
      id: a.id, callsign: a.callsign, role: a.role, bay: a.bay, trigger: a.trigger,
      intervalMinutes: a.intervalMinutes, floorId: deck.id, agencyId: LEAGUE_AGENCY_ID,
      systemPrompt: a.systemPrompt, allowedTools: a.allowedTools, sandboxed: a.sandboxed,
      permanent: true, reputationKey: a.id,
    });
  }

  // Going real? SEED_DEMO=false stops here — clean books, HQ crew only.
  if (!config.defaults.seedDemo) {
    audit("system", "seed", { mode: "clean", season: season.id });
    logActivity("system", "Clean seed: Fund HQ crew + season only. Create your own agencies/agents from the Control Room and + DIRECTIVE.");
    return;
  }

  // 3) Competing agencies — distinct doctrines (the league).
  const slice = Math.max(3, Math.floor((config.defaults.masterFundCapUsd - 5) / 3));
  spawnAgency({
    name: "Vanguard", capitalUsd: slice, seasonId: season.id,
    doctrine: { riskTolerance: 0.8, nicheFocus: "ecommerce", speedVsQuality: 0.7, contentVsCommerce: 0.85, validationThreshold: 0.4, spendAggressiveness: 0.8 },
  });
  spawnAgency({
    name: "Lumen", capitalUsd: slice, seasonId: season.id,
    doctrine: { riskTolerance: 0.4, nicheFocus: "content", speedVsQuality: 0.3, contentVsCommerce: 0.15, validationThreshold: 0.7, spendAggressiveness: 0.4 },
  });
  spawnAgency({
    name: "Prospect", capitalUsd: slice, seasonId: season.id,
    doctrine: { riskTolerance: 0.5, nicheFocus: "digital products", speedVsQuality: 0.5, contentVsCommerce: 0.5, validationThreshold: 0.55, spendAggressiveness: 0.5 },
  });

  // 4) A little simulated P&L so the leaderboard has shape on first load.
  const agencies = db.prepare("SELECT id, name FROM agencies WHERE is_league = 0").all() as { id: string; name: string }[];
  for (const a of agencies) {
    const spend = 0.4 + Math.random() * 0.8;
    const revenue = spend * (0.6 + Math.random() * 1.6); // some win, some lose
    recordLedger("spend", round(spend), { description: `${a.name}: season warm-up`, agencyId: a.id, simulated: true });
    recordLedger("revenue", round(revenue), { description: `${a.name}: early traction (simulated)`, agencyId: a.id, simulated: true });
  }
  // Cosmetic seed revenue at the fund level.
  recordLedger("revenue", config.defaults.seedRevenueUsd, { description: "Opening simulated treasury", simulated: true });

  // 4b) Starter tasks for a few agency doers so drafts + approvals appear fast.
  for (const a of agencies) {
    const scout = db.prepare("SELECT id, callsign FROM agents WHERE agency_id=? AND lower(role) LIKE '%research%' LIMIT 1").get(a.id) as { id: string; callsign: string } | undefined;
    const builder = db.prepare("SELECT id FROM agents WHERE agency_id=? AND (lower(role) LIKE '%commerce%' OR lower(role) LIKE '%content%') LIMIT 1").get(a.id) as { id: string } | undefined;
    if (scout) createTask({ agentId: scout.id, title: "Scout opening opportunities", input: `Find the three best opportunities for ${a.name} that fit our doctrine. Rank by projected ROI and confidence.` });
    if (builder) createTask({ agentId: builder.id, title: "Draft a first revenue asset", input: `Draft a review-ready first asset to test ${a.name}'s top opportunity. Keep it concrete.` });
  }

  // 5) Lessons + a demo directive (dry-run) so the spawn flow is visible.
  remember({ kind: "lesson", title: "Validate before you build", content: "Opportunities below the doctrine's validation threshold burned budget last season. Gate spend on confidence." });
  createDirective("find ways to make me money");
  createContestedOpportunity({
    title: "Viral UGC clip series",
    thesis: "Short-form UGC clips for a trending product category; cheap to test, fast to scale if it lands.",
    market: "content",
  });

  audit("system", "seed", { agencies: agencies.length + 1, season: season.id });
  logActivity("system", "Seed complete. League is armed in DRY-RUN — arm live mode in the control room when ready.");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Allow `npm run seed` to (re)seed an empty DB explicitly, without seeding
// again when this module is imported by the server.
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedIfEmpty();
}

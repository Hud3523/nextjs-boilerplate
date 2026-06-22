# 🛰️ MISSION CONTROL — Autonomous AI Agency Command Center

A gamified, space‑ship "mission control" that orchestrates a crew of Claude‑powered
agents doing real business grunt‑work — research, drafts, listings, content,
analysis — while **you stay in the loop and approve everything**. It grows from a
single ship into a **self‑expanding org** (directives → opportunities → spawned
floors) and a **league of competing agencies** racing on net profit.

> **Honest by design.** Nothing publishes externally without your approval. The
> whole system defaults to **dry‑run** (zero real spend). Real money and
> simulated revenue are tracked separately so the headline number stays honest.

---

## Quick start

```bash
cp .env.example .env        # optional: add ANTHROPIC_API_KEY to run real models
npm install
npm run dev                 # boots backend (:4000) + frontend (:5173)
```

Open **http://localhost:5173**. On first run the DB is seeded so the dashboard is
alive immediately — a Fund HQ crew, three competing agencies, a demo directive
with ranked opportunities awaiting your approval, and starter drafts in the
ATTENTION queue — all in **dry‑run**.

- **No API key?** Everything still runs in dry‑run with clearly‑labelled
  simulated output and `$0` spend.
- **With a key:** open the **Control Room** and *Arm LIVE mode* (triple‑confirm)
  to let agents call `claude-opus-4-8`. Spend is bounded by the master fund cap.

Production build: `npm run build && npm start` (Express then serves the built client).

---

## What you can do

- **Watch the loop:** agents pick up tasks → call Claude (or simulate) → output
  is streamed to the feed → **Sentinel** grades quality → **Aegis** safety‑checks
  external‑facing work → it lands in the **ATTENTION** inbox for you to
  **Approve / Edit / Kill**.
- **Forge (the MVP agent):** give it a product → it returns a **validated JSON
  listing** `{title, description, tags[]}`. Invalid output is never actioned.
- **Training Academy:** open any agent → run a **Training Run** against golden
  test cases → see a **letter grade + report‑card sparkline**. Weak grades
  propose a refined prompt for your approval (versioned, rollback‑able).
- **Test Lab:** a **feasibility check** ("would this even work?") before you spend.
- **Directives → Floors:** issue a goal ("find me money") → Commander decomposes
  it → ranked **opportunities** appear in ATTENTION → approve one → **Architect
  spawns a purpose‑built floor** of agents (hot‑loaded, no redeploy).
- **The League:** the **Fleet** view ranks competing agencies by net P&L; the
  **Arbiter** referees contested opportunities and runs season settlement;
  winners get more capital, losers are cut, and top doctrines are mutated into
  the next season.

---

## Architecture

```
client/   Vite + React + TS + Tailwind v4 + Framer Motion   (the dashboard)
server/   Node + Express + TS + better-sqlite3              (the engine)
data/     SQLite database (created on first run)
```

- **Realtime:** the server pushes every state change over **SSE** (`/events`);
  the client holds one connection and debounce‑refetches `/api/state`.
- **Agents & floors are DATA, hot‑loaded at runtime.** Creating either writes a
  SQLite row; the scheduler reads rows every tick, so a new agent/floor is live
  immediately — no code change, no redeploy. `seed-data.ts` seeds Floor 1 (the
  Command Deck) only.
- **Hierarchy:** **Fund → Agency → Floor (tree) → Agent.**
- **Tool Registry** (`registry.ts`): the vetted capabilities agents can be
  granted. The Factory composes agents only from these. External integrations
  (Shopify, TikTok, …) ship **stubbed** with `configured: false` and surface as
  blockers — they never fake a real action.
- **Ledger** (`ledger.ts`): real API spend = tokens × per‑model price; simulated
  revenue tracked separately. Enforces the master fund cap, per‑agency drawdown
  breakers, and the low‑credit warning.
- **Governance** (`governance.ts`): dry‑run, emergency stop, pause, recursion
  caps (depth / agents‑per‑floor / active‑floors) — low‑level gates, not
  policies an agent can reason around.

Key server modules: `engine.ts` (execution + critic + safety + grading),
`scheduler.ts` (cycle/event/solo triggers), `factory.ts` (Architect — spawns
agents/floors/agencies), `directives.ts` (directive→opportunity pipeline),
`league.ts` (leaderboard / Arbiter / settlement / evolution / analytics),
`academy.ts` (golden tests + grading + report cards), `seed.ts` (first‑run data).

---

## Guardrails (always on)

- **Dry‑run by default**; live mode requires an API key **and** a triple‑confirm.
- **Nothing external publishes without approval** — every draft hits the inbox.
- **Master fund cap + per‑agency drawdown breakers** auto‑pause/liquidate losers.
- **Global EMERGENCY STOP** freezes every floor and agent instantly.
- **Bounded spawning** — depth/breadth/active‑floor caps; every floor has a
  budget and a definition‑of‑done, so the org can always terminate.
- **Validated outputs only** — schema‑checked JSON; invalid output is never acted on.
- **Real vs. simulated money are never blended.**
- Every spawn, decision, and approval is written to an **audit log** (`/api/audit`).

---

## How‑to

### Add an agent
Two ways:
1. **From the UI:** top bar → **+ DIRECTIVE → New Agent**, describe it in plain
   language → Architect drafts a config from the Tool Registry → approve it in
   ATTENTION → it's hot‑loaded live.
2. **Seed it permanently:** add an entry to `FLOOR1_CREW` in
   `server/src/seed-data.ts` (id, callsign, role, bay, trigger, `allowedTools`,
   `systemPrompt`). Delete `data/mission-control.db` to re‑seed.

### Add a golden test case (Training Academy)
- **From the UI:** open the agent → Test Lab (or `POST /api/agents/:id/tests`).
- **In code:** add an `addTestCase(agentKey, name, input, rubric)` call in
  `seedGoldenTests()` (`server/src/academy.ts`). Grading combines deterministic
  checks (schema, field quality) with a heuristic/judge score.

### Wire a real integration (swap a stub for a real API)
In `server/src/registry.ts`, find the stubbed tool (e.g. `shopify`):
1. Implement its `publish()` with the real SDK/HTTP call.
2. Set `configured: true` once credentials exist (read from `.env` / a secret
   store — never log them).
3. The approval gate is unchanged: operator approval is what authorizes
   `publish()` to run. Everything else (queues, ledger, blockers) just works.

### Arm real actions
Set `ANTHROPIC_API_KEY` in `.env`, then in the **Control Room** click *Arm LIVE
mode* and complete the triple‑confirm. Real spend is bounded by
`MASTER_FUND_CAP_USD`; hitting it engages EMERGENCY STOP automatically.

---

## Configuration (`.env`)

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables real models. Absent → dry‑run only. |
| `MODEL` | Default model (`claude-opus-4-8`). |
| `MASTER_FUND_CAP_USD` | Real‑spend ceiling across all agencies (AUM). |
| `DRAWDOWN_PCT` | Per‑agency drawdown breaker. |
| `MAX_FLOOR_DEPTH` / `MAX_AGENTS_PER_FLOOR` / `MAX_ACTIVE_FLOORS` | Recursion caps. |
| `BUDGET_CAP_USD`, `SEED_REVENUE_USD`, `PORT` | Misc. |

---

## Status & honest scope

This is a working **vertical slice across all phases** of the master brief, built
dry‑run‑first:

- **Solid:** the core execution loop (Forge validated‑JSON listings, streaming,
  cost), Approve/Edit/Kill inbox, Sentinel QA + bounded retry, Aegis safety gate,
  Training Academy (golden tests, grades, prompt‑improvement proposals),
  Test Lab feasibility, agents/floors/agencies as hot‑loaded data, the
  directive→opportunity→floor pipeline, the Factory, the League
  (leaderboard / Arbiter / contested pool / settlement / doctrine evolution),
  full governance (fund cap, drawdown breakers, emergency stop, recursion caps),
  memory/lessons, shared board, audit log, and a neon realtime dashboard.
- **Lean / heuristic for now (clearly marked in code):** the prompt‑improvement
  refiner, what‑if simulation, and strategy mutation are functional but simple;
  the Claude *judge* path activates in live mode while dry‑run uses deterministic
  grading. These are honest stand‑ins, not fake data.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

# 🛰️ MISSION CONTROL — a Dashboard for Hermes Agent

A neon space-ship control panel that sits **on top of your local [Hermes Agent](https://hermes-agent.nousresearch.com)** (Nous Research). Hermes is the engine — it owns the agents, memory, scheduling, sub-agents, and tools, and runs models through **OpenRouter**. This dashboard is the **interface**: see what Hermes is doing, give its agents jobs, and approve the results. It does **not** reimplement the agent engine.

> Human-in-the-loop by default. **Dry-run** until you explicitly arm it; every result is yours to **Approve / Edit / Kill**; a budget cap and global **EMERGENCY STOP** are always on.

---

## Quick start

```bash
cp .env.example .env        # add OPENROUTER_API_KEY; leave HERMES_MODE=mock to try it
npm install
npm run dev                 # backend :4000 + dashboard :5173
```

Open **http://localhost:5173**. With `HERMES_MODE=mock` it runs immediately against sample agents so you can see the loop. Point it at your real Hermes when ready (below).

---

## Phase 1 — confirm the Hermes connection first

The dashboard talks to Hermes through one adapter (`server/src/hermes/index.ts`). Prove the round-trip before anything else:

```bash
npm run hermes:check -w server          # reads status + agents, sends one instruction, prints the result
```

It uses `HERMES_MODE`. With `mock` it always works; with `http`/`cli` it exercises your real install.

### Pointing it at your real Hermes
Set `HERMES_MODE` in `.env`:
- **`http`** — Hermes exposes a local HTTP gateway. Set `HERMES_BASE_URL` and confirm the endpoint paths in `server/src/hermes/index.ts` (`CONFIG.endpoints`) match your Hermes docs (health / list agents / send-instruction / activity).
- **`cli`** — no HTTP API. The adapter shells out to `HERMES_CLI` (`hermes agents --json`, `hermes run --agent X "…"`). Adjust the verbs in `CliHermes` to match your CLI.

All transport details live in that one file, so wiring your install is a localized change — the rest of the dashboard is unaffected.

---

## The core loop

1. **Crew roster** (left) + **cutaway ship** (center) show Hermes's agents/sub-agents with live status (idle / working / blocked).
2. Click an agent → **Assign a job**: a text box that routes your instruction to Hermes via the adapter.
3. The result **streams live** to the activity feed, then lands in the **Approval inbox** (right) as `needs_review`.
4. **Approve / Edit / Kill** every result. In **dry-run** approving just files it; once you **Arm** (triple-confirm), approved actions can run for real.
5. **Cost meter** (top bar) shows running spend vs. your **budget cap** (from each task's OpenRouter cost; optional live credit balance via your key).
6. **⌘K command palette:** `tell Scout research phone cases`, open an agent, arm, or e-stop.

---

## Guardrails (enforced in the dashboard's action layer)

- **Two hard rules:** nothing that spends money or shares personal info executes without your explicit per-action approval (triple-confirm to arm; default DENY).
- **Dry-run by default** — nothing acts on the outside world until you arm it.
- **Budget cap** displayed; halts execution when hit.
- **Untrusted content** is never auto-executed — you approve every result.
- **Operator login** (`DASHBOARD_PASSWORD`) before exposing it publicly.

---

## Architecture

```
client/   Vite + React + TS + Tailwind + Framer Motion  — the dashboard UI
server/   Node + Express + TS                            — Hermes adapter + dashboard API
  src/hermes/   the ONLY connection to Hermes (mock | http | cli)
data/     SQLite — the dashboard's OWN state only (approval queue, settings). NOT agent memory.
```

Realtime is **SSE** (`/events`). The dashboard's SQLite holds tasks + settings; **agent memory/scheduling stays in Hermes.**

### How to…
- **Add/see an agent:** agents come from Hermes — they appear automatically in the roster and as ship bays. To theme a bay's character/colour, edit the `CHARS`/`TOOLS`/`TINTS` arrays in `client/src/components/ShipView.tsx`.
- **Set the OpenRouter key:** `OPENROUTER_API_KEY` in `.env` (Hermes also needs it; the dashboard uses it only to read spend/credits).
- **Arm real actions:** top bar **⚡ Arm** → triple-confirm → `LIVE`. Return to dry-run any time.

> **Fleet view (later, optional):** running multiple Hermes instances as competing "agencies" needs a separate orchestrator script — the adapter is the clean seam for it; it's intentionally not built yet.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

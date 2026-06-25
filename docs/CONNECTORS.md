# Connecting the Agents — Integration Guide

This document explains how each linked repository attaches to the AI agents in
HERMES OMEGA INFINITY, what credentials and infrastructure each one needs, and
which **additional integrations** the agents will need to actually research,
create, publish, and sell.

> **Core rule:** nothing is hardcoded. Every external capability is registered
> as a **connector** in the Tool Manager (`app/lib/connectors.ts`). Agents
> request tools through the Tool Manager; they never call services directly and
> they never see secrets they don't need.

---

## How connectors attach (two shapes)

1. **In-process module** — a Node/TypeScript adapter that runs inside this
   app's server side (Next.js route handlers / server actions). Best for plain
   API/SDK calls. Example: TradingView, Polymarket, YouTube, Etsy, Stripe.
2. **External service** — a separate long-running process the app talks to over
   HTTP. Best for runtimes that need their own environment (Python, browsers,
   GPUs). Example: OpenClaw, Hermes.

The connector registry already encodes which shape each integration uses
(`integration` field) and what credentials it needs (`requiredCredentials`).

---

## The four linked repos

### 1. TradingView — `Mathieu2301/Tradingview-API`
- **Role:** realtime market prices + indicator values for the Research Lab
  (demand signals, timing).
- **Shape:** in-process Node module (`npm i @mathieuc/tradingview`).
- **Auth:** unofficial — uses a TradingView **session token + signature** from
  a logged-in account. No official API. Store both as secrets.
- **Data flow:** `Scout` (Research) → Tool Manager → TradingView connector →
  normalized quotes/indicators → agent memory + Analytics.
- **Caveats:** unofficial API, rate-limit politely, may break on TV changes.

### 2. Polymarket — `bitquery/polymarket-api`
- **Role:** prediction-market odds + sentiment for demand validation.
- **Shape:** in-process Node SDK.
- **Auth:** **Bitquery OAuth token** (required). Create a Bitquery account, get
  the token, store as a secret.
- **Data flow:** `Scout` → Tool Manager → Polymarket connector → market odds /
  resolved outcomes → Research summaries.

### 3. OpenClaw — `openclaw/openclaw`
- **Role:** tool execution, **browser automation**, and workflow running. This
  is how agents do things that have **no public API** (e.g. Fiverr listings),
  upload files, fill forms, and run repetitive flows.
- **Shape:** **external service.** Run OpenClaw as its own process; this app
  calls it over HTTP.
- **Needs:** a host to run it (VPS/container), `OPENCLAW_BASE_URL`,
  `OPENCLAW_API_KEY`, plus any per-channel/site sessions it manages. Browser
  automation needs a headless Chromium (already available in this environment
  at `/opt/pw-browsers/chromium`).
- **Data flow:** `Byte` (Automation) → Tool Manager → OpenClaw → browser/tool
  actions → results + screenshots back to the agent, gated by human approval
  for risky steps.

### 4. Hermes — `nousresearch/hermes-agent`
- **Role:** long-term **memory**, **skills**, and **cross-provider model
  routing** (200+ models). The AI Core delegates persistent reasoning here.
- **Shape:** **external service** (Python). Run it on a host with the model
  provider keys; this app calls it over HTTP.
- **Needs:** Python env, `HERMES_BASE_URL`, `HERMES_API_KEY`, and the model
  provider API keys Hermes itself routes to (Anthropic / OpenAI / OpenRouter /
  local). Optional GPU host for self-hosted models.
- **Data flow:** any agent → AI Core / Model Router → Hermes → memory recall +
  skill execution + routed model response.

### Plugin schema — `higgsfield-ai/skills/.claude-plugin`
- Used as the **reference schema** for the in-app Plugin Store
  (`marketplace.json` + `plugin.json`). New tools/models register as plugins so
  the platform extends without redesign.

---

## Additional integrations the agents will need

These are **not yet wired** (stubbed in the Tool Manager / Plugin Store). Add
them as connectors as the company grows.

### Publishing & selling (your stated goals)
| Need | Integration | Auth | Reality check |
|------|-------------|------|---------------|
| **Post YouTube videos** | YouTube Data API v3 | OAuth2 (client id/secret + refresh token) | Use **resumable upload**; quota-limited; set title/desc/tags/thumbnail. |
| **Sell on Etsy (with images)** | Etsy Open API v3 | OAuth2 + keystring | Create draft listing → upload images → publish. Respect listing fees + ToS. |
| **Sell on Fiverr** | **No public seller API** | — | Must go through **OpenClaw browser automation** + human approval. Review Fiverr ToS — automation of seller actions can risk the account. |

### Media generation (Product/Media studios)
- **Image generation** — logos, thumbnails, mockups, social graphics (image
  model API of choice).
- **Video generation** — demos, explainers, shorts, ads, captions.
- **Audio** — TTS voiceovers, STT transcription, podcast generation, cleanup.

### Business infrastructure
- **Payments** — Stripe (charges, payouts, the real revenue feed for Analytics).
- **Cloud storage** — S3 / Google Drive (store, organize, version, share files).
- **Email** — transactional + outreach (SMTP / provider API).
- **Calendars & chat** — scheduling, notifications, team comms.
- **Social schedulers** — draft/schedule/publish where the platform allows.
- **CRM / Accounting / Analytics** — pipeline, books, reporting.

### Cross-cutting requirements for any new connector
1. **Secret storage** — a real vault/secret manager; never commit credentials,
   never expose them to agents that don't need them.
2. **Permissions** — least-privilege scopes per connector (already modeled).
3. **Approval workflows** — gate publish/price-change/delete/customer-comms.
4. **Audit logging** — record every tool call (who, what, when, result).
5. **Rate limiting + retries** — exponential backoff; respect each API's limits.
6. **Health checks + usage metrics** — surfaced in the Tool Manager.

---

## Suggested phasing
1. **(this build)** UI shell, living ship, connector registry, dashboards — mock data.
2. Secret storage + the first **real** in-process connector (TradingView) end-to-end.
3. External services: stand up **Hermes** (memory/routing) and **OpenClaw** (automation).
4. Publishing connectors: **YouTube**, **Etsy**; Fiverr via OpenClaw + approvals.
5. Media generation + **Stripe** (real revenue) + storage/email.
6. Agent Builder, Workflow Builder, RBAC/audit/security dashboards, persistence.

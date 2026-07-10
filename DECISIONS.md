# Forge Sites — Decisions

Judgment calls, with rationale, in ADR style. Items marked **⚠ disagreement** are places this design deliberately departs from the build prompt (per Rule 2: disagreement over compliance). Everything here is proposed as of Phase 0 and locked at sign-off.

---

### 1. Next.js 16, not 15 — ⚠ disagreement

**Status: proposed.** The spec pins Next.js 15, but this repo ships Next 16.1.1 with React 19.2. Next 16 is the same architecture the spec actually wants (App Router, RSC, Server Actions) with a newer cache model and long-term support runway. Downgrading a fresh repo to an older major to satisfy a version number would be engineering theater. **We build on Next 16.** If you have a hard external constraint on 15 (e.g., a platform that hasn't certified 16), say so at sign-off and the downgrade is trivial now, painful later.

### 2. Published sites are served multi-tenant, not one Vercel project per site — ⚠ disagreement (interpretation)

**Status: proposed — the one decision most worth confirming at sign-off.** The spec says "Deploy target for user sites: Vercel API + custom domain provisioning," which could be read as provisioning a Vercel *project per user site*. We won't do that: per-site projects mean per-publish builds (minutes, not sub-second), thousands of projects to babysit, API rate limits, and marginal cost per free user. Instead, one renderer serves all published sites via Host-header routing (`ARCHITECTURE.md` §1, §10); the Vercel API is used for what it's genuinely good at — **custom domain attachment and SSL issuance** on our single project. Publish becomes a pointer swap + cache invalidation: instant, free, rollbackable. Users who want their own infrastructure have a better answer than a Vercel project we manage: **code export** (their repo, their account — the trust anchor per the spec).

### 3. Marketplace blocks are schema compositions, never code — security-critical

**Status: proposed.** "Users publish blocks" must not mean "users publish JavaScript that runs on other people's sites" — that is remote code execution with a revenue share. Marketplace listings are schema fragments (compositions of our registry primitives + token bindings + assets). They render through the same validated pipeline as everything else. The creative ceiling is lower than arbitrary code; the alternative is an unshippable security posture. If demand proves out, a sandboxed custom-component runtime (iframe-isolated, capability-scoped) can be a later, separately-threat-modeled feature.

### 4. Workspaces from day one

**Status: proposed.** Studio has seats, Agency has white-label + client billing — that's team tenancy, and bolting `workspace_id` onto a user-keyed schema later is the classic SaaS rewrite. Every tenant table is workspace-scoped from the first migration; a personal workspace is auto-created at signup so Free/Pro users never see the concept.

### 5. Version tree stores full snapshots, not deltas

**Status: proposed.** A site schema is tens of KB of JSONB; even a heavily-edited site's full version history is a few MB. Snapshots make branch/compare/merge trivial (read two rows), make history immune to migration bugs in delta-replay, and cost nothing at this scale. Revisit with content-addressed page-level dedupe only if storage ever shows up on a dashboard worth caring about.

### 6. Two-stage generation (brief → parallel per-page), forced tool-use JSON

**Status: proposed.** One monolithic "generate the whole site" call cannot hit the 60 s / 800 ms budgets and turns every validation failure into a full retry. Stage 1 (small fast call) produces tokens + sitemap + voice; Stage 2 fans out per page in parallel, streaming blocks that are Zod-validated the moment each closes, with per-block repair (max 2, then curated defaults — the user never sees a failure). JSON is obtained via forced tool-use with a registry-derived JSON Schema, not "please respond with JSON" prompting.

### 7. Multiplayer transport: Supabase Realtime first, flagged as the riskiest bet — ⚠ risk flag

**Status: proposed.** The spec mandates Yjs + Supabase Realtime. Yjs is right; Realtime as the *sync transport* is unproven at heavy co-editing message rates and there is no mature `y-supabase` provider — we'll write a thin one. The provider is behind an interface so the fallback (a small dedicated y-websocket service) is a component swap, not a rewrite. Budget one spike day in Phase 6 to load-test before building comments/presence on top.

### 8. A/B significance: Bayesian (Beta-Bernoulli), not p-values

**Status: proposed.** The spec demands "statistical significance, not raw click counts." Frequentist tests are wrong-by-default in a dashboard product because users peek continuously. A Beta-Bernoulli posterior reports "P(B beats A) = 96%", is valid under continuous monitoring, needs ~15 lines of math, and is legible to non-statisticians. Winner declared at ≥95% posterior probability with a minimum-exposure floor per arm.

### 9. A11y blocking on paid tiers only — ⚠ worth revisiting

**Status: proposed (following spec, under protest).** The spec has violations "block publish on paid tiers," which inverts the usual logic: Free users publish inaccessible sites while paying customers get blocked. We implement as specified — block on paid, loud warnings on Free — but recommend flipping to *warn everywhere, block nowhere, badge accessible sites* once real usage data exists. Blocking publishes is a churn lever; accessibility outcomes are better served by defaults so good that violations are rare (which the token contrast rejection in `ARCHITECTURE.md` §2.3 already guarantees for color).

### 10. Lighthouse ≥95 is a gate on what we control, a badge on what users control — ⚠ nuance

**Status: proposed.** "Every generated site must score ≥95" cannot be a CI guarantee once a user uploads a 10 MB PNG or embeds three chat widgets. The enforceable version: CI gates the **block library + renderer** at ≥95 across six fixture sites (any regression fails the build), while the asset pipeline (auto-compression, dimension enforcement, lazy loading, blurhash) keeps user content inside budget, and the editor perf badge shows each site's live score. Fresh generations will score ≥95; we don't pretend to control what users do afterward.

### 11. Model routing

**Status: proposed.** Free: `claude-haiku-4-5`. Pro/Studio: `claude-sonnet-5`. Agency: `claude-opus-4-8` when the planner classifies a job as complex (multi-page, agent mode, brand ingest synthesis), otherwise Sonnet — Opus-for-everything would make Agency latency *worse* than Studio on simple edits. IDs live in env, swappable without deploy.

### 12. One Next.js app, four workspace packages

**Status: proposed.** `apps/web` serves builder + published sites + marketing (route groups + host middleware). Splitting deployments now would triple config for zero isolation benefit at current scale. `packages/schema` / `blocks` / `export` / `config` are real packages because export copies block sources verbatim into user repos (`ARCHITECTURE.md` §9) — the package boundary *is* the export boundary. Split the renderer into its own deployment only when traffic isolation demands it.

### 13. Undo is an editor patch stack; versions are commits

**Status: proposed.** Every keystroke as a `site_versions` row would make the version tree unreadable noise. In-editor undo/redo = Immer inverse patches, instant and in-memory. Durable versions commit on generation events, applied AI edits, and explicit saves — the tree stays a history of *intent*.

### 14. Free-tier output quality

**Status: proposed.** Haiku generates from the same registry, same token brain, same validation, same repair loop — the floor on output quality is structural, not model-dependent. Free limits are quantity (1 site, 10 generations, badge, no export), never a degraded renderer. The upgrade moment should be "I want more of this," not "I want it to stop being bad."

---

## Open question for sign-off (the one that changes architecture)

**Decision #2** — confirm multi-tenant serving over per-site Vercel projects. Everything in Phase 5 (publish, domains, rollback) is built on it. Silence at sign-off = proceed as proposed.

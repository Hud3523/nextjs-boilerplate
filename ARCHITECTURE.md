# Forge Sites — Architecture

Phase 0 deliverable. Companion doc: [DECISIONS.md](./DECISIONS.md) records every judgment call and every place this design deliberately disagrees with the build prompt.

---

## 1. System overview

```
                        ┌─────────────────────────────────────────────┐
                        │                apps/web (Next.js)           │
                        │                                             │
  Browser ── builder ──▶│  /app        editor, dashboard, billing     │
  Browser ── visitor ──▶│  /sites/*    multi-tenant published renderer│──▶ visitor's site
  Browser ── public ───▶│  /(marketing) landing, pricing, docs        │
                        └──────┬───────────────┬───────────┬──────────┘
                               │               │           │
                    ┌──────────▼───┐   ┌───────▼─────┐  ┌──▼─────────────┐
                    │ Supabase     │   │ Upstash     │  │ Anthropic API  │
                    │ Postgres+RLS │   │ Redis+QStash│  │ (tier-routed)  │
                    │ Auth,Storage │   │ cache,queue,│  └────────────────┘
                    │ Realtime     │   │ rate limits │  ┌────────────────┐
                    └──────────────┘   └─────────────┘  │ Stripe         │
                    ┌──────────────┐   ┌─────────────┐  │ Vercel API     │
                    │ Vercel Blob  │   │ Sentry      │  │ (domains, SSL) │
                    │ (exports)    │   └─────────────┘  └────────────────┘
                    └──────────────┘
```

One Next.js deployment serves three surfaces, split by route group and middleware host matching:

1. **Builder app** (`app.forgesites.com`) — auth-gated editor, dashboard, billing.
2. **Published sites** (`{slug}.forgesites.app` + customer custom domains) — the multi-tenant renderer. Middleware maps `Host` → site → published version snapshot → RSC render, edge-cached by tag, invalidated on publish. This is deliberately **not** one-Vercel-project-per-user-site — see DECISIONS #2.
3. **Marketing site** (`forgesites.com`).

### Repo layout (pnpm workspaces)

```
apps/web/                Next.js app (all three surfaces)
packages/schema/         Site Schema: Zod types, design tokens, migrations, JSON-Patch ops
packages/blocks/         Block registry + the ~40 React components (the ONLY renderer;
                         used verbatim by the live renderer, the editor canvas, AND export)
packages/export/         Schema → standalone Next.js repo compiler
packages/config/         Shared tsconfig / eslint / tailwind presets
```

`packages/blocks` being a real package is load-bearing: export works by copying the same component sources users saw live, so exported sites are pixel-identical and there is exactly one implementation to test, audit for a11y, and hold to the Lighthouse budget.

---

## 2. Site Schema

The schema is the product. AI never emits HTML; it emits this, validated by Zod, rejected and repaired on failure.

```ts
// packages/schema — canonical shapes (abridged)

interface Site {
  schemaVersion: number;        // migrations run on read; see §2.4
  id: string;
  name: string;
  theme: DesignTokens;
  nav: NavConfig;               // shared header/footer, rendered on every page
  pages: Page[];
  collections: Collection[];    // CMS, see §8.7
}

interface Page {
  slug: string;                 // '' = home
  seo: SeoMeta;                 // title, description, ogImage assetId, noindex
  blocks: Block[];
}

interface Block<T extends BlockType = BlockType> {
  id: string;                   // nanoid(10), unique per site — the address for surgical edit
  type: T;
  props: BlockProps[T];         // typed per block via the registry
  children?: Block[];           // only container types (section, columns, tabs) accept children
  variants?: ResponsiveOverrides; // { md?: DeepPartial<props>, lg?: DeepPartial<props> } — mobile-first base
  binding?: CollectionBinding;  // repeating blocks bound to a CMS collection
  abVariants?: AbVariant[];     // headline/copy alternates for split testing
}

interface DesignTokens {
  palette: SemanticPalette;     // OKLCH: bg, surface, surfaceAlt, text, textMuted,
                                // primary, primaryContrast, accent, border, success, warn, error
  typeScale: { heading: FontStack; body: FontStack; baseSize: number; ratio: number };
  radius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  spacing: number;              // base unit, px; all block spacing = multiples
  shadow: 'none' | 'soft' | 'crisp' | 'dramatic';
  motion: { duration: number; easing: string; reduced: boolean };
}
```

### 2.1 Block registry

Single source of truth in `packages/blocks/registry.ts`. Each entry declares:

```ts
{
  type: 'hero',
  props: HeroPropsSchema,             // Zod — drives validation AND the inspector form
  component: Hero,                    // RSC by default; interactive leaves are 'use client'
  category: 'header' | 'content' | 'social-proof' | 'commerce' | 'form' | 'layout' | 'footer',
  acceptsChildren: false,
  a11y: { landmark: 'banner', requiresAlt: ['image'], focusable: [...] },  // drives guardrails, §8.8
  aiHints: string,                    // one-line description injected into generation prompts
}
```

The full `Block` Zod type is a `z.discriminatedUnion('type', ...)` built mechanically from the registry, and the JSON Schema handed to the model (§5) is derived from the same source — the registry can never drift from validation or generation.

**~44 block types** (Phase 2 builds all except the four storefront blocks, which land with Commerce, §9): hero (4 layouts), featureGrid, featureAlternating, pricingTable, testimonialCarousel, testimonialGrid, faqAccordion, logoCloud, ctaBand, footer (3 layouts), contactForm, newsletterForm, gallery, imageText, stats, timeline, team, blogIndex, blogPost, richText, video, map, steps, comparison, badgeBar, banner, navHeader (3 layouts), section, columns, spacer, divider, socialLinks, hoursTable, menuList (restaurants), quote, embedCard, breadcrumbs, legalText — plus storefront: productGrid, productDetail, cartDrawer, buyButton.

### 2.2 Rendering rules

- Blocks reference **only** CSS custom properties emitted from `DesignTokens` (`var(--fs-primary)` etc.). No literal colors anywhere in `packages/blocks`. Changing a token restyles everything — this *is* the "design token brain"; it's enforced by an ESLint rule banning color literals in the package, not by convention.
- Text is rendered as React text nodes (escaped). Rich text is a constrained AST (bold/italic/link/list only), rendered by a safe renderer. **No `dangerouslySetInnerHTML` anywhere in the render path.**
- URL props pass a protocol allowlist (`https`, `mailto`, `tel`, relative) at schema-validation time.
- Server Components by default; only genuinely interactive leaves (carousel, accordion, form, mobile nav, cart drawer) are client components. Target: a typical published page ships < 30 KB of first-party JS.

### 2.3 Contrast is math, not vibes

`packages/schema/contrast.ts` implements WCAG 2.1 relative-luminance contrast (unit-tested against published W3C examples). Palette generation **rejects** token sets where body-text pairs fall below 4.5:1 or large-text/UI pairs below 3:1, and the repair loop feeds the failing pair back to the model. The same function powers the conversion critique and the a11y guardrails.

### 2.4 Schema versioning

Stored schemas outlive code. `schemaVersion` is an integer; `packages/schema/migrations/` holds pure `(vN) => vN+1` functions; `migrateToLatest()` runs on every read of a stored schema. Writes always persist the latest version. Migrations are unit-tested with fixture schemas from each historical version.

---

## 3. Data model

Postgres (Supabase), Drizzle ORM, **RLS enabled on every table**. All tenant tables carry a denormalized `workspace_id` so policies stay one indexed lookup.

### 3.1 Tenancy

Workspaces from day one (retrofitting multi-tenancy is the classic SaaS regret — DECISIONS #4). A personal workspace is auto-created at signup; Free/Pro users may never notice it exists.

| table | key columns | notes |
|---|---|---|
| `profiles` | `user_id (= auth.users.id)`, name, avatar | |
| `workspaces` | id, name, slug, `owner_id` | |
| `workspace_members` | workspace_id, user_id, `role: owner\|admin\|editor\|client` | `client` = CMS edit-only view (§8.7); seat counts enforced against tier |

### 3.2 Sites & versions

| table | key columns | notes |
|---|---|---|
| `sites` | id, workspace_id, name, subdomain_slug, `default_branch_id`, `published_version_id`, badge_hidden | |
| `site_versions` | id, site_id, workspace_id, `parent_id` (nullable), `schema jsonb`, message, author_id, created_at | **Immutable, append-only.** The version *tree*: parent pointers form the DAG; a branch is just a named moving pointer. Full snapshots, not deltas — DECISIONS #5 |
| `branches` | id, site_id, name, `head_version_id` | branch = create pointer at any version; compare = render two versions side-by-side; merge = per-block three-way merge (§7.4) |
| `deployments` | id, site_id, version_id, status, published_at | audit trail of publishes |
| `domains` | id, site_id, hostname, `status: pending\|verifying\|active`, verification_token | never serves traffic until TXT-verified (§11) |
| `assets` | id, workspace_id, storage_path, kind, alt, width/height, blurhash | Supabase Storage; images auto-optimized on upload |

### 3.3 Billing & metering

| table | key columns | notes |
|---|---|---|
| `subscriptions` | workspace_id (unique), stripe_customer_id, stripe_subscription_id, stripe_price_id, `tier`, `status`, current_period_end, `grace_until` | tier derived from price-ID map in env — price IDs never hardcoded |
| `stripe_events` | `id text PRIMARY KEY` (Stripe event id), type, payload, processed_at | idempotency: `INSERT … ON CONFLICT DO NOTHING`; only a fresh insert triggers processing |
| `usage_counters` | workspace_id, `meter`, `period_start`, `used` | hot row per (workspace, meter, month); updated transactionally |
| `usage_events` | id, workspace_id, user_id, meter, quantity, model, prompt_hash, metadata, created_at | append-only audit; counters are rebuildable from it |
| `credit_ledger` | id, workspace_id, `delta`, reason, stripe_payment_intent_id, created_at | overage packs; balance = SUM(delta), enforced ≥ 0 in the debit function |

**Enforcement is one SQL function**, `debit_usage(workspace, meter, qty)`: in a single transaction it locks the counter row, computes `remaining = tier_quota − used + credit_balance`, and either inserts the event + increments, or raises. Called **server-side before every AI invocation**; refunded if the model is never reached. No client-side checks exist, anywhere.

### 3.4 Commerce

| table | key columns | notes |
|---|---|---|
| `store_settings` | site_id (unique), workspace_id, `stripe_account_id`, `onboarding_status`, currency, shipping/tax config jsonb | checkout is disabled until `onboarding_status = complete` (§9.1) |
| `products` | id, site_id, workspace_id, title, description, images (asset ids), `price_cents`, compare_at_cents, `kind: physical\|digital`, digital_asset_id, inventory_qty, status, position | surfaced to editors as a CMS collection (§9.3) |
| `product_variants` | id, product_id, options jsonb, price_cents, inventory_qty | optional; ≤ 2 option dimensions in v1 |
| `orders` | id, site_id, workspace_id, `stripe_session_id` (unique), payment_intent_id, email, amount_cents, currency, `status: pending\|paid\|fulfilled\|refunded`, shipping jsonb | rows created **only** by the verified Connect webhook |
| `order_items` | order_id, product_id, variant_id, qty, `unit_amount_cents`, title_snapshot | price + title snapshotted at purchase time |

### 3.5 Features (later phases, tables designed now)

`comment_threads` / `comments` (anchored to `site_id + block_id`, resolved flag) · `ab_tests` / `ab_exposures` (§8.5) · `marketplace_listings` / `marketplace_installs` / `payout_accounts` (§8.6) · `api_keys` (hashed, Agency tier) · `agent_runs` / `agent_steps` (§8.4, approval state persisted here).

### 3.6 RLS strategy

- Helper: `is_member(workspace_id, min_role)` — `SECURITY DEFINER`, checked against `workspace_members`.
- Every tenant table: `USING (is_member(workspace_id, 'editor'))` for writes, `'client'` for reads; stricter per table where roles matter.
- `stripe_events`, `usage_counters`, `agent_runs` mutations: **service-role only** (webhooks, queue workers). No user-facing policy grants writes.
- Published-site rendering reads via the server-side service client against `published_version_id` only — no anon RLS surface at all.
- **Proven, not assumed**: a Playwright test signs in as user A and user B and asserts every cross-tenant read/write path 403s/404s (§14).

---

## 4. Tiers & entitlements

One module: `apps/web/lib/entitlements/`. Nothing else in the codebase mentions tier names.

```ts
type Tier = 'free' | 'pro' | 'studio' | 'agency';
type Feature = 'customDomain' | 'codeExport' | 'removeBadge' | 'abTesting'
             | 'multiplayer' | 'whiteLabel' | 'apiAccess' | 'commerce';
type Meter = 'sites' | 'aiGenerations' | 'seats' | 'products' | 'storageBytes';

const MATRIX: Record<Tier, { features: Set<Feature>; quotas: Record<Meter, number> }>;

hasAccess(ctx: WorkspaceCtx, feature: Feature): boolean            // sync, from resolved entitlements
requireAccess(ctx, feature): Result<void, EntitlementError>        // server guard
debitUsage(ctx, meter, qty): Promise<Result<void, QuotaError>>     // wraps the SQL function, §3.3
```

- Entitlements resolve from the `subscriptions` row (60 s cache); `status = past_due && now < grace_until` keeps the paid tier; past grace → resolved tier is `free` (downgrade, never deletion).
- Model routing lives here too: `modelFor(ctx, task)` → Free: `claude-haiku-4-5`; Pro/Studio: `claude-sonnet-5`; Agency: `claude-opus-4-8` when the planner classifies the job complex, Sonnet otherwise (latency + cost).
- Commerce (`'commerce'`, Pro+): platform transaction fee applied as Stripe `application_fee_percent` — Pro 2%, Studio 1%, Agency 0% — plus product caps (50 / 500 / unlimited) and storage quotas (Free 200 MB / Pro 5 GB / Studio 20 GB / Agency 100 GB). Proposed numbers: DECISIONS #17.
- Platform billing (our subscriptions — distinct from merchant payments, §9): Stripe Checkout for purchase, Customer Portal for management, annual prices at 10× monthly (2 months free). Webhooks handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` (sets `grace_until = now() + 3 days`). All idempotent via `stripe_events` (§3.3). Signature verified before parsing.

---

## 5. Generation pipeline

```
prompt ─▶ debit quota ─▶ cache check ─▶ Stage 1: brief ─▶ Stage 2: pages (parallel) ─▶ commit version
             (SQL fn)     (Redis, keyed        (fast small call:      (streamed blocks,
                           by hash)             tokens + sitemap       validated per-block)
                                                + voice)
```

- **Two stages.** Stage 1 (small, fast call): business brief → `DesignTokens` + sitemap + tone-of-voice card. Stage 2: one call per page, **parallel**, each emitting that page's `Block[]`. This is how "live site in under 60 s" and sub-800 ms first content are actually achievable; a single monolithic call is neither fast nor repairable.
- **Structured output, not prose.** Each call forces a tool (`emit_page`) whose `input_schema` is JSON Schema derived from the registry's Zod types. We stream `input_json_delta`, run an incremental JSON parser, and emit an SSE event the moment each block object closes → the editor materializes it (skeleton → shimmer → settle). First block typically lands well under the 800 ms budget because Stage 1's tokens already painted the frame.
- **Validation & repair.** Every completed block is Zod-parsed immediately. Invalid block → auto-retry *that block only*, feeding back the Zod error summary (max 2 attempts, then fall back to the block type's curated default props — the user sees a sane block, never an error). Full-document parse failure → one full retry. All retries are invisible; they only show up in metrics.
- **Caching.** Redis: `sha256(normalized prompt ‖ model ‖ schemaVersion ‖ token seed)` → schema, 24 h TTL. Cache hits skip the debit refund question by checking cache *before* debiting.
- **Queue.** Anything beyond one site generation (multi-page regeneration, agent mode, brand ingest crawl, export builds) runs as a QStash job with progress streamed over a Supabase Realtime channel; jobs are idempotent by job ID and survive redeploys.
- **Rate limiting.** Upstash sliding window, per-user *and* per-IP, on every AI-touching route — quota protects the month, rate limits protect the minute.
- **Commerce intent.** Stage 1 classifies whether the brief describes selling something; if so, it seeds a draft product collection (names, copy, placeholder prices flagged for review) and swaps in storefront blocks. Money never moves from generation: buy buttons render disabled until the owner completes Stripe onboarding (§9.1).
- Every generation commits a `site_versions` row (message = the prompt). The version tree is a free byproduct of the pipeline.

---

## 6. Surgical AI edit

1. Click selects a node → address = `(pageSlug, blockId)`.
2. Instruction + that block's schema + `DesignTokens` + a one-paragraph site context summary go to the model (same forced-tool pattern, schema = that block type's Zod only). Sibling blocks are **not** sent — that's what keeps it surgical, fast, and cheap.
3. Response is validated, then shown as a **visual before/after diff** (two live renders) plus a collapsed prop-level diff; apply = a JSON-Patch op against the draft.
4. Apply commits a version (parent = current head). Undo/redo is an in-editor patch stack (inverse patches, instant, in-memory); version commits happen on generation events and explicit saves, so the tree stays meaningful, not keystroke-noise.

---

## 7. Editor

- **Canvas**: the draft schema rendered by the *same* `packages/blocks` components inside a sandboxed same-origin iframe (accurate preview, style isolation, honest viewport switching). A selection overlay in the parent tracks block DOM rects via `data-block-id`.
- **Inspector**: forms generated from each block's Zod schema (field types → controls), so 40 block types don't mean 40 hand-built panels. Token editor edits `DesignTokens` with live restyle.
- **Direct manipulation — nothing is locked**: double-click any text to edit it inline on the canvas (writes flow through the same Zod validation as every other mutation); drag blocks to reorder; insert-block palette between any two blocks; duplicate/delete on every node. Every visible element maps to an editable schema prop — the only pixels a user can't change are the Free-tier badge (entitlement-gated server-side, §11).
- **Drop anything**: drag files/photos from the desktop onto the canvas — or paste from the clipboard — and they upload in place with progress shown (client-side downscale → server renditions in AVIF/WebP + blurhash placeholder). Dropping onto an image slot fills it; dropping several onto a gallery appends items; dropping with nothing selected opens the asset manager (grid, search, required alt text — feeds the a11y guardrails). Uploads are MIME-sniffed (never extension-trusted), SVGs sanitized server-side, 25 MB/file cap, per-tier storage quotas (§4).
- **State**: draft schema in a Zustand store with Immer patches (powers undo, §6.4); autosaved to the draft branch head; multiplayer swaps the store backend for a Yjs doc (§8.3) without changing component code.
- **Version tree UI**: DAG view of `site_versions`; branch, side-by-side compare (two iframes, synced scroll), merge with per-block three-way resolution (base = common ancestor; conflicts = both sides touched the same block id; user picks a side per conflict — no textual merging of props).
- **Command palette** (`⌘K`) and a full shortcut map ship in Phase 4, not as polish later; focus rings and keyboard reachability are acceptance criteria for every editor feature.
- **Mobile**: view, comment, publish. No touch drag-and-drop pretense.

---

## 8. Differentiators — how each actually works

**8.1 Brand ingest.** URL fetch through a hardened fetcher (SSRF-proofed, §12) → extract palette (CSS + logo quantization), fonts, headings/voice sample → seed Stage 1. Logo upload path: palette from image quantization (Studio+ adds tone from any pasted copy). Scraped content is **data, never instruction** (§12).

**8.2 Conversion critique.** Second model pass over the published-candidate schema + real contrast math (§2.3) → typed `CritiqueReport`: scores (hierarchy, contrast, CTA clarity, above-fold value prop) + a punch list where each item carries a ready-made JSON-Patch fix. "One-click fix" = apply patch through the same validation path as any edit. No free-text advice that can't be applied.

**8.3 Multiplayer.** Yjs document per draft; awareness (cursors, selection) over Supabase Realtime presence; document sync via a thin Yjs provider over Realtime broadcast. **Flagged risk** (DECISIONS #7): Realtime message throughput may not hold for heavy co-editing; the provider is an interface so the fallback (a tiny dedicated y-websocket service) is a swap, not a rewrite. Comments live in Postgres, anchored to block IDs, with resolve threads.

**8.4 Agent mode.** Planner (model) emits a **typed plan** — Zod-validated steps, each `{ tool, args, riskClass: 'read' | 'write' | 'spend' | 'deploy' | 'external' }`. Executor runs steps sequentially via QStash; any step with riskClass `spend`, `deploy`, or `external` **halts the run**, persists state in `agent_runs`, and waits for explicit per-action human approval in the UI. Tools are our own internal APIs only — the agent cannot shell out, fetch arbitrary URLs, or spend without a gate. Site content reaches the agent only inside fenced data envelopes (§12).

**8.5 A/B testing.** Variants live on the block (`abVariants`); middleware assigns a sticky bucket cookie (50/50); exposures and conversions land in `ab_exposures`. Significance: **Beta-Bernoulli Bayesian posterior** — report "P(B > A) = 96.3%", call a winner at ≥95% with a minimum-exposure floor. Chosen over p-values because it's immune to the peeking problem and comprehensible to non-statisticians (DECISIONS #8).

**8.6 Marketplace.** Published blocks are **schema fragments + token bindings — never arbitrary code** (DECISIONS #3; anything else is remote code execution as a feature). Listings are validated, rendered by the same registry, virus-scanned for asset payloads, and reviewed before featuring. Revenue share via Stripe Connect (Phase 6).

**8.7 Zero-setup CMS.** Any block whose children repeat homogeneously (testimonials, blog index, menu, team) can be promoted to a `Collection`; items become rows, the block gets a `binding`. The `client` role sees only a clean list-and-form view — no canvas, no schema.

**8.8 A11y guardrails.** Every render runs: contrast (real math, §2.3), alt-text presence (schema-level, from registry `a11y` metadata), landmark/heading-order rules, focus-order = DOM-order check. Violations annotate the canvas inline always; they **block publish on paid tiers** and warn loudly on Free (per spec — flagged in DECISIONS #9 as a policy worth revisiting).

---

## 9. Commerce ("Shopify-lite")

Any site can become a store. Same schema, same editor, same publish pipeline — commerce adds a product collection, four storefront blocks, and money movement to the site owner via **Stripe Connect**.

### 9.1 Money flow

- Merchant onboarding: the site owner connects a **Stripe Connect Express** account (Stripe-hosted KYC). We never hold funds and never see card data; visitor checkout is Stripe-hosted (PCI scope stays SAQ-A). **Buy buttons render disabled ("coming soon") until onboarding completes** — a half-configured store can never take money it can't receive.
- Charges are **direct charges on the connected account** with a platform `application_fee_percent` by tier (§4). Refunds are issued by the merchant from the order dashboard against their own account.
- The AI "connects payments" by scaffolding the entire store and deep-linking the owner into Connect onboarding. Because KYC is an inherently human flow, the hard rule that no money moves without explicit human action is satisfied *structurally*, not by policy.

### 9.2 Storefront

- Blocks: `productGrid`, `productDetail`, `cartDrawer`, `buyButton` — same registry, same design tokens, same a11y metadata as every other block, so stores restyle with the token brain and export like everything else.
- The cart is a client-side convenience (localStorage; nothing authoritative lives there — Rule 3 intact). Checkout POSTs `{productId, variantId, qty}` only; **the server re-derives every price from Postgres** when creating the Checkout Session. A client-supplied amount does not exist anywhere in the API.
- `checkout.session.completed` on the Connect webhook endpoint (signature-verified, idempotent by event id exactly like §3.3, `account` matched to `store_settings` before any write) creates the order, decrements inventory atomically (floor at zero → "sold out"), and sends buyer receipt + merchant notification. Digital products fulfill via signed, expiring download URLs.

### 9.3 Products are a collection

Products are a first-class `Collection` (§8.7): generation seeds draft products when Stage 1 detects commerce intent, and the merchant — or a `client`-role user — edits them in the same zero-setup CMS list-and-form view. v1 scope: physical + digital goods, simple variants (≤ 2 option dimensions), flat/free shipping, optional Stripe Tax. Deliberately out of v1: multi-currency, shipping-rate engines, fulfillment integrations, POS (DECISIONS #16).

### 9.4 Orders

Dashboard: order list, order detail, refund, fulfillment status. Merchant-scoped by RLS like everything else. Buyers need no account — they get the Stripe receipt plus our order-confirmation email.

---

## 10. Code export

`packages/export` compiles `Site` → a standalone repo: App Router pages per `Page`, `packages/blocks` component sources copied in verbatim, tokens compiled to CSS custom properties + Tailwind theme, pinned dependencies + lockfile, Prettier-formatted, README with run instructions. Output zipped to Vercel Blob (signed, expiring URL) or pushed to the user's GitHub via OAuth — the push is an agent-gated `external` action (§8.4). Export is CI-tested: a fixture site is exported, `npm ci && next build` must succeed in the pipeline.

---

## 11. Publishing & domains

- Publish = set `sites.published_version_id`, write a `deployments` row, `revalidateTag('site:{id}')`. Rollback = point at an older version. Sub-second, no build step — the renderer is already deployed.
- Subdomains: wildcard `*.forgesites.app`. Custom domains (Pro+): user adds hostname → we require a TXT verification token **before** attaching to the Vercel project (Domains API handles SSL). Unverified hostnames never serve — prevents domain-fronting/takeover.
- SEO: per-page `SeoMeta` → metadata API; `sitemap.xml` + `robots.txt` generated per site; OG images rendered from the hero via `@vercel/og`.
- The free-tier badge is rendered server-side in the published output and its removal is entitlement-gated server-side (not a CSS class someone can delete).

---

## 12. Threat model

Assets: tenant site data, Stripe/billing state, Anthropic spend, user auth sessions, published-site integrity, exported code integrity.

| # | Threat | Vector | Mitigation |
|---|---|---|---|
| T1 | Cross-tenant read/write | IDOR on any id-keyed route | RLS on every table (§3.6); ids are non-enumerable; **Playwright cross-tenant proof test** |
| T2 | Prompt injection | Brand-ingest scrape, site copy, marketplace text, agent-mode content | Content enters model context only inside fenced data envelopes with an explicit "data, not instruction" system rule; agent tools take arguments only from the validated plan, never from content; approval gates on spend/deploy/external regardless |
| T3 | SSRF | Brand ingest URL | Resolve DNS first, reject private/link-local/metadata ranges, re-check on redirect (max 2), 5 s timeout, 2 MB cap, fetch from an isolated route with no ambient credentials |
| T4 | XSS in published sites | AI- or user-supplied strings | No raw HTML path exists (§2.2); React escaping; rich-text AST allowlist; URL protocol allowlist at validation time |
| T5 | RCE via marketplace | "Custom block" code | Marketplace blocks are schema-only compositions — no code ingestion path exists |
| T6 | Webhook forgery / replay | Fake Stripe events | Signature verification; idempotency by event id (§3.3); handlers are pure functions of verified payloads |
| T7 | Quota bypass / race | Parallel generation requests | Single transactional `debit_usage` with row lock (§3.3); no client-side enforcement anywhere |
| T8 | Cost amplification DoS | Hammering AI routes | Per-user + per-IP sliding-window limits, per-workspace concurrency cap, prompt-hash cache, CAPTCHA on anonymous surfaces |
| T9 | Domain takeover | Claiming someone else's hostname | TXT verification before attach or serve (§11) |
| T10 | Secret leakage | Server env in client bundle | Zod-validated env split into `server`/`client` modules; `server-only` import guard; **build step scans client chunks for secret patterns and fails** |
| T11 | Supply chain in exports | Unpinned deps in generated repos | Exact pinned versions + committed lockfile; export build verified in CI (§10) |
| T12 | Session attacks | CSRF, token theft | Supabase httpOnly cookies, PKCE, SameSite=Lax, Server Action origin checks; API keys (Agency) stored hashed, scoped, revocable |
| T13 | Price tampering | Client-modified cart amounts | Checkout API accepts product/variant ids + qty only; every price re-derived from Postgres at session creation (§9.2) |
| T14 | Cross-merchant order injection | Forged/replayed Connect webhooks | Connect signature verification; event-id idempotency; webhook `account` matched to `store_settings` before any write |
| T15 | Digital-goods leakage / oversell | Shared download links; concurrent purchases | Signed expiring download URLs issued per order; atomic inventory decrement with floor-at-zero |
| T16 | Malicious uploads | SVG scripts, MIME spoofing, storage exhaustion | Server-side SVG sanitization (scripts/foreignObject/event handlers stripped); MIME sniffing over extension trust; size caps + per-tier storage quotas |

---

## 13. Performance & quality gates

- **Budgets**: published-site LCP < 1.8 s (mid-tier mobile), first streamed block < 800 ms, editor interaction < 100 ms, < 30 KB first-party JS on typical published pages (storefront pages with a live cart get a 60 KB budget).
- **Lighthouse CI**: every PR renders 6 fixture sites (dark/light, image-heavy, long-form, form-heavy, minimal, RTL) and fails if any category on any fixture drops below 95. This gates the **block library and renderer** — the things we control. Per-user-site scores are surfaced as the editor perf badge, with the asset pipeline (auto-compression, dimension enforcement, blurhash placeholders) keeping user content inside budget. (Nuance vs. spec: DECISIONS #10.)
- **Fonts**: self-hosted, subset, `font-display: swap`, preloaded — no system-font fallback flash and no third-party font CDN.

## 14. Testing

| Layer | Tool | Non-negotiables |
|---|---|---|
| Unit | Vitest | Schema validation + migrations; contrast math vs. W3C published values; entitlement matrix (every tier × feature × meter); webhook idempotency; `debit_usage` race (concurrent debits against a real Postgres via testcontainers); checkout price derivation (T13); export compiler snapshot |
| E2E | Playwright | Auth flows; generation happy-path (mocked model, real pipeline); **RLS cross-tenant proof (T1)**; publish + rollback; editor undo/diff-apply; inline edit + asset drop; storefront checkout (Stripe test mode, Connect test account); a11y guardrail blocking |
| Perf | Lighthouse CI | §13 fixtures, gate ≥95 |
| Build | custom | Client-bundle secret scan (T10); exported-repo `next build` (T11) |

Tests ship in the same PR as the feature. CI = lint → typecheck → unit → build (+scans) → e2e → Lighthouse.

## 15. Observability & errors

- Core logic returns typed `Result<T, E>` (no throw-based control flow); route-segment error boundaries everywhere; Sentry (client + server) with source maps.
- Structured logs with request/workspace/job correlation ids. Generation metrics: stage latency, first-block time, retry count, token spend — aggregated per workspace so unit economics are queryable from day one (`usage_events.metadata`).

## 16. Configuration

`lib/env.ts`: Zod-parsed at boot, **fail fast** — the app refuses to start with missing/malformed env. Server and client schemas are separate modules; importing the server env from client code is a compile error via `server-only`. All Stripe price IDs, model IDs, and quota numbers live here, not in code.

---

## Build order

Per the prompt, amended at Phase 0 with commerce: Phase 1 auth/DB/RLS/Stripe/metering → Phase 2 schema + blocks + Lighthouse gate → Phase 3 generation pipeline → Phase 4 editor (incl. inline editing + asset drop) → Phase 5 publish/export → Phase 6 commerce (Connect onboarding, storefront blocks, orders) → Phase 7 differentiators → Phase 8 marketing/onboarding. Each phase lands with its tests and ends with a ≤5-bullet report and an explicit deferral list.

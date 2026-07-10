# Forge Sites

An AI website builder: describe a business in plain English, get a live,
editable, deployed site in under 60 seconds — built on real, exportable,
component-based code the user keeps.

Start with [ARCHITECTURE.md](./ARCHITECTURE.md) (system design) and
[DECISIONS.md](./DECISIONS.md) (every judgment call, ADR-style).

## Layout

```
apps/web/          Next.js app: builder, published-site renderer, marketing
packages/config/   Shared tsconfig
packages/schema/   Site Schema — Zod types, design tokens, migrations   (Phase 2)
packages/blocks/   Block registry + component library                    (Phase 2)
packages/export/   Schema → standalone Next.js repo compiler             (Phase 5)
```

## Getting started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in (see below)
pnpm --filter @forge/web db:migrate            # apply migrations to your database
pnpm dev                                       # http://localhost:3000
```

Environment is validated with Zod at boot (`apps/web/lib/env/schema.ts`):
production refuses to start when anything is missing; development warns and
runs whatever doesn't need the missing service.

Services to provision (all free-tier friendly):

1. **Supabase** — project URL + anon key + service-role key + Postgres URL.
   Enable Google/GitHub OAuth and email magic links in Auth settings.
2. **Stripe** — create the six subscription prices (Pro/Studio/Agency ×
   monthly/annual) and the credit-pack price; paste the IDs into env. Point a
   webhook at `/api/stripe/webhook` with the events listed in
   `lib/stripe/handlers.ts`.
3. **Upstash Redis** — REST URL + token (optional in dev; limiter fails open).

## Commands

| command | what |
|---|---|
| `pnpm dev` | run the app |
| `pnpm lint` / `pnpm typecheck` | static checks |
| `pnpm test` | unit tests (Vitest) |
| `pnpm e2e` | Playwright, incl. the cross-tenant RLS proof (needs env) |
| `pnpm --filter @forge/web db:generate` | new migration from schema changes |
| `pnpm --filter @forge/web db:migrate` | apply migrations |

## Status

Phase 1 (auth, tenancy, RLS, Stripe billing, usage metering) — done.
Phase 2 (Site Schema + block library + Lighthouse gate) — next.

# FBA Profit Calculator

A small SaaS for Amazon FBA sellers: enter a product's price, cost, weight,
and dimensions, and instantly see the Amazon referral fee, FBA fulfillment
fee, storage cost, net profit per unit, margin %, ROI %, and break-even
units — before committing to inventory.

## Pages

- `/` — marketing landing page
- `/calculator` — the calculator itself (free to use, no login required)
- `/pricing` — Free vs. Pro plan comparison and upgrade button

## How monetization works

- **Free tier**: unlimited calculations, save up to 1 product (see
  `lib/plan.ts` → `FREE_TIER_SAVE_LIMIT`).
- **Pro tier ($19/mo)**: unlimited saved products + CSV export, unlocked via
  Stripe Checkout (`app/api/checkout/route.ts`).

There is no user database yet — "Pro" status and saved products are stored
in the browser's `localStorage`, set by the Stripe success redirect
(`/calculator?upgraded=true`). This is enough to validate demand and take
payments, but before scaling revenue you'll want to:

1. Add real accounts (e.g. NextAuth/Clerk) and a database (e.g. Postgres via
   Prisma, or Supabase).
2. Persist subscription status server-side from the Stripe webhook
   (`app/api/webhook/route.ts` already verifies and receives the events —
   it just needs a place to write the result).
3. Gate Pro features by looking up that server-side status instead of a
   client-side flag.

## FBA fee tables

`lib/fbaFees.ts` contains the referral fee percentages, FBA fulfillment fee
tiers, and storage rates. These are approximate 2024 US marketplace rates —
Amazon updates them periodically, so treat the numbers as estimates and
update the tables from the current Seller Central fee schedule before
relying on them for real purchasing decisions.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Stripe test keys
npm run dev
```

To enable the Pro upgrade button, create a Stripe product/price in test
mode and set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` in `.env.local`. Point
a Stripe webhook at `/api/webhook` and set `STRIPE_WEBHOOK_SECRET` to receive
subscription events. Without these set, `/pricing` still renders but the
upgrade button returns a clear "Stripe is not configured" error instead of
failing silently.

## Getting Started (Next.js)

This project uses the Next.js App Router with Tailwind CSS.

```bash
npm run dev    # start the dev server
npm run build  # production build
npm run lint   # eslint
```

Deploy on [Vercel](https://vercel.com/new) — remember to set the same
environment variables from `.env.example` in your deployment's project
settings.

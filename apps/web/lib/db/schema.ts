import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Phase 1 tables: tenancy, billing, metering. Every tenant table carries a
 * denormalized workspace_id so RLS policies stay one indexed lookup
 * (ARCHITECTURE.md §3). RLS itself + the debit_usage()/is_member() functions
 * live in drizzle/0001_rls_and_functions.sql — policy SQL, not table shape.
 */

export const tierEnum = pgEnum("tier", ["free", "pro", "studio", "agency"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "admin",
  "editor",
  "client",
]);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index("workspace_members_user_idx").on(t.userId),
  ],
);

export const subscriptions = pgTable("subscriptions", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripePriceId: text("stripe_price_id"),
  tier: tierEnum("tier").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  graceUntil: timestamp("grace_until", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Idempotency ledger: a Stripe event is processed iff its insert wins. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Hot row per (workspace, meter, calendar month UTC). Mutated only inside
 * debit_usage()/refund_usage() under a row lock; rebuildable from usage_events.
 */
export const usageCounters = pgTable(
  "usage_counters",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    meter: text("meter").notNull(),
    periodStart: date("period_start").notNull(),
    used: bigint("used", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.meter, t.periodStart] })],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    meter: text("meter").notNull(),
    quantity: bigint("quantity", { mode: "number" }).notNull(),
    model: text("model"),
    promptHash: text("prompt_hash"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("usage_events_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

/** Overage packs: purchases (+), consumption (−). Balance = SUM(delta) ≥ 0. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    delta: bigint("delta", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("credit_ledger_workspace_idx").on(t.workspaceId)],
);

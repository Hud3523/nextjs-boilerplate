import "server-only";

import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type { BillingRepo, SubscriptionUpdate } from "./handlers";

/** Drizzle-backed BillingRepo. All writes are service-role by design (§3.6). */
export const drizzleBillingRepo: BillingRepo = {
  async claimEvent(eventId, type, payload) {
    const inserted = await db()
      .insert(schema.stripeEvents)
      .values({ id: eventId, type, payload })
      .onConflictDoNothing()
      .returning({ id: schema.stripeEvents.id });
    if (inserted.length > 0) return true;

    // The id exists. If it was fully processed, this is a true duplicate.
    // If processing died mid-flight (processed_at null), let a *stale* retry
    // re-claim it — the age guard prevents two concurrent deliveries from
    // both winning, since Stripe retries are spaced by hours, not seconds.
    const reclaimed = await db()
      .update(schema.stripeEvents)
      .set({ createdAt: new Date() })
      .where(
        sql`${schema.stripeEvents.id} = ${eventId}
          and ${schema.stripeEvents.processedAt} is null
          and ${schema.stripeEvents.createdAt} < now() - interval '5 minutes'`,
      )
      .returning({ id: schema.stripeEvents.id });
    return reclaimed.length > 0;
  },

  async markEventProcessed(eventId) {
    await db()
      .update(schema.stripeEvents)
      .set({ processedAt: new Date() })
      .where(eq(schema.stripeEvents.id, eventId));
  },

  async linkStripeCustomer(workspaceId, customerId, subscriptionId) {
    await db()
      .update(schema.subscriptions)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.workspaceId, workspaceId));
  },

  async updateByStripeSubscriptionId(subscriptionId, update: SubscriptionUpdate) {
    const rows = await db()
      .update(schema.subscriptions)
      .set({
        tier: update.tier,
        status: update.status,
        stripePriceId: update.stripePriceId,
        currentPeriodEnd: update.currentPeriodEnd,
        cancelAtPeriodEnd: update.cancelAtPeriodEnd,
        graceUntil: update.graceUntil,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.stripeSubscriptionId, subscriptionId))
      .returning({ workspaceId: schema.subscriptions.workspaceId });
    return rows.length > 0;
  },

  async setGraceByCustomerId(customerId, graceUntil) {
    // Keep the earliest grace deadline — repeated payment failures must not
    // roll the window forward indefinitely.
    const rows = await db()
      .update(schema.subscriptions)
      .set({
        status: "past_due",
        graceUntil: sql`least(coalesce(grace_until, ${graceUntil.toISOString()}::timestamptz), ${graceUntil.toISOString()}::timestamptz)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.stripeCustomerId, customerId))
      .returning({ workspaceId: schema.subscriptions.workspaceId });
    return rows.length > 0;
  },

  async downgradeByStripeSubscriptionId(subscriptionId) {
    const rows = await db()
      .update(schema.subscriptions)
      .set({
        tier: "free",
        status: "canceled",
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        graceUntil: null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptions.stripeSubscriptionId, subscriptionId))
      .returning({ workspaceId: schema.subscriptions.workspaceId });
    return rows.length > 0;
  },

  async addCredits(workspaceId, delta, reason, paymentIntentId) {
    await db().insert(schema.creditLedger).values({
      workspaceId,
      delta,
      reason,
      stripePaymentIntentId: paymentIntentId,
    });
  },
};

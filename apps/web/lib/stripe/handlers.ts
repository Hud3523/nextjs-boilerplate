import { err, ok, type Result } from "@/lib/result";
import type { Tier } from "@/lib/entitlements/matrix";
import { priceToPlan, type PriceCatalog } from "./prices";

/**
 * Pure webhook processing: every effect goes through BillingRepo, every
 * Stripe read through StripePort. The route handler provides real
 * implementations; tests provide fakes. Idempotency is structural — an event
 * id is processed iff its insert into stripe_events wins (claimEvent).
 */

export const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // failed payment → 3-day grace → downgrade

export type OurStatus = "active" | "trialing" | "past_due" | "canceled";

export interface SubscriptionUpdate {
  tier: Tier;
  status: OurStatus;
  stripePriceId: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** null = clear any grace window (payment recovered). */
  graceUntil: Date | null;
}

export interface BillingRepo {
  /**
   * Atomically claim an event id. False = already fully processed, or another
   * delivery currently owns it; skip processing. Implementations must let a
   * stale unprocessed claim be retaken so failed handling can be retried.
   */
  claimEvent(eventId: string, type: string, payload: unknown): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
  linkStripeCustomer(workspaceId: string, customerId: string, subscriptionId: string): Promise<void>;
  updateByStripeSubscriptionId(subscriptionId: string, update: SubscriptionUpdate): Promise<boolean>;
  setGraceByCustomerId(customerId: string, graceUntil: Date): Promise<boolean>;
  downgradeByStripeSubscriptionId(subscriptionId: string): Promise<boolean>;
  addCredits(workspaceId: string, delta: number, reason: string, paymentIntentId: string | null): Promise<void>;
}

/** Minimal shapes we consume — keeps handlers testable without Stripe fixtures. */
export interface StripeSubscriptionLike {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  items: { data: Array<{ price: { id: string }; current_period_end: number }> };
}

export interface StripePort {
  getSubscription(subscriptionId: string): Promise<StripeSubscriptionLike>;
}

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface HandlerConfig {
  catalog: PriceCatalog;
  creditPackUnits: number;
  now: () => Date;
}

export type ProcessOutcome = "processed" | "duplicate" | "ignored";
export interface ProcessError {
  kind: "unknown_price" | "unlinked_subscription" | "missing_reference" | "repo_failure";
  detail: string;
}

export function mapStripeStatus(status: string): OurStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "incomplete":
      return "past_due";
    default:
      // canceled, unpaid, incomplete_expired, paused
      return "canceled";
  }
}

function subscriptionUpdateFrom(
  sub: StripeSubscriptionLike,
  catalog: PriceCatalog,
): Result<SubscriptionUpdate, ProcessError> {
  const item = sub.items.data[0];
  if (!item) {
    return err({ kind: "unknown_price", detail: `subscription ${sub.id} has no items` });
  }
  const plan = priceToPlan(catalog, item.price.id);
  if (!plan) {
    return err({ kind: "unknown_price", detail: `unrecognized price ${item.price.id}` });
  }
  const status = mapStripeStatus(sub.status);
  return ok({
    tier: plan.tier,
    status,
    stripePriceId: item.price.id,
    currentPeriodEnd: item.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    // Any healthy update clears grace; past_due leaves an existing window alone
    // (invoice.payment_failed owns setting it).
    graceUntil: null,
  });
}

interface CheckoutSessionLike {
  mode: string;
  client_reference_id: string | null;
  customer: string | { id: string } | null;
  subscription: string | { id: string } | null;
  payment_intent: string | { id: string } | null;
  metadata: Record<string, string> | null;
}

interface InvoiceLike {
  customer: string | { id: string } | null;
}

function idOf(ref: string | { id: string } | null): string | null {
  if (ref === null) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export async function processStripeEvent(
  repo: BillingRepo,
  stripe: StripePort,
  config: HandlerConfig,
  event: StripeEventLike,
): Promise<Result<ProcessOutcome, ProcessError>> {
  const claimed = await repo.claimEvent(event.id, event.type, event.data.object);
  if (!claimed) return ok("duplicate");

  const result = await handle(repo, stripe, config, event);
  if (result.ok) await repo.markEventProcessed(event.id);
  return result;
}

async function handle(
  repo: BillingRepo,
  stripe: StripePort,
  config: HandlerConfig,
  event: StripeEventLike,
): Promise<Result<ProcessOutcome, ProcessError>> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as CheckoutSessionLike;

      if (session.mode === "subscription") {
        const workspaceId = session.client_reference_id;
        const customerId = idOf(session.customer);
        const subscriptionId = idOf(session.subscription);
        if (!workspaceId || !customerId || !subscriptionId) {
          return err({
            kind: "missing_reference",
            detail: "checkout session missing client_reference_id/customer/subscription",
          });
        }
        await repo.linkStripeCustomer(workspaceId, customerId, subscriptionId);
        const sub = await stripe.getSubscription(subscriptionId);
        const update = subscriptionUpdateFrom(sub, config.catalog);
        if (!update.ok) return update;
        await repo.updateByStripeSubscriptionId(subscriptionId, update.value);
        return ok("processed");
      }

      if (session.mode === "payment" && session.metadata?.credit_pack === "true") {
        const workspaceId = session.client_reference_id;
        if (!workspaceId) {
          return err({ kind: "missing_reference", detail: "credit pack without client_reference_id" });
        }
        const packs = Number(session.metadata.quantity ?? "1") || 1;
        await repo.addCredits(
          workspaceId,
          packs * config.creditPackUnits,
          "credit_pack_purchase",
          idOf(session.payment_intent),
        );
        return ok("processed");
      }

      return ok("ignored");
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as StripeSubscriptionLike;
      const update = subscriptionUpdateFrom(sub, config.catalog);
      if (!update.ok) return update;
      const found = await repo.updateByStripeSubscriptionId(sub.id, update.value);
      if (!found) {
        // Races checkout.session.completed (Stripe does not order events):
        // the link handler also writes the full update, so this is benign.
        return ok("ignored");
      }
      return ok("processed");
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as { id: string };
      const found = await repo.downgradeByStripeSubscriptionId(sub.id);
      return ok(found ? "processed" : "ignored");
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as InvoiceLike;
      const customerId = idOf(invoice.customer);
      if (!customerId) {
        return err({ kind: "missing_reference", detail: "invoice without customer" });
      }
      const graceUntil = new Date(config.now().getTime() + GRACE_PERIOD_MS);
      const found = await repo.setGraceByCustomerId(customerId, graceUntil);
      return ok(found ? "processed" : "ignored");
    }

    default:
      return ok("ignored");
  }
}

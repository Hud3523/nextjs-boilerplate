import { describe, expect, it } from "vitest";

import {
  GRACE_PERIOD_MS,
  mapStripeStatus,
  processStripeEvent,
  type BillingRepo,
  type HandlerConfig,
  type StripeEventLike,
  type StripePort,
  type StripeSubscriptionLike,
  type SubscriptionUpdate,
} from "./handlers";
import type { PriceCatalog } from "./prices";

const catalog: PriceCatalog = {
  proMonthly: "price_pro_m",
  proAnnual: "price_pro_a",
  studioMonthly: "price_studio_m",
  studioAnnual: "price_studio_a",
  agencyMonthly: "price_agency_m",
  agencyAnnual: "price_agency_a",
};

const NOW = new Date("2026-07-10T12:00:00Z");

function makeConfig(): HandlerConfig {
  return { catalog, creditPackUnits: 100, now: () => NOW };
}

interface Calls {
  claimed: string[];
  processed: string[];
  linked: Array<{ workspaceId: string; customerId: string; subscriptionId: string }>;
  updates: Array<{ subscriptionId: string; update: SubscriptionUpdate }>;
  graces: Array<{ customerId: string; graceUntil: Date }>;
  downgrades: string[];
  credits: Array<{ workspaceId: string; delta: number; reason: string }>;
}

function makeRepo(opts?: {
  duplicate?: boolean;
  knownSubscription?: boolean;
  knownCustomer?: boolean;
}): { repo: BillingRepo; calls: Calls } {
  const calls: Calls = {
    claimed: [],
    processed: [],
    linked: [],
    updates: [],
    graces: [],
    downgrades: [],
    credits: [],
  };
  const repo: BillingRepo = {
    async claimEvent(eventId) {
      if (opts?.duplicate) return false;
      calls.claimed.push(eventId);
      return true;
    },
    async markEventProcessed(eventId) {
      calls.processed.push(eventId);
    },
    async linkStripeCustomer(workspaceId, customerId, subscriptionId) {
      calls.linked.push({ workspaceId, customerId, subscriptionId });
    },
    async updateByStripeSubscriptionId(subscriptionId, update) {
      calls.updates.push({ subscriptionId, update });
      return opts?.knownSubscription ?? true;
    },
    async setGraceByCustomerId(customerId, graceUntil) {
      calls.graces.push({ customerId, graceUntil });
      return opts?.knownCustomer ?? true;
    },
    async downgradeByStripeSubscriptionId(subscriptionId) {
      calls.downgrades.push(subscriptionId);
      return opts?.knownSubscription ?? true;
    },
    async addCredits(workspaceId, delta, reason) {
      calls.credits.push({ workspaceId, delta, reason });
    },
  };
  return { repo, calls };
}

function makeSubscription(over?: Partial<StripeSubscriptionLike>): StripeSubscriptionLike {
  return {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [{ price: { id: "price_pro_m" }, current_period_end: 1_782_000_000 }],
    },
    ...over,
  };
}

const stripePort: StripePort = {
  async getSubscription() {
    return makeSubscription();
  },
};

function event(type: string, object: unknown, id = "evt_1"): StripeEventLike {
  return { id, type, data: { object } };
}

describe("idempotency", () => {
  it("a duplicate event id is skipped with zero side effects", async () => {
    const { repo, calls } = makeRepo({ duplicate: true });
    const result = await processStripeEvent(
      repo,
      stripePort,
      makeConfig(),
      event("customer.subscription.updated", makeSubscription()),
    );
    expect(result).toEqual({ ok: true, value: "duplicate" });
    expect(calls.updates).toHaveLength(0);
    expect(calls.processed).toHaveLength(0);
  });

  it("successful processing marks the event processed", async () => {
    const { repo, calls } = makeRepo();
    await processStripeEvent(
      repo,
      stripePort,
      makeConfig(),
      event("customer.subscription.updated", makeSubscription(), "evt_42"),
    );
    expect(calls.processed).toEqual(["evt_42"]);
  });

  it("failed processing leaves the event unprocessed for retry", async () => {
    const { repo, calls } = makeRepo();
    const badPrice = makeSubscription({
      items: { data: [{ price: { id: "price_unknown" }, current_period_end: 0 }] },
    });
    const result = await processStripeEvent(
      repo,
      stripePort,
      makeConfig(),
      event("customer.subscription.updated", badPrice),
    );
    expect(result.ok).toBe(false);
    expect(calls.processed).toHaveLength(0);
  });
});

describe("checkout.session.completed", () => {
  it("links customer + subscription and applies the plan", async () => {
    const { repo, calls } = makeRepo();
    const result = await processStripeEvent(repo, stripePort, makeConfig(), event(
      "checkout.session.completed",
      {
        mode: "subscription",
        client_reference_id: "ws_1",
        customer: "cus_1",
        subscription: "sub_1",
        payment_intent: null,
        metadata: null,
      },
    ));
    expect(result).toEqual({ ok: true, value: "processed" });
    expect(calls.linked).toEqual([
      { workspaceId: "ws_1", customerId: "cus_1", subscriptionId: "sub_1" },
    ]);
    expect(calls.updates[0]?.update.tier).toBe("pro");
    expect(calls.updates[0]?.update.status).toBe("active");
  });

  it("rejects a session without a workspace reference", async () => {
    const { repo, calls } = makeRepo();
    const result = await processStripeEvent(repo, stripePort, makeConfig(), event(
      "checkout.session.completed",
      {
        mode: "subscription",
        client_reference_id: null,
        customer: "cus_1",
        subscription: "sub_1",
        payment_intent: null,
        metadata: null,
      },
    ));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("missing_reference");
    expect(calls.linked).toHaveLength(0);
  });

  it("credit-pack payment adds packs × units credits", async () => {
    const { repo, calls } = makeRepo();
    const result = await processStripeEvent(repo, stripePort, makeConfig(), event(
      "checkout.session.completed",
      {
        mode: "payment",
        client_reference_id: "ws_1",
        customer: "cus_1",
        subscription: null,
        payment_intent: "pi_1",
        metadata: { credit_pack: "true", quantity: "3" },
      },
    ));
    expect(result).toEqual({ ok: true, value: "processed" });
    expect(calls.credits).toEqual([
      { workspaceId: "ws_1", delta: 300, reason: "credit_pack_purchase" },
    ]);
  });

  it("ignores unrelated one-time payments", async () => {
    const { repo, calls } = makeRepo();
    const result = await processStripeEvent(repo, stripePort, makeConfig(), event(
      "checkout.session.completed",
      {
        mode: "payment",
        client_reference_id: "ws_1",
        customer: null,
        subscription: null,
        payment_intent: null,
        metadata: {},
      },
    ));
    expect(result).toEqual({ ok: true, value: "ignored" });
    expect(calls.credits).toHaveLength(0);
  });
});

describe("customer.subscription.updated", () => {
  it("maps price → tier and clears any grace window", async () => {
    const { repo, calls } = makeRepo();
    const sub = makeSubscription({
      status: "active",
      items: { data: [{ price: { id: "price_studio_a" }, current_period_end: 1_782_000_000 }] },
    });
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(), event("customer.subscription.updated", sub),
    );
    expect(result).toEqual({ ok: true, value: "processed" });
    const update = calls.updates[0]!.update;
    expect(update.tier).toBe("studio");
    expect(update.graceUntil).toBeNull();
    expect(update.currentPeriodEnd).toEqual(new Date(1_782_000_000 * 1000));
  });

  it("an unknown price is a hard error, never a guess", async () => {
    const { repo } = makeRepo();
    const sub = makeSubscription({
      items: { data: [{ price: { id: "price_mystery" }, current_period_end: 0 }] },
    });
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(), event("customer.subscription.updated", sub),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("unknown_price");
  });

  it("an event for a not-yet-linked subscription is benignly ignored", async () => {
    const { repo } = makeRepo({ knownSubscription: false });
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(),
      event("customer.subscription.updated", makeSubscription()),
    );
    expect(result).toEqual({ ok: true, value: "ignored" });
  });
});

describe("customer.subscription.deleted", () => {
  it("downgrades to free", async () => {
    const { repo, calls } = makeRepo();
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(),
      event("customer.subscription.deleted", { id: "sub_1" }),
    );
    expect(result).toEqual({ ok: true, value: "processed" });
    expect(calls.downgrades).toEqual(["sub_1"]);
  });
});

describe("invoice.payment_failed", () => {
  it("opens a 3-day grace window", async () => {
    const { repo, calls } = makeRepo();
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(),
      event("invoice.payment_failed", { customer: "cus_1" }),
    );
    expect(result).toEqual({ ok: true, value: "processed" });
    expect(calls.graces[0]?.graceUntil).toEqual(new Date(NOW.getTime() + GRACE_PERIOD_MS));
    expect(GRACE_PERIOD_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("an invoice without a customer is a hard error", async () => {
    const { repo } = makeRepo();
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(),
      event("invoice.payment_failed", { customer: null }),
    );
    expect(result.ok).toBe(false);
  });
});

describe("unhandled event types", () => {
  it("are acknowledged and ignored", async () => {
    const { repo } = makeRepo();
    const result = await processStripeEvent(
      repo, stripePort, makeConfig(), event("charge.refunded", {}),
    );
    expect(result).toEqual({ ok: true, value: "ignored" });
  });
});

describe("mapStripeStatus", () => {
  it("maps every Stripe status to our four", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("trialing")).toBe("trialing");
    expect(mapStripeStatus("past_due")).toBe("past_due");
    expect(mapStripeStatus("incomplete")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("canceled");
    expect(mapStripeStatus("unpaid")).toBe("canceled");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeStatus("paused")).toBe("canceled");
  });
});

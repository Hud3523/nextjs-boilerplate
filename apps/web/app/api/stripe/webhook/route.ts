import Stripe from "stripe";

import { env } from "@/lib/env";
import { priceCatalog, stripe } from "@/lib/stripe/client";
import { processStripeEvent, type StripePort } from "@/lib/stripe/handlers";
import { drizzleBillingRepo } from "@/lib/stripe/repo";

export const runtime = "nodejs";

const stripePort: StripePort = {
  async getSubscription(subscriptionId) {
    return stripe().subscriptions.retrieve(subscriptionId);
  },
};

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    // Forged or stale signature — reject before touching any state (T6).
    return new Response("invalid signature", { status: 400 });
  }

  const result = await processStripeEvent(
    drizzleBillingRepo,
    stripePort,
    {
      catalog: priceCatalog(),
      creditPackUnits: env.CREDIT_PACK_UNITS,
      now: () => new Date(),
    },
    event,
  );

  if (!result.ok) {
    console.error("[stripe-webhook]", event.id, event.type, result.error);
    // 500 → Stripe retries. Failed handling leaves processed_at null, and
    // claimEvent lets a stale retry re-claim exactly such events.
    return new Response(result.error.kind, { status: 500 });
  }

  return Response.json({ received: true, outcome: result.value });
}

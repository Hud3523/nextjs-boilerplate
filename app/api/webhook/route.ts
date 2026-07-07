import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

// Verifies and acknowledges Stripe subscription events. There's no database
// yet to persist subscription state server-side (see lib/plan.ts) — wire
// this up to your user/subscription table before relying on it in production.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const body = await request.text();

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // TODO: persist subscription status against the customer/user record.
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

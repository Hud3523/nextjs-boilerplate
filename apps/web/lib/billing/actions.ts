"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { planToPrice, type BillingInterval } from "@/lib/stripe/prices";
import { priceCatalog, stripe } from "@/lib/stripe/client";
import { canManageBilling, getWorkspaceCtx } from "@/lib/workspaces/server";

const planSchema = z.object({
  tier: z.enum(["pro", "studio", "agency"]),
  interval: z.enum(["monthly", "annual"]),
});

/** Ensure the workspace has a Stripe customer; create + persist on first use. */
async function ensureCustomer(workspaceId: string, email: string | null): Promise<string> {
  const rows = await db()
    .select({ customerId: schema.subscriptions.stripeCustomerId })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.workspaceId, workspaceId))
    .limit(1);

  const existing = rows[0]?.customerId;
  if (existing) return existing;

  const customer = await stripe().customers.create({
    email: email ?? undefined,
    metadata: { workspace_id: workspaceId },
  });
  await db()
    .update(schema.subscriptions)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(schema.subscriptions.workspaceId, workspaceId));
  return customer.id;
}

export async function startCheckout(formData: FormData): Promise<void> {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/login");
  if (!canManageBilling(ctx)) redirect("/dashboard?error=not-billing-admin");

  const parsed = planSchema.safeParse({
    tier: formData.get("tier"),
    interval: formData.get("interval"),
  });
  if (!parsed.success) redirect("/dashboard?error=invalid-plan");

  let checkoutUrl: string;
  try {
    const customerId = await ensureCustomer(ctx.workspaceId, ctx.email);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: ctx.workspaceId,
      line_items: [
        {
          price: planToPrice(priceCatalog(), {
            tier: parsed.data.tier,
            interval: parsed.data.interval as BillingInterval,
          }),
          quantity: 1,
        },
      ],
      success_url: `${env.APP_URL}/dashboard?billing=success`,
      cancel_url: `${env.APP_URL}/dashboard?billing=canceled`,
      allow_promotion_codes: true,
    });
    if (!session.url) throw new Error("checkout session has no url");
    checkoutUrl = session.url;
  } catch (error) {
    console.error("[billing] checkout failed", error);
    redirect("/dashboard?error=billing-unavailable");
  }
  redirect(checkoutUrl);
}

export async function buyCreditPack(): Promise<void> {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/login");
  if (!canManageBilling(ctx)) redirect("/dashboard?error=not-billing-admin");

  let checkoutUrl: string;
  try {
    const customerId = await ensureCustomer(ctx.workspaceId, ctx.email);
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: ctx.workspaceId,
      line_items: [{ price: env.STRIPE_PRICE_CREDIT_PACK, quantity: 1 }],
      metadata: { credit_pack: "true", quantity: "1" },
      success_url: `${env.APP_URL}/dashboard?billing=credits-added`,
      cancel_url: `${env.APP_URL}/dashboard?billing=canceled`,
    });
    if (!session.url) throw new Error("checkout session has no url");
    checkoutUrl = session.url;
  } catch (error) {
    console.error("[billing] credit pack checkout failed", error);
    redirect("/dashboard?error=billing-unavailable");
  }
  redirect(checkoutUrl);
}

export async function openBillingPortal(): Promise<void> {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/login");
  if (!canManageBilling(ctx)) redirect("/dashboard?error=not-billing-admin");
  if (!ctx.stripeCustomerId) redirect("/dashboard?error=no-billing-account");

  let portalUrl: string;
  try {
    const session = await stripe().billingPortal.sessions.create({
      customer: ctx.stripeCustomerId,
      return_url: `${env.APP_URL}/dashboard`,
    });
    portalUrl = session.url;
  } catch (error) {
    console.error("[billing] portal failed", error);
    redirect("/dashboard?error=billing-unavailable");
  }
  redirect(portalUrl);
}

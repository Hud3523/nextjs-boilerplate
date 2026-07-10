import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";
import type { PriceCatalog } from "./prices";

let instance: Stripe | null = null;

export function stripe(): Stripe {
  instance ??= new Stripe(env.STRIPE_SECRET_KEY);
  return instance;
}

export function priceCatalog(): PriceCatalog {
  return {
    proMonthly: env.STRIPE_PRICE_PRO_MONTHLY,
    proAnnual: env.STRIPE_PRICE_PRO_ANNUAL,
    studioMonthly: env.STRIPE_PRICE_STUDIO_MONTHLY,
    studioAnnual: env.STRIPE_PRICE_STUDIO_ANNUAL,
    agencyMonthly: env.STRIPE_PRICE_AGENCY_MONTHLY,
    agencyAnnual: env.STRIPE_PRICE_AGENCY_ANNUAL,
  };
}

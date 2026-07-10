import type { Tier } from "@/lib/entitlements/matrix";

export type BillingInterval = "monthly" | "annual";

export interface PriceCatalog {
  proMonthly: string;
  proAnnual: string;
  studioMonthly: string;
  studioAnnual: string;
  agencyMonthly: string;
  agencyAnnual: string;
}

export interface PricePlan {
  tier: Exclude<Tier, "free">;
  interval: BillingInterval;
}

/**
 * Price IDs come from env (never hardcoded). This pure module maps them to
 * tiers; unknown price IDs resolve to null and the webhook treats that as a
 * hard error rather than guessing.
 */
export function priceToPlan(catalog: PriceCatalog, priceId: string): PricePlan | null {
  const map: Record<string, PricePlan> = {
    [catalog.proMonthly]: { tier: "pro", interval: "monthly" },
    [catalog.proAnnual]: { tier: "pro", interval: "annual" },
    [catalog.studioMonthly]: { tier: "studio", interval: "monthly" },
    [catalog.studioAnnual]: { tier: "studio", interval: "annual" },
    [catalog.agencyMonthly]: { tier: "agency", interval: "monthly" },
    [catalog.agencyAnnual]: { tier: "agency", interval: "annual" },
  };
  return map[priceId] ?? null;
}

export function planToPrice(catalog: PriceCatalog, plan: PricePlan): string {
  const key = `${plan.tier}${plan.interval === "monthly" ? "Monthly" : "Annual"}` as const;
  return catalog[key];
}

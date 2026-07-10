/**
 * THE tier gate. Nothing outside lib/entitlements mentions tier names —
 * everything asks hasAccess()/quotaFor() (ARCHITECTURE.md §4).
 *
 * Pure module (no server-only, no I/O) so the full matrix is unit-tested.
 */

export type Tier = "free" | "pro" | "studio" | "agency";

export type Feature =
  | "customDomain" // eligibility only — connecting one is also a paid add-on (DECISIONS #21)
  | "codeExport"
  | "removeBadge"
  | "abTesting"
  | "multiplayer"
  | "whiteLabel"
  | "apiAccess"
  | "commerce";

export type Meter =
  | "ai_generations"
  | "sites"
  | "seats"
  | "products"
  | "storage_bytes";

export const UNLIMITED = Number.POSITIVE_INFINITY;

const MB = 1024 * 1024;
const GB = 1024 * MB;

interface TierEntitlements {
  features: ReadonlySet<Feature>;
  quotas: Readonly<Record<Meter, number>>;
  /** Merchant-payments platform fee, percent (DECISIONS #17). */
  commerceFeePercent: number;
}

export const TIER_MATRIX: Readonly<Record<Tier, TierEntitlements>> = {
  free: {
    features: new Set<Feature>(),
    quotas: {
      ai_generations: 10,
      sites: 1,
      seats: 1,
      products: 0,
      storage_bytes: 200 * MB,
    },
    commerceFeePercent: 0,
  },
  pro: {
    features: new Set<Feature>(["customDomain", "codeExport", "removeBadge", "commerce"]),
    quotas: {
      ai_generations: 300,
      sites: 5,
      seats: 1,
      products: 50,
      storage_bytes: 5 * GB,
    },
    commerceFeePercent: 2,
  },
  studio: {
    features: new Set<Feature>([
      "customDomain",
      "codeExport",
      "removeBadge",
      "commerce",
      "abTesting",
      "multiplayer",
    ]),
    quotas: {
      ai_generations: 1500,
      sites: 25,
      seats: 3,
      products: 500,
      storage_bytes: 20 * GB,
    },
    commerceFeePercent: 1,
  },
  agency: {
    features: new Set<Feature>([
      "customDomain",
      "codeExport",
      "removeBadge",
      "commerce",
      "abTesting",
      "multiplayer",
      "whiteLabel",
      "apiAccess",
    ]),
    quotas: {
      ai_generations: 10000,
      sites: UNLIMITED,
      seats: 20,
      products: UNLIMITED,
      storage_bytes: 100 * GB,
    },
    commerceFeePercent: 0,
  },
};

export interface SubscriptionState {
  tier: Tier;
  status: "active" | "trialing" | "past_due" | "canceled";
  graceUntil: Date | null;
}

/**
 * Resolve the tier a workspace is entitled to *right now*.
 * Failed payment keeps the paid tier through the grace window, then resolves
 * to free — downgrade, never deletion (ARCHITECTURE.md §4).
 */
export function resolveTier(sub: SubscriptionState | null, now: Date): Tier {
  if (!sub) return "free";
  switch (sub.status) {
    case "active":
    case "trialing":
      return sub.tier;
    case "past_due":
      return sub.graceUntil && now < sub.graceUntil ? sub.tier : "free";
    case "canceled":
      return "free";
  }
}

export function hasAccess(tier: Tier, feature: Feature): boolean {
  return TIER_MATRIX[tier].features.has(feature);
}

/** Quota for a meter; UNLIMITED (Infinity) means no cap. */
export function quotaFor(tier: Tier, meter: Meter): number {
  return TIER_MATRIX[tier].quotas[meter];
}

/** Meters whose overage may be covered by purchased credit packs. */
export function metersWithCreditOverage(): ReadonlySet<Meter> {
  return CREDIT_METERS;
}
const CREDIT_METERS: ReadonlySet<Meter> = new Set<Meter>(["ai_generations"]);

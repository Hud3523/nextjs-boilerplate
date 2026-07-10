import { describe, expect, it } from "vitest";

import {
  hasAccess,
  metersWithCreditOverage,
  quotaFor,
  resolveTier,
  TIER_MATRIX,
  UNLIMITED,
  type Feature,
  type Tier,
} from "./matrix";
import { modelFor } from "./models";

const ALL_FEATURES: Feature[] = [
  "customDomain",
  "codeExport",
  "removeBadge",
  "abTesting",
  "multiplayer",
  "whiteLabel",
  "apiAccess",
  "commerce",
];

describe("tier feature matrix", () => {
  const expected: Record<Tier, Feature[]> = {
    free: [],
    pro: ["customDomain", "codeExport", "removeBadge", "commerce"],
    studio: ["customDomain", "codeExport", "removeBadge", "commerce", "abTesting", "multiplayer"],
    agency: ALL_FEATURES,
  };

  for (const [tier, features] of Object.entries(expected) as [Tier, Feature[]][]) {
    it(`${tier} has exactly the expected features`, () => {
      for (const feature of ALL_FEATURES) {
        expect(hasAccess(tier, feature), `${tier}/${feature}`).toBe(
          features.includes(feature),
        );
      }
    });
  }

  it("tiers are strictly additive", () => {
    const order: Tier[] = ["free", "pro", "studio", "agency"];
    for (let i = 1; i < order.length; i++) {
      const prev = order[i - 1]!;
      const next = order[i]!;
      for (const feature of TIER_MATRIX[prev].features) {
        expect(TIER_MATRIX[next].features.has(feature), `${next} ⊇ ${prev}`).toBe(true);
      }
    }
  });
});

describe("quotas", () => {
  it("matches the published tier table", () => {
    expect(quotaFor("free", "ai_generations")).toBe(10);
    expect(quotaFor("pro", "ai_generations")).toBe(300);
    expect(quotaFor("studio", "ai_generations")).toBe(1500);
    expect(quotaFor("agency", "ai_generations")).toBe(10000);

    expect(quotaFor("free", "sites")).toBe(1);
    expect(quotaFor("pro", "sites")).toBe(5);
    expect(quotaFor("studio", "sites")).toBe(25);
    expect(quotaFor("agency", "sites")).toBe(UNLIMITED);

    expect(quotaFor("free", "seats")).toBe(1);
    expect(quotaFor("studio", "seats")).toBe(3);
    expect(quotaFor("agency", "seats")).toBe(20);

    expect(quotaFor("free", "products")).toBe(0);
  });

  it("only ai_generations can burn credit packs", () => {
    expect([...metersWithCreditOverage()]).toEqual(["ai_generations"]);
  });
});

describe("resolveTier (grace semantics)", () => {
  const now = new Date("2026-07-10T12:00:00Z");

  it("no subscription row → free", () => {
    expect(resolveTier(null, now)).toBe("free");
  });

  it("active / trialing keep the paid tier", () => {
    expect(resolveTier({ tier: "pro", status: "active", graceUntil: null }, now)).toBe("pro");
    expect(resolveTier({ tier: "studio", status: "trialing", graceUntil: null }, now)).toBe("studio");
  });

  it("past_due inside the grace window keeps the paid tier", () => {
    const grace = new Date(now.getTime() + 1000);
    expect(resolveTier({ tier: "agency", status: "past_due", graceUntil: grace }, now)).toBe("agency");
  });

  it("past_due after grace resolves to free — downgrade, never deletion", () => {
    const grace = new Date(now.getTime() - 1000);
    expect(resolveTier({ tier: "agency", status: "past_due", graceUntil: grace }, now)).toBe("free");
  });

  it("past_due with no grace set resolves to free", () => {
    expect(resolveTier({ tier: "pro", status: "past_due", graceUntil: null }, now)).toBe("free");
  });

  it("canceled → free", () => {
    expect(resolveTier({ tier: "pro", status: "canceled", graceUntil: null }, now)).toBe("free");
  });
});

describe("modelFor", () => {
  const config = { free: "haiku", standard: "sonnet", complex: "opus" };

  it("routes by tier", () => {
    expect(modelFor("free", "complex", config)).toBe("haiku");
    expect(modelFor("pro", "simple", config)).toBe("sonnet");
    expect(modelFor("studio", "complex", config)).toBe("sonnet");
  });

  it("agency gets the complex model only for complex tasks", () => {
    expect(modelFor("agency", "simple", config)).toBe("sonnet");
    expect(modelFor("agency", "complex", config)).toBe("opus");
  });
});

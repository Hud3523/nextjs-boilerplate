import { describe, expect, it } from "vitest";

import { planToPrice, priceToPlan, type PriceCatalog } from "./prices";

const catalog: PriceCatalog = {
  proMonthly: "price_pro_m",
  proAnnual: "price_pro_a",
  studioMonthly: "price_studio_m",
  studioAnnual: "price_studio_a",
  agencyMonthly: "price_agency_m",
  agencyAnnual: "price_agency_a",
};

describe("priceToPlan", () => {
  it("resolves every configured price", () => {
    expect(priceToPlan(catalog, "price_pro_m")).toEqual({ tier: "pro", interval: "monthly" });
    expect(priceToPlan(catalog, "price_studio_a")).toEqual({ tier: "studio", interval: "annual" });
    expect(priceToPlan(catalog, "price_agency_m")).toEqual({ tier: "agency", interval: "monthly" });
  });

  it("returns null for unknown prices", () => {
    expect(priceToPlan(catalog, "price_nope")).toBeNull();
  });
});

describe("planToPrice", () => {
  it("round-trips with priceToPlan", () => {
    for (const tier of ["pro", "studio", "agency"] as const) {
      for (const interval of ["monthly", "annual"] as const) {
        const price = planToPrice(catalog, { tier, interval });
        expect(priceToPlan(catalog, price)).toEqual({ tier, interval });
      }
    }
  });
});

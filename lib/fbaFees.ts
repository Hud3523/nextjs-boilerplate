// Example Amazon US FBA fee schedule (approximate, 2024 public rates).
// Amazon updates these periodically — treat as estimates and verify
// against current Seller Central rates for real listings.

export type Category =
  | "electronics"
  | "home_kitchen"
  | "clothing_accessories"
  | "beauty_personal_care"
  | "toys_games"
  | "books_media"
  | "grocery"
  | "sports_outdoors"
  | "other";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "electronics", label: "Electronics" },
  { value: "home_kitchen", label: "Home & Kitchen" },
  { value: "clothing_accessories", label: "Clothing & Accessories" },
  { value: "beauty_personal_care", label: "Beauty & Personal Care" },
  { value: "toys_games", label: "Toys & Games" },
  { value: "books_media", label: "Books & Media" },
  { value: "grocery", label: "Grocery & Gourmet" },
  { value: "sports_outdoors", label: "Sports & Outdoors" },
  { value: "other", label: "Other" },
];

const REFERRAL_FEE_PCT: Record<Category, number> = {
  electronics: 0.08,
  home_kitchen: 0.15,
  clothing_accessories: 0.17,
  beauty_personal_care: 0.15,
  toys_games: 0.15,
  books_media: 0.15,
  grocery: 0.08,
  sports_outdoors: 0.15,
  other: 0.15,
};

const REFERRAL_FEE_MINIMUM = 0.3;
const MEDIA_CLOSING_FEE = 1.8;

export type SizeTier = "small_standard" | "large_standard" | "large_bulky";

export const SIZE_TIERS: { value: SizeTier; label: string }[] = [
  { value: "small_standard", label: "Small standard (<=15x12x0.75in, <=1lb)" },
  { value: "large_standard", label: "Large standard (<=18x14x8in, <=20lb)" },
  { value: "large_bulky", label: "Large bulky / oversize" },
];

// Fulfillment fee tiers by weight (oz) for small/large standard, in ascending order.
const SMALL_STANDARD_TIERS = [
  { maxOz: 2, fee: 3.06 },
  { maxOz: 4, fee: 3.15 },
  { maxOz: 6, fee: 3.24 },
  { maxOz: 10, fee: 3.35 },
  { maxOz: 16, fee: 3.68 },
];

const LARGE_STANDARD_TIERS = [
  { maxOz: 4, fee: 3.68 },
  { maxOz: 8, fee: 3.9 },
  { maxOz: 12, fee: 4.15 },
  { maxOz: 20, fee: 4.55 }, // up to 1lb4oz
  { maxOz: 24, fee: 4.99 }, // up to 1lb8oz
  { maxOz: 28, fee: 5.36 }, // up to 1lb12oz
  { maxOz: 36, fee: 5.85 }, // up to 2lb4oz
  { maxOz: 48, fee: 6.3 }, // up to 3lb
];
const LARGE_STANDARD_PER_LB_OVER_3 = 0.16;

const LARGE_BULKY_BASE_FEE = 9.61; // up to 1lb
const LARGE_BULKY_PER_LB_OVER_1 = 0.38;

export interface FulfillmentInput {
  sizeTier: SizeTier;
  weightOz: number;
}

export function calculateFulfillmentFee({ sizeTier, weightOz }: FulfillmentInput): number {
  if (weightOz <= 0) return 0;

  if (sizeTier === "small_standard") {
    const tier = SMALL_STANDARD_TIERS.find((t) => weightOz <= t.maxOz);
    return tier ? tier.fee : SMALL_STANDARD_TIERS[SMALL_STANDARD_TIERS.length - 1].fee;
  }

  if (sizeTier === "large_standard") {
    const tier = LARGE_STANDARD_TIERS.find((t) => weightOz <= t.maxOz);
    if (tier) return tier.fee;
    const lbOver3 = Math.ceil((weightOz - 48) / 16);
    return LARGE_STANDARD_TIERS[LARGE_STANDARD_TIERS.length - 1].fee + lbOver3 * LARGE_STANDARD_PER_LB_OVER_3;
  }

  // large_bulky
  if (weightOz <= 16) return LARGE_BULKY_BASE_FEE;
  const lbOver1 = Math.ceil((weightOz - 16) / 16);
  return LARGE_BULKY_BASE_FEE + lbOver1 * LARGE_BULKY_PER_LB_OVER_1;
}

// Monthly storage fee per cubic foot (standard-size items).
const STORAGE_RATE_PER_CUFT = {
  standard: { peak: 2.4, offPeak: 0.87 },
  oversize: { peak: 1.4, offPeak: 0.56 },
};

export interface StorageInput {
  sizeTier: SizeTier;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  season: "peak" | "offPeak";
}

export function calculateMonthlyStorageFeePerUnit({
  sizeTier,
  lengthIn,
  widthIn,
  heightIn,
  season,
}: StorageInput): number {
  const cubicFeet = (lengthIn * widthIn * heightIn) / 1728;
  const rates = sizeTier === "large_bulky" ? STORAGE_RATE_PER_CUFT.oversize : STORAGE_RATE_PER_CUFT.standard;
  return cubicFeet * rates[season];
}

export interface CalculatorInput {
  sellingPrice: number;
  productCost: number;
  category: Category;
  sizeTier: SizeTier;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  inboundShippingPerUnit: number;
  monthlyUnitsSold: number;
  storageSeason: "peak" | "offPeak";
}

export interface CalculatorResult {
  referralFee: number;
  fulfillmentFee: number;
  storageFeePerUnit: number;
  closingFee: number;
  totalFees: number;
  totalCostPerUnit: number;
  netProfitPerUnit: number;
  marginPct: number;
  roiPct: number;
  breakEvenUnits: number;
}

export function calculateFbaEconomics(input: CalculatorInput): CalculatorResult {
  const referralPct = REFERRAL_FEE_PCT[input.category];
  const referralFee = Math.max(input.sellingPrice * referralPct, REFERRAL_FEE_MINIMUM);
  const fulfillmentFee = calculateFulfillmentFee({ sizeTier: input.sizeTier, weightOz: input.weightOz });
  const monthlyStorageFee = calculateMonthlyStorageFeePerUnit({
    sizeTier: input.sizeTier,
    lengthIn: input.lengthIn,
    widthIn: input.widthIn,
    heightIn: input.heightIn,
    season: input.storageSeason,
  });
  const storageFeePerUnit = input.monthlyUnitsSold > 0 ? monthlyStorageFee / input.monthlyUnitsSold : monthlyStorageFee;
  const closingFee = input.category === "books_media" ? MEDIA_CLOSING_FEE : 0;

  const totalFees = referralFee + fulfillmentFee + storageFeePerUnit + closingFee;
  const totalCostPerUnit = input.productCost + input.inboundShippingPerUnit + totalFees;
  const netProfitPerUnit = input.sellingPrice - totalCostPerUnit;
  const marginPct = input.sellingPrice > 0 ? (netProfitPerUnit / input.sellingPrice) * 100 : 0;
  const investmentPerUnit = input.productCost + input.inboundShippingPerUnit;
  const roiPct = investmentPerUnit > 0 ? (netProfitPerUnit / investmentPerUnit) * 100 : 0;
  const breakEvenUnits = netProfitPerUnit > 0 ? Math.ceil(investmentPerUnit / netProfitPerUnit) : 0;

  return {
    referralFee,
    fulfillmentFee,
    storageFeePerUnit,
    closingFee,
    totalFees,
    totalCostPerUnit,
    netProfitPerUnit,
    marginPct,
    roiPct,
    breakEvenUnits,
  };
}

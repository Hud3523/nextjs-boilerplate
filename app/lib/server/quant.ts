// Pure quantitative helpers for the Polymarket edge scanner. No network here so
// the math is unit-testable in isolation. Nothing in here "proves" a winner —
// it estimates probabilities and the resulting edge / optimal sizing.

/** Standard normal CDF via Abramowitz & Stegun 7.1.26 approximation. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/**
 * Risk-neutral-ish probability that a GBM asset finishes ABOVE strike K.
 * ln(S_T) ~ N(ln S0 + (mu - sigma^2/2)T, sigma^2 T). Default drift mu = 0 so we
 * don't bake in a directional view — volatility + time-to-resolution do the work.
 * @param spot current price S0
 * @param strike threshold K
 * @param vol annualized volatility (e.g. 0.6 = 60%)
 * @param years time to resolution in years
 * @param drift annualized drift (default 0)
 */
export function probAbove(
  spot: number,
  strike: number,
  vol: number,
  years: number,
  drift = 0
): number {
  if (spot <= 0 || strike <= 0 || vol <= 0 || years <= 0) return NaN;
  const d2 =
    (Math.log(spot / strike) + (drift - (vol * vol) / 2) * years) /
    (vol * Math.sqrt(years));
  return normCdf(d2);
}

export const probBelow = (
  spot: number,
  strike: number,
  vol: number,
  years: number,
  drift = 0
) => 1 - probAbove(spot, strike, vol, years, drift);

/** Annualized volatility from a series of prices (newest-first or oldest-first). */
export function annualizedVol(prices: number[], periodsPerYear = 365): number {
  if (prices.length < 3) return NaN;
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1];
    const b = prices[i];
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 2) return NaN;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

export interface EdgeResult {
  side: "YES" | "NO";
  marketProb: number; // implied prob of the chosen side
  modelProb: number; // model prob of the chosen side
  edge: number; // modelProb - marketProb (>=0 for the chosen side)
  evPerDollar: number; // expected return per $1 staked on the chosen side
  kelly: number; // full Kelly fraction of bankroll
  halfKelly: number; // recommended (half Kelly), capped at 0.25
}

/**
 * Given the market's YES price (0..1) and a model probability of YES, decide the
 * better side and compute edge, EV and Kelly sizing for a binary 0/1 payout.
 */
export function computeEdge(yesPrice: number, modelYes: number): EdgeResult | null {
  if (!(yesPrice > 0 && yesPrice < 1) || !(modelYes >= 0 && modelYes <= 1)) return null;

  const betYes = modelYes >= yesPrice;
  const p = betYes ? yesPrice : 1 - yesPrice; // price of chosen side
  const q = betYes ? modelYes : 1 - modelYes; // model prob of chosen side
  if (p <= 0 || p >= 1) return null;

  const edge = q - p;
  const evPerDollar = (q - p) / p; // each $1 buys 1/p shares worth q expected
  const kelly = (q - p) / (1 - p); // Kelly for binary at price p
  const halfKelly = Math.max(0, Math.min(0.25, kelly / 2));

  return {
    side: betYes ? "YES" : "NO",
    marketProb: p,
    modelProb: q,
    edge,
    evPerDollar,
    kelly,
    halfKelly,
  };
}

/** Detect over/under-round mispricing when outcome prices don't sum to ~1. */
export function priceSumMispricing(prices: number[]): {
  sum: number;
  type: "underround" | "overround" | "fair";
} {
  const sum = prices.reduce((s, p) => s + p, 0);
  if (sum < 0.985) return { sum, type: "underround" };
  if (sum > 1.015) return { sum, type: "overround" };
  return { sum, type: "fair" };
}

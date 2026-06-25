import { fetchActiveMarkets, type PolyMarket } from "./gamma";
import { fetchQuote, fetchCandles } from "./connectors/tradingview";
import { withTimeout, errMsg } from "./connectors/types";
import {
  annualizedVol,
  computeEdge,
  probAbove,
  probBelow,
  priceSumMispricing,
  type EdgeResult,
} from "./quant";

// Polymarket edge scanner. For crypto threshold markets it derives a model
// probability from live TradingView price + realized volatility, then compares
// it to the market price to estimate edge and Kelly sizing. For other markets it
// still flags pricing inconsistencies. Nothing here guarantees a win.

const ASSETS: { re: RegExp; tvSymbol: string }[] = [
  { re: /\b(bitcoin|btc)\b/i, tvSymbol: "BINANCE:BTCUSDT" },
  { re: /\b(ethereum|ether|eth)\b/i, tvSymbol: "BINANCE:ETHUSDT" },
  { re: /\b(solana|sol)\b/i, tvSymbol: "BINANCE:SOLUSDT" },
  { re: /\b(ripple|xrp)\b/i, tvSymbol: "BINANCE:XRPUSDT" },
  { re: /\b(dogecoin|doge)\b/i, tvSymbol: "BINANCE:DOGEUSDT" },
  { re: /\b(bnb)\b/i, tvSymbol: "BINANCE:BNBUSDT" },
];

const ABOVE_WORDS = /\b(above|over|reach|hit|exceed|higher|surpass|more than|greater)\b/i;
const BELOW_WORDS = /\b(below|under|dip|drop|fall|less than|lower)\b/i;

interface ThresholdSpec {
  tvSymbol: string;
  strike: number;
  direction: "above" | "below";
}

function parseThreshold(question: string): ThresholdSpec | null {
  const asset = ASSETS.find((a) => a.re.test(question));
  if (!asset) return null;

  // Find a dollar amount like $150,000 or $4k.
  const m = question.match(/\$\s?([\d,]+(?:\.\d+)?)\s?(k|m)?/i);
  if (!m) return null;
  let strike = parseFloat(m[1].replace(/,/g, ""));
  if (m[2]?.toLowerCase() === "k") strike *= 1_000;
  if (m[2]?.toLowerCase() === "m") strike *= 1_000_000;
  if (!Number.isFinite(strike) || strike <= 0) return null;

  const direction: "above" | "below" = BELOW_WORDS.test(question) && !ABOVE_WORDS.test(question)
    ? "below"
    : "above";

  return { tvSymbol: asset.tvSymbol, strike, direction };
}

function yearsUntil(endDate?: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const years = (end - Date.now()) / (365 * 24 * 3600 * 1000);
  return years > 0 ? years : null;
}

function yesPriceOf(m: PolyMarket): number | null {
  const idx = m.outcomes.findIndex((o) => o.toLowerCase() === "yes");
  const i = idx >= 0 ? idx : 0;
  const price = m.outcomePrices[i];
  return price > 0 && price < 1 ? price : null;
}

export interface Opportunity {
  id: string;
  question: string;
  slug?: string;
  volume: number;
  liquidity: number;
  endDate?: string;
  impliedYes: number; // market-implied prob of YES
  mispricing?: { sum: number; type: "underround" | "overround" | "fair" };
  model?: {
    spot: number;
    vol: number;
    years: number;
    modelYes: number;
    edge: EdgeResult;
  };
  rank: number; // composite score used for ordering
  reasons: string[];
}

export interface EdgeScanResult {
  opportunities: Opportunity[];
  scanned: number;
  modeled: number;
  errors: { question: string; error: string }[];
  generatedAt: string;
}

/** Scan active Polymarket markets and return the top N opportunities. */
export async function scanEdges(top = 4, marketLimit = 60): Promise<EdgeScanResult> {
  const markets = await withTimeout(fetchActiveMarkets(marketLimit), 15000, "Gamma markets");
  const errors: { question: string; error: string }[] = [];
  // Cache spot + vol per asset across the scan.
  const assetCache = new Map<string, { spot: number; vol: number }>();

  async function assetStats(tvSymbol: string) {
    const cached = assetCache.get(tvSymbol);
    if (cached) return cached;
    const [quote, candles] = await Promise.all([
      withTimeout(fetchQuote(tvSymbol), 9000, `quote ${tvSymbol}`),
      withTimeout(fetchCandles(tvSymbol, 120), 12000, `candles ${tvSymbol}`),
    ]);
    const spot = quote.price ?? candles[candles.length - 1]?.close;
    const vol = annualizedVol(candles.map((c) => c.close));
    const stats = { spot: spot as number, vol };
    assetCache.set(tvSymbol, stats);
    return stats;
  }

  const opportunities: Opportunity[] = [];
  let modeled = 0;

  for (const m of markets) {
    const impliedYes = yesPriceOf(m);
    if (impliedYes == null) continue;

    const mispricing = priceSumMispricing(m.outcomePrices);
    const reasons: string[] = [];
    let rank = 0;
    let model: Opportunity["model"];

    if (mispricing.type !== "fair") {
      reasons.push(`Prices sum to ${mispricing.sum.toFixed(3)} (${mispricing.type})`);
      rank += 0.2;
    }

    const spec = parseThreshold(m.question);
    if (spec) {
      try {
        const { spot, vol } = await assetStats(spec.tvSymbol);
        const years = yearsUntil(m.endDate);
        if (spot > 0 && vol > 0 && years && years > 0) {
          const modelYes =
            spec.direction === "above"
              ? probAbove(spot, spec.strike, vol, years)
              : probBelow(spot, spec.strike, vol, years);
          const edge = computeEdge(impliedYes, modelYes);
          if (edge && Number.isFinite(modelYes)) {
            model = { spot, vol, years, modelYes, edge };
            modeled += 1;
            reasons.push(
              `Model: ${spec.tvSymbol.split(":")[1]} spot $${spot.toLocaleString()}, ` +
                `${(vol * 100).toFixed(0)}% vol, ${years.toFixed(2)}y -> P(${spec.direction} $${spec.strike.toLocaleString()})=${(modelYes * 100).toFixed(0)}%`
            );
            reasons.push(
              `Market implies ${(impliedYes * 100).toFixed(0)}% -> ${edge.side} edge ${(edge.edge * 100).toFixed(1)}pts, ` +
                `EV ${(edge.evPerDollar * 100).toFixed(0)}%, half-Kelly ${(edge.halfKelly * 100).toFixed(1)}% of bankroll`
            );
            // Conviction-weighted by liquidity so thin markets rank lower.
            const liqFactor = Math.min(1, m.liquidity / 50000);
            rank += Math.abs(edge.edge) * (0.5 + 0.5 * liqFactor) * edge.modelProb;
          }
        }
      } catch (e) {
        errors.push({ question: m.question, error: errMsg(e) });
      }
    }

    opportunities.push({
      id: m.id,
      question: m.question,
      slug: m.slug,
      volume: m.volume,
      liquidity: m.liquidity,
      endDate: m.endDate,
      impliedYes,
      mispricing,
      model,
      rank,
      reasons,
    });
  }

  opportunities.sort((a, b) => b.rank - a.rank);

  return {
    opportunities: opportunities.slice(0, top),
    scanned: markets.length,
    modeled,
    errors,
    generatedAt: new Date().toISOString(),
  };
}

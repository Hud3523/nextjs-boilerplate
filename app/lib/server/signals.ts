import { fetchCandles, type Candle } from "./connectors/tradingview";
import { withTimeout, errMsg } from "./connectors/types";
import { sma, ema, rsi, roc, macd, clamp } from "./indicators";

// TradingView signals engine — a small "quant desk". For each symbol it computes
// standard indicators, blends them into one conviction score, and labels a
// BUY/SELL/HOLD with reasoning. NOT financial advice; signals can be wrong.

export const DEFAULT_WATCHLIST = [
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "BINANCE:SOLUSDT",
  "BINANCE:BNBUSDT",
  "BINANCE:XRPUSDT",
  "BINANCE:DOGEUSDT",
  "BINANCE:AVAXUSDT",
  "BINANCE:LINKUSDT",
];

export type Action = "BUY" | "SELL" | "HOLD";

export interface Signal {
  symbol: string;
  action: Action;
  score: number; // -1..1, sign = direction, magnitude = conviction
  confidence: number; // 0..100
  price: number;
  changePct: number; // last-bar % change
  rsi: number | null;
  reasons: string[];
}

function buildSignal(symbol: string, candles: Candle[]): Signal | null {
  const closes = candles.map((c) => c.close).filter((v) => typeof v === "number");
  if (closes.length < 30) return null;

  const price = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const changePct = prev ? ((price - prev) / prev) * 100 : 0;

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50) ?? sma(closes, Math.min(50, closes.length - 1));
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const r = rsi(closes, 14);
  const mom = roc(closes, 10);
  const mac = macd(closes);

  const reasons: string[] = [];
  let score = 0;

  // 1) Trend: fast MA vs slow MA.
  if (sma20 != null && sma50 != null) {
    if (sma20 > sma50) {
      score += 0.3;
      reasons.push("Uptrend: SMA20 > SMA50");
    } else {
      score -= 0.3;
      reasons.push("Downtrend: SMA20 < SMA50");
    }
  }

  // 2) Price vs SMA50.
  if (sma50 != null) {
    if (price > sma50) {
      score += 0.15;
      reasons.push("Price above SMA50");
    } else {
      score -= 0.15;
      reasons.push("Price below SMA50");
    }
  }

  // 3) MACD direction.
  if (mac != null) {
    if (mac > 0) {
      score += 0.15;
      reasons.push("MACD positive");
    } else {
      score -= 0.15;
      reasons.push("MACD negative");
    }
  } else if (ema12 != null && ema26 != null) {
    score += ema12 > ema26 ? 0.15 : -0.15;
  }

  // 4) Momentum (10-bar ROC).
  if (mom != null) {
    score += clamp(mom / 40, -0.2, 0.2);
    reasons.push(`10d momentum ${mom.toFixed(1)}%`);
  }

  // 5) RSI mean-reversion: oversold favors buy, overbought favors sell.
  if (r != null) {
    if (r < 30) {
      score += 0.2;
      reasons.push(`RSI ${r.toFixed(0)} (oversold)`);
    } else if (r > 70) {
      score -= 0.2;
      reasons.push(`RSI ${r.toFixed(0)} (overbought)`);
    } else {
      reasons.push(`RSI ${r.toFixed(0)} (neutral)`);
    }
  }

  score = clamp(score, -1, 1);
  const action: Action = score > 0.25 ? "BUY" : score < -0.25 ? "SELL" : "HOLD";
  const confidence = Math.round(Math.abs(score) * 100);

  return { symbol, action, score, confidence, price, changePct, rsi: r, reasons };
}

export interface SignalsResult {
  signals: Signal[]; // top picks (strongest conviction)
  scanned: number;
  errors: { symbol: string; error: string }[];
  generatedAt: string;
}

/** Scan a watchlist and return the top N strongest-conviction signals. */
export async function scanSignals(
  watchlist: string[] = DEFAULT_WATCHLIST,
  top = 4
): Promise<SignalsResult> {
  const errors: { symbol: string; error: string }[] = [];
  const signals: Signal[] = [];

  // Sequential to be gentle on the TradingView websocket.
  for (const symbol of watchlist) {
    try {
      const candles = await withTimeout(fetchCandles(symbol, 120), 12000, `candles ${symbol}`);
      const sig = buildSignal(symbol, candles);
      if (sig) signals.push(sig);
    } catch (e) {
      errors.push({ symbol, error: errMsg(e) });
    }
  }

  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return {
    signals: signals.slice(0, top),
    scanned: watchlist.length,
    errors,
    generatedAt: new Date().toISOString(),
  };
}

import TradingView from "@mathieuc/tradingview";
import { env } from "../env";
import {
  errMsg,
  withTimeout,
  type HealthResult,
  type ServerConnector,
  type TestResult,
} from "./types";

// Realtime quotes via @mathieuc/tradingview. A TradingView session token is
// OPTIONAL for public symbols; it's only needed for premium/private data.

export interface Quote {
  symbol: string;
  price?: number; // lp = last price
  change?: number; // ch
  changePercent?: number; // chp
  volume?: number;
  description?: string;
  currency?: string;
}

/**
 * Open a websocket, subscribe to one symbol, resolve on the first data packet,
 * then tear everything down. Resolves quickly because we only need one tick.
 */
export function fetchQuote(symbol: string): Promise<Quote> {
  return new Promise<Quote>((resolve, reject) => {
    const token = env("TV_SESSION");
    const signature = env("TV_SIGNATURE");

    let settled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;

    const cleanup = () => {
      try {
        client?.end?.();
      } catch {
        /* ignore */
      }
    };
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    try {
      client = new TradingView.Client(token ? { token, signature } : {});
      const quoteSession = new client.Session.Quote({ fields: "all" });
      const market = new quoteSession.Market(symbol);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      market.onData((data: any) => {
        done(() =>
          resolve({
            symbol,
            price: data.lp,
            change: data.ch,
            changePercent: data.chp,
            volume: data.volume,
            description: data.description,
            currency: data.currency_code,
          })
        );
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      market.onError((...err: any[]) =>
        done(() => reject(new Error(errMsg(err[0] ?? "quote error"))))
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.onError?.((...err: any[]) =>
        done(() => reject(new Error(errMsg(err[0] ?? "client error"))))
      );
    } catch (e) {
      done(() => reject(e));
    }
  });
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch historical daily candles for a symbol. Opens a chart session, waits for
 * the candle stream to settle, then returns candles oldest -> newest.
 */
export function fetchCandles(symbol: string, range = 150): Promise<Candle[]> {
  return new Promise<Candle[]>((resolve, reject) => {
    const token = env("TV_SESSION");
    const signature = env("TV_SIGNATURE");

    let settled = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any;

    const cleanup = () => {
      if (debounce) clearTimeout(debounce);
      try {
        chart?.delete?.();
      } catch {
        /* ignore */
      }
      try {
        client?.end?.();
      } catch {
        /* ignore */
      }
    };
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toCandles = (periods: any[]): Candle[] =>
      [...periods]
        .map((p) => ({
          time: p.time,
          open: p.open,
          high: p.max,
          low: p.min,
          close: p.close,
          volume: p.volume,
        }))
        .sort((a, b) => a.time - b.time);

    try {
      client = new TradingView.Client(token ? { token, signature } : {});
      chart = new client.Session.Chart();
      chart.setMarket(symbol, { timeframe: "D", range });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chart.onError((...err: any[]) =>
        finish(() => reject(new Error(errMsg(err[0] ?? "chart error"))))
      );
      // Fast-fail on client/websocket errors instead of waiting for the timeout.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.onError?.((...err: any[]) =>
        finish(() => reject(new Error(errMsg(err[0] ?? "client error"))))
      );

      chart.onUpdate(() => {
        const periods = chart.periods as unknown[];
        if (!periods || periods.length === 0) return;
        // Resolve once the stream goes quiet for 700ms.
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finish(() => resolve(toCandles(chart.periods as any[])));
        }, 700);
      });
    } catch (e) {
      finish(() => reject(e));
    }
  });
}

export const tradingviewConnector: ServerConnector = {
  id: "tradingview",

  configured() {
    // Works without credentials for public symbols.
    return true;
  },

  async health(): Promise<HealthResult> {
    const start = Date.now();
    try {
      const q = await withTimeout(fetchQuote("BINANCE:BTCUSDT"), 9000, "TradingView quote");
      const latencyMs = Date.now() - start;
      if (q.price == null) {
        return { status: "degraded", detail: "Connected but no price field", latencyMs };
      }
      const auth = env("TV_SESSION") ? "authenticated" : "anonymous";
      return { status: "healthy", detail: `BTCUSDT ${q.price} (${auth})`, latencyMs };
    } catch (e) {
      return { status: "offline", detail: errMsg(e), latencyMs: Date.now() - start };
    }
  },

  async test(params): Promise<TestResult> {
    const start = Date.now();
    const symbol = typeof params?.symbol === "string" ? params.symbol : "BINANCE:BTCUSDT";
    try {
      const q = await withTimeout(fetchQuote(symbol), 9000, "TradingView quote");
      return { ok: true, data: q, latencyMs: Date.now() - start };
    } catch (e) {
      return { ok: false, error: errMsg(e), latencyMs: Date.now() - start };
    }
  },
};

import { env } from "./env";

// Polymarket public market data via the Gamma API (no auth needed for reads).
// This is the right source for live YES/NO prices; the Bitquery connector is for
// on-chain trade history.

const GAMMA = env("GAMMA_API") ?? "https://gamma-api.polymarket.com";

export interface PolyMarket {
  id: string;
  question: string;
  slug?: string;
  endDate?: string;
  volume: number;
  liquidity: number;
  outcomes: string[];
  outcomePrices: number[];
}

// Gamma returns some fields as JSON-encoded strings; parse defensively.
function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(m: any): PolyMarket | null {
  if (!m?.question) return null;
  const outcomes = asArray(m.outcomes).map((o) => String(o));
  const outcomePrices = asArray(m.outcomePrices).map((p) => num(p));
  if (outcomes.length === 0 || outcomePrices.length !== outcomes.length) return null;
  return {
    id: String(m.id ?? m.conditionId ?? m.slug ?? m.question),
    question: String(m.question),
    slug: m.slug ? String(m.slug) : undefined,
    endDate: m.endDate ?? m.endDateIso ?? undefined,
    volume: num(m.volumeNum ?? m.volume),
    liquidity: num(m.liquidityNum ?? m.liquidity),
    outcomes,
    outcomePrices,
  };
}

/** Fetch the most active open markets, sorted by volume desc. */
export async function fetchActiveMarkets(limit = 60): Promise<PolyMarket[]> {
  const url = `${GAMMA}/markets?active=true&closed=false&limit=${limit}&order=volumeNum&ascending=false`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Gamma HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data?.markets ?? data?.data ?? []);
  return list
    .map(normalize)
    .filter((m: PolyMarket | null): m is PolyMarket => m !== null)
    .sort((a: PolyMarket, b: PolyMarket) => b.volume - a.volume);
}

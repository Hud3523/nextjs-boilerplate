import { env } from "../env";
import {
  errMsg,
  withTimeout,
  type HealthResult,
  type ServerConnector,
  type TestResult,
} from "./types";

// Polymarket data via Bitquery's GraphQL APIs (the approach used by
// bitquery/polymarket-api). Polymarket runs on Polygon (matic); we query
// Bitquery's EAP streaming endpoint with a Bearer OAuth token.

const BITQUERY_ENDPOINT =
  env("BITQUERY_ENDPOINT") ?? "https://streaming.bitquery.io/graphql";

// Connectivity probe — proves auth + pipe without depending on Polymarket schema.
const PING_QUERY = `query {
  EVM(network: matic) {
    Blocks(limit: { count: 1 }, orderBy: { descending: Block_Number }) {
      Block { Number Time }
    }
  }
}`;

// Representative Polymarket query: recent trades on the Polymarket CTF Exchange
// on Polygon. Swap in any query from bitquery/polymarket-api here.
const POLYMARKET_TRADES_QUERY = `query ($limit: Int!) {
  EVM(network: matic, dataset: combined) {
    DEXTrades(
      limit: { count: $limit }
      orderBy: { descending: Block_Time }
      where: { Trade: { Dex: { ProtocolName: { is: "polymarket" } } } }
    ) {
      Block { Time }
      Trade {
        Buy { Amount Currency { Symbol SmartContract } }
        Sell { Amount Currency { Symbol SmartContract } }
      }
    }
  }
}`;

async function bitquery(query: string, variables?: Record<string, unknown>) {
  const token = env("BITQUERY_OAUTH_TOKEN");
  if (!token) throw new Error("BITQUERY_OAUTH_TOKEN not set");

  const res = await fetch(BITQUERY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join("; "));
  }
  return json.data;
}

export const polymarketConnector: ServerConnector = {
  id: "polymarket",

  configured() {
    return env("BITQUERY_OAUTH_TOKEN") !== undefined;
  },

  async health(): Promise<HealthResult> {
    if (!this.configured()) {
      return { status: "unconfigured", detail: "Set BITQUERY_OAUTH_TOKEN" };
    }
    const start = Date.now();
    try {
      const data = await withTimeout(bitquery(PING_QUERY), 9000, "Bitquery ping");
      const block = data?.EVM?.Blocks?.[0]?.Block?.Number;
      return {
        status: "healthy",
        detail: block ? `Polygon block #${block}` : "Connected",
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return { status: "offline", detail: errMsg(e), latencyMs: Date.now() - start };
    }
  },

  async test(params): Promise<TestResult> {
    if (!this.configured()) {
      return { ok: false, error: "BITQUERY_OAUTH_TOKEN not set" };
    }
    const start = Date.now();
    const limit = typeof params?.limit === "number" ? params.limit : 5;
    try {
      const data = await withTimeout(
        bitquery(POLYMARKET_TRADES_QUERY, { limit }),
        12000,
        "Bitquery Polymarket trades"
      );
      return { ok: true, data, latencyMs: Date.now() - start };
    } catch (e) {
      // Fall back to the ping query so a schema mismatch still proves the pipe.
      try {
        const ping = await withTimeout(bitquery(PING_QUERY), 9000, "Bitquery ping");
        return {
          ok: true,
          data: { note: "Trades query failed; connectivity confirmed", ping, error: errMsg(e) },
          latencyMs: Date.now() - start,
        };
      } catch (e2) {
        return { ok: false, error: errMsg(e2), latencyMs: Date.now() - start };
      }
    }
  },
};

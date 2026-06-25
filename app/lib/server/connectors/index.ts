import { tradingviewConnector } from "./tradingview";
import { polymarketConnector } from "./polymarket";
import { openclawConnector } from "./openclaw";
import { hermesConnector } from "./hermes";
import type { ServerConnector } from "./types";

// Live connector registry. Adding a capability = adding an adapter here.
export const serverConnectors: Record<string, ServerConnector> = {
  tradingview: tradingviewConnector,
  polymarket: polymarketConnector,
  openclaw: openclawConnector,
  hermes: hermesConnector,
};

export function getServerConnector(id: string): ServerConnector | undefined {
  return serverConnectors[id];
}

export const LIVE_CONNECTOR_IDS = Object.keys(serverConnectors);

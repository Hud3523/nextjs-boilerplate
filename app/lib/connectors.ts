import type { Connector } from "./types";

// The Tool Manager registry. Connectors are the ONLY way agents reach external
// services — nothing is hardcoded. Adding a capability = adding an entry here
// (and, later, its server-side adapter). These four wire the user's linked
// repos; the rest of the recommended catalog lives in docs/CONNECTORS.md.

export const connectors: Connector[] = [
  {
    id: "tradingview",
    name: "TradingView Market Data",
    version: "0.1.0",
    category: "market-data",
    description:
      "Realtime market prices + indicator values used by Research to find demand and timing signals.",
    repo: "Mathieu2301/Tradingview-API",
    permissions: ["read:market-data", "read:indicators"],
    requiredCredentials: [
      { key: "TV_SESSION", label: "TradingView session token", required: false, secret: true },
      { key: "TV_SIGNATURE", label: "TradingView session signature", required: false, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "in-process",
  },
  {
    id: "polymarket",
    name: "Polymarket (Bitquery)",
    version: "0.1.0",
    category: "market-data",
    description:
      "Prediction-market sentiment + odds. Research uses it to gauge demand and resolve outcome questions.",
    repo: "bitquery/polymarket-api",
    permissions: ["read:markets", "read:trades"],
    requiredCredentials: [
      { key: "BITQUERY_OAUTH_TOKEN", label: "Bitquery OAuth token", required: true, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "in-process",
  },
  {
    id: "openclaw",
    name: "OpenClaw Runtime",
    version: "0.1.0",
    category: "agent-runtime",
    description:
      "Tool execution, browser automation and workflow runner. Powers actions with no official API (e.g. Fiverr listings).",
    repo: "openclaw/openclaw",
    permissions: ["exec:tools", "automate:browser", "run:workflows"],
    requiredCredentials: [
      { key: "OPENCLAW_BASE_URL", label: "OpenClaw service URL", required: true, secret: false },
      { key: "OPENCLAW_API_KEY", label: "OpenClaw API key", required: true, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "external-service",
  },
  {
    id: "hermes",
    name: "Hermes Agent Framework",
    version: "0.1.0",
    category: "reasoning",
    description:
      "Long-term memory, skills and cross-provider model routing. AI Core delegates persistent reasoning to it.",
    repo: "nousresearch/hermes-agent",
    permissions: ["read:memory", "write:memory", "route:models", "run:subagents"],
    requiredCredentials: [
      { key: "HERMES_BASE_URL", label: "Hermes service URL", required: true, secret: false },
      { key: "HERMES_API_KEY", label: "Hermes API key", required: true, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "external-service",
  },

  // Recommended next connectors (stubbed) — the capabilities agents need to
  // actually publish/sell. Documented in detail in docs/CONNECTORS.md.
  {
    id: "youtube",
    name: "YouTube Publishing",
    version: "0.0.0",
    category: "media",
    description: "Upload + schedule videos via YouTube Data API v3 (OAuth, resumable upload).",
    permissions: ["upload:video", "manage:metadata"],
    requiredCredentials: [
      { key: "YT_CLIENT_ID", label: "OAuth client id", required: true, secret: false },
      { key: "YT_CLIENT_SECRET", label: "OAuth client secret", required: true, secret: true },
      { key: "YT_REFRESH_TOKEN", label: "OAuth refresh token", required: true, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "in-process",
  },
  {
    id: "etsy",
    name: "Etsy Listings",
    version: "0.0.0",
    category: "commerce",
    description: "Create listings + upload product images via Etsy Open API v3 (OAuth2).",
    permissions: ["manage:listings", "upload:images"],
    requiredCredentials: [
      { key: "ETSY_API_KEY", label: "Etsy keystring", required: true, secret: true },
      { key: "ETSY_OAUTH_TOKEN", label: "OAuth2 access token", required: true, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "in-process",
  },
  {
    id: "fiverr",
    name: "Fiverr (via OpenClaw)",
    version: "0.0.0",
    category: "commerce",
    description: "No public seller API — managed through OpenClaw browser automation with human approval. Review ToS.",
    repo: "openclaw/openclaw",
    permissions: ["automate:browser", "require:approval"],
    requiredCredentials: [
      { key: "FIVERR_SESSION", label: "Authenticated browser session (managed by OpenClaw)", required: true, secret: true },
    ],
    health: "unconfigured",
    enabled: false,
    callsToday: 0,
    errorRate: 0,
    integration: "external-service",
  },
];

// Connectors with a live server-side adapter (real health checks + test calls).
// Keep in sync with app/lib/server/connectors/index.ts.
export const liveConnectorIds = ["tradingview", "polymarket", "openclaw", "hermes"];

export const connectorCategoryLabels: Record<string, string> = {
  "market-data": "Market Data",
  "agent-runtime": "Agent Runtime",
  reasoning: "Reasoning & Memory",
  media: "Media",
  commerce: "Commerce",
  communication: "Communication",
  storage: "Storage",
};

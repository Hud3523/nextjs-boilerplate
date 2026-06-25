import { NextResponse } from "next/server";
import { serverConnectors } from "@/app/lib/server/connectors";
import { errMsg, type HealthResult } from "@/app/lib/server/connectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/connectors -> live health + configured flag for every wired connector.
// Returns no secrets: only status, detail and configured boolean.
export async function GET() {
  const ids = Object.keys(serverConnectors);

  const results = await Promise.all(
    ids.map(async (id) => {
      const c = serverConnectors[id];
      let health: HealthResult;
      try {
        health = await c.health();
      } catch (e) {
        health = { status: "offline", detail: errMsg(e) };
      }
      return { id, configured: c.configured(), health };
    })
  );

  return NextResponse.json(
    { connectors: results, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

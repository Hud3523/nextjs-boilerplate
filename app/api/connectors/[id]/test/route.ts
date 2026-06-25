import { NextResponse } from "next/server";
import { getServerConnector } from "@/app/lib/server/connectors";
import { errMsg } from "@/app/lib/server/connectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/connectors/:id/test -> runs the connector's representative
// capability and returns a sample result (e.g. a live quote or recent trades).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const connector = getServerConnector(id);
  if (!connector) {
    return NextResponse.json({ ok: false, error: `Unknown connector: ${id}` }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    /* ignore malformed body, run with defaults */
  }

  try {
    const result = await connector.test(body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

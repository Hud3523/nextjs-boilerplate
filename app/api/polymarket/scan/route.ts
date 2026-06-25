import { NextResponse } from "next/server";
import { scanEdges } from "@/app/lib/server/edge";
import { codeOk } from "@/app/lib/server/quantAuth";
import { errMsg } from "@/app/lib/server/connectors/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/polymarket/scan { code } -> top Polymarket edge opportunities.
// Gated by the quant code word.
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    /* defaults */
  }

  if (!codeOk(body.code)) {
    return NextResponse.json({ ok: false, error: "Locked. Enter the code word." }, { status: 401 });
  }

  try {
    const top = typeof body.top === "number" ? body.top : 4;
    const result = await scanEdges(top);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

import type { Request, Response } from "express";
import { bus, type ServerEvent } from "../bus.js";

/**
 * Server-Sent Events stream. The dashboard opens one connection and receives
 * every state change live (activity, tokens, tasks, agents, attention, ledger,
 * floors, agencies, seasons, …).
 */
export function sseHandler(req: Request, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 3000\n\n`);
  res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, ts: Date.now() })}\n\n`);

  const onEvent = (event: ServerEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  bus.on("event", onEvent);

  // Heartbeat keeps proxies from closing the idle connection.
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    bus.off("event", onEvent);
  });
}

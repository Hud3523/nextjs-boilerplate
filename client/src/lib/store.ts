import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";
import type { Snapshot } from "../types";

export interface LiveToken { taskId: string; agentId: string; text: string; ts: number; }

/**
 * Single source of truth for the dashboard: loads the full snapshot, then
 * listens on the SSE stream and debounce-refetches on state changes. Token
 * events feed a live streaming buffer for the activity feed.
 */
export function useMissionControl() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [stream, setStream] = useState<Record<string, string>>({}); // taskId -> live text
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      setSnap(await api.state());
    } catch {
      /* transient */
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(reload, 250);
  }, [reload]);

  useEffect(() => {
    void reload();
    const es = new EventSource("/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      let evt: { type: string; payload: any };
      try { evt = JSON.parse(e.data); } catch { return; }
      if (evt.type === "token") {
        const { taskId, text } = evt.payload;
        setStream((s) => ({ ...s, [taskId]: (s[taskId] || "") + text }));
        return; // tokens don't trigger a refetch
      }
      scheduleReload();
    };
    return () => es.close();
  }, [reload, scheduleReload]);

  return { snap, connected, stream, reload };
}

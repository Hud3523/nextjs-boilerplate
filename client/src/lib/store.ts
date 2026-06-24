import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Snapshot } from "../types";

export function useDashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [stream, setStream] = useState<Record<string, string>>({});
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try { setSnap(await api.state()); } catch { /* transient */ }
  }, []);

  const schedule = useCallback(() => {
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
        return;
      }
      schedule();
    };
    return () => es.close();
  }, [reload, schedule]);

  return { snap, connected, stream, reload };
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent } from "../lib/types";
import { roomMap } from "../lib/data";

// Scrolling terminal-style activity feed (left column of the command deck).
// Emits timestamped status lines derived from the live crew simulation.

type LogLine = { id: number; t: string; agent: string; msg: string; tone: string };

const VERBS = [
  "ROUTING TASK",
  "QUERY COMPLETE",
  "SYNC OK",
  "EDGE +EV",
  "TOOL CALL",
  "MEM WRITE",
  "QA PASS",
  "SIGNAL FIRED",
  "DOCKED",
  "UPLINK",
];

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function ActivityLog({
  agents,
  meetingActive,
}: {
  agents: Agent[];
  meetingActive: boolean;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const idRef = useRef(0);
  const prevMeeting = useRef(false);
  // Hold the latest agents in a ref so the telemetry interval is set up ONCE.
  // (agents is a fresh array every animation frame; using it as an effect dep
  // would reset the interval ~60x/sec and it would never fire.)
  const agentsRef = useRef<Agent[]>(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // Periodic synthetic telemetry referencing real crew + rooms.
  useEffect(() => {
    const push = (agent: string, msg: string, tone = "var(--green)") => {
      idRef.current += 1;
      setLines((prev) =>
        [{ id: idRef.current, t: stamp(), agent, msg, tone }, ...prev].slice(0, 60)
      );
    };

    const iv = setInterval(() => {
      const crew = agentsRef.current;
      if (crew.length === 0) return;
      const a = crew[Math.floor(Math.random() * crew.length)];
      const room = roomMap[a.targetRoomId]?.name ?? "SHIP";
      const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
      const tone =
        verb.includes("EDGE") || verb.includes("SIGNAL")
          ? "#ff8c42"
          : verb.includes("FAIL")
            ? "#ff5252"
            : "var(--green)";
      push(a.name.toUpperCase(), `${verb} · ${room.toUpperCase()}`, tone);
    }, 1400);

    return () => clearInterval(iv);
  }, []);

  // React to all-hands transitions.
  useEffect(() => {
    if (meetingActive && !prevMeeting.current) {
      idRef.current += 1;
      setLines((prev) =>
        [
          { id: idRef.current, t: stamp(), agent: "SHIP", msg: "ALL-HANDS // MEETING HALL", tone: "#ff8c42" },
          ...prev,
        ].slice(0, 60)
      );
    }
    prevMeeting.current = meetingActive;
  }, [meetingActive]);

  return (
    <div className="glass crt-frame flex h-full flex-col overflow-hidden rounded-lg">
      <div className="border-b border-[var(--border-dim)] px-3 py-2 text-[0.7rem] font-bold tracking-widest text-[var(--green)] glow">
        ▌ACTIVITY LOG
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {lines.length === 0 && (
          <p className="px-1 text-[0.65rem] text-[var(--green-dim)]">{"// booting telemetry…"}</p>
        )}
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l.id} className="text-[0.62rem] leading-tight">
              <span className="text-[var(--green-dim)]">{l.t} </span>
              <span style={{ color: l.tone }}>{l.agent}</span>
              <span className="text-[var(--green-dim)]"> :: </span>
              <span className="text-[var(--foreground)]/80" style={{ color: l.tone }}>
                {l.msg}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-[var(--border-dim)] px-3 py-1.5 text-[0.6rem] tracking-widest text-[var(--green-dim)]">
        ░░ STREAMING ░░ {lines.length} EVENTS
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Agent } from "../lib/types";
import { GRID_W, GRID_H, departmentMap, rooms, MEETING_ROOM_ID } from "../lib/data";

const stateColor: Record<Agent["state"], string> = {
  working: "#34d399",
  walking: "#38bdf8",
  meeting: "#f472b6",
  idle: "#94a3b8",
};

function accentFor(agent: Agent) {
  return departmentMap[agent.department]?.accent ?? "#38bdf8";
}

export default function ShipMap({
  agents,
  meetingActive,
  selectedId,
  onSelect,
}: {
  agents: Agent[];
  meetingActive: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="relative w-full">
      <div
        className="scanlines relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[rgba(10,14,28,0.6)]"
        style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
      >
        {/* faint deck grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(120,160,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,255,0.08) 1px, transparent 1px)",
            backgroundSize: `${100 / GRID_W}% ${100 / GRID_H}%`,
          }}
        />

        {/* rooms */}
        {rooms.map((room) => {
          const accent = room.department
            ? departmentMap[room.department]?.accent
            : room.type === "meeting"
              ? "#f472b6"
              : "#7dd3fc";
          const isMeeting = room.id === MEETING_ROOM_ID;
          return (
            <div
              key={room.id}
              className="absolute rounded-lg border p-1.5 transition-colors"
              style={{
                left: pct(room.x, GRID_W),
                top: pct(room.y, GRID_H),
                width: pct(room.w, GRID_W),
                height: pct(room.h, GRID_H),
                borderColor: `${accent}55`,
                background: `linear-gradient(160deg, ${accent}1f, ${accent}08)`,
                boxShadow:
                  isMeeting && meetingActive
                    ? `0 0 24px ${accent}aa, inset 0 0 18px ${accent}33`
                    : `inset 0 0 14px ${accent}14`,
              }}
            >
              <div className="flex items-center gap-1 text-[0.6rem] font-medium leading-none sm:text-[0.7rem]">
                <span>{room.icon}</span>
                <span className="truncate" style={{ color: accent }}>
                  {room.name}
                </span>
              </div>
              {isMeeting && meetingActive && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-pink-500/30 px-1.5 py-0.5 text-[0.5rem] font-semibold text-pink-200 pulse-glow">
                  ALL-HANDS
                </span>
              )}
            </div>
          );
        })}

        {/* agents */}
        {agents.map((a) => {
          const accent = accentFor(a);
          const selected = a.id === selectedId;
          const hovered = a.id === hoverId;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: pct(a.pos.x, GRID_W), top: pct(a.pos.y, GRID_H) }}
              aria-label={`${a.name}, ${a.role}`}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] sm:h-6 sm:w-6 sm:text-xs"
                style={{
                  background: "rgba(8,12,24,0.85)",
                  border: `2px solid ${accent}`,
                  boxShadow: selected
                    ? `0 0 0 3px ${accent}66, 0 0 14px ${accent}`
                    : `0 0 8px ${accent}66`,
                }}
              >
                {a.avatar}
              </span>
              {/* status dot */}
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-black/40"
                style={{ background: stateColor[a.state] }}
              />
              {(hovered || selected) && (
                <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-1.5 py-0.5 text-[0.6rem] text-white">
                  {a.name} · {a.role}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] text-slate-400">
        {(["working", "walking", "meeting", "idle"] as Agent["state"][]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: stateColor[s] }} />
            <span className="capitalize">{s}</span>
          </span>
        ))}
        <span className="text-slate-500">· click any crew member for their dossier</span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Agent } from "../lib/types";
import { GRID_W, GRID_H, departmentMap, rooms, roomCenter, MEETING_ROOM_ID } from "../lib/data";

const stateColor: Record<Agent["state"], string> = {
  working: "#25ff96",
  walking: "#42c6ff",
  meeting: "#ff8c42",
  idle: "#6b8f7f",
};

function accentFor(agent: Agent) {
  return departmentMap[agent.department]?.accent ?? "#25ff96";
}

const TRUNK_Y = 7.5;
const TRUNK_X = GRID_W / 2;

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
    <div className="crt-frame relative w-full overflow-hidden rounded-lg bg-[#020a07] p-2">
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
      >
        {/* corridor layer */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="corridorGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.06" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#corridorGlow)" stroke="#1bbd74" strokeWidth="0.08" opacity="0.7">
            {/* central trunks */}
            <line x1="0.5" y1={TRUNK_Y} x2={GRID_W - 0.5} y2={TRUNK_Y} />
            <line x1={TRUNK_X} y1="0.5" x2={TRUNK_X} y2={GRID_H - 0.5} />
            {/* branch each room to the horizontal trunk */}
            {rooms.map((r) => {
              const c = roomCenter(r.id);
              return <line key={r.id} x1={c.x} y1={c.y} x2={c.x} y2={TRUNK_Y} strokeWidth="0.05" />;
            })}
          </g>
          {/* junction nodes */}
          <g fill="#25ff96">
            {rooms.map((r) => {
              const c = roomCenter(r.id);
              return <circle key={r.id} cx={c.x} cy={TRUNK_Y} r="0.08" opacity="0.8" />;
            })}
          </g>
        </svg>

        {/* rooms */}
        {rooms.map((room) => {
          const accent = room.department
            ? departmentMap[room.department]?.accent
            : room.type === "meeting"
              ? "#ff8c42"
              : "#25ff96";
          const isMeeting = room.id === MEETING_ROOM_ID;
          const hot = isMeeting && meetingActive;
          return (
            <div
              key={room.id}
              className="absolute"
              style={{
                left: pct(room.x, GRID_W),
                top: pct(room.y, GRID_H),
                width: pct(room.w, GRID_W),
                height: pct(room.h, GRID_H),
                padding: "2px",
              }}
            >
              {/* outer wireframe */}
              <div
                className="relative h-full w-full"
                style={{
                  border: `1.5px solid ${accent}`,
                  boxShadow: hot
                    ? `0 0 16px ${accent}, inset 0 0 14px ${accent}55`
                    : `0 0 7px ${accent}66, inset 0 0 9px ${accent}1f`,
                  background: `linear-gradient(${accent}10, transparent)`,
                }}
              >
                {/* inner wireframe (double border look) */}
                <div className="absolute inset-[3px]" style={{ border: `1px solid ${accent}44` }} />
                {/* interior grid */}
                <div
                  className="absolute inset-[3px] opacity-40"
                  style={{
                    backgroundImage: `linear-gradient(${accent}22 1px, transparent 1px), linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
                    backgroundSize: "7px 7px",
                  }}
                />
                {/* interior modules */}
                <div className="absolute inset-[5px] flex flex-wrap content-start gap-[2px] overflow-hidden">
                  {Array.from({ length: room.w + room.h }).map((_, i) => (
                    <span
                      key={i}
                      className="block"
                      style={{
                        width: "5px",
                        height: "5px",
                        background: i % 3 === 0 ? `${accent}` : `${accent}33`,
                        boxShadow: i % 3 === 0 ? `0 0 4px ${accent}` : "none",
                      }}
                    />
                  ))}
                </div>
                {/* label */}
                <div
                  className="absolute left-1 top-0.5 max-w-full truncate text-[0.5rem] font-bold tracking-wider sm:text-[0.6rem]"
                  style={{ color: accent, textShadow: `0 0 5px ${accent}` }}
                >
                  {room.name.toUpperCase()}
                </div>
                {hot && (
                  <span className="pulse-glow absolute bottom-0.5 right-1 text-[0.5rem] font-bold text-[#ff8c42]">
                    ●ALL-HANDS
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* agents as glowing units */}
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
                className="block rounded-[1px]"
                style={{
                  width: selected ? "9px" : "6px",
                  height: selected ? "9px" : "6px",
                  background: stateColor[a.state],
                  boxShadow: `0 0 ${selected ? 10 : 6}px ${stateColor[a.state]}, 0 0 2px #fff`,
                  border: selected ? `1px solid ${accent}` : "none",
                }}
              />
              {(hovered || selected) && (
                <span
                  className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded border border-[var(--border-dim)] bg-black/90 px-1.5 py-0.5 text-[0.6rem]"
                  style={{ color: accent }}
                >
                  {a.avatar} {a.name.toUpperCase()} · {a.role}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.6rem] text-[var(--green-dim)]">
        {(["working", "walking", "meeting", "idle"] as Agent["state"][]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[1px]" style={{ background: stateColor[s], boxShadow: `0 0 5px ${stateColor[s]}` }} />
            <span className="uppercase tracking-wider">{s}</span>
          </span>
        ))}
        <span className="tracking-wider">{"// SELECT UNIT FOR DOSSIER"}</span>
      </div>
    </div>
  );
}

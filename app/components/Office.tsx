"use client";

import type { Agent } from "../lib/types";

interface Props {
  agents: Agent[];
  onAgentClick?: (id: string) => void;
  selectedId?: string;
}

export default function Office({ agents, onAgentClick, selectedId }: Props) {
  return (
    <div className="office relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-amber-50 to-amber-100 shadow-inner dark:from-zinc-900 dark:to-zinc-950">
      <div className="office-floor" />
      <div className="office-window" />
      <div className="office-plant" aria-hidden>🪴</div>
      <div className="office-clock" aria-hidden>🕘</div>
      <div className="office-board" aria-hidden>
        <div className="office-board-line" />
        <div className="office-board-line short" />
        <div className="office-board-line" />
      </div>
      <div className="office-printer" aria-hidden>🖨️</div>
      <div className="office-water" aria-hidden>💧</div>

      <div className="office-stage">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onAgentClick?.(a.id)}
            className={`agent-desk ${selectedId === a.id ? "selected" : ""}`}
            style={{
              left: `${a.desk.x}%`,
              top: `${a.desk.y}%`,
              ["--agent-color" as string]: a.color,
            }}
            title={`${a.name} — ${a.description}`}
          >
            <div className="agent-status-dot" data-status={a.status} />
            <div className={`agent-character status-${a.status}`}>
              <div className="agent-head">
                <span className="agent-emoji">{a.emoji}</span>
                {a.status === "thinking" && (
                  <span className="thought-bubble">…</span>
                )}
                {a.status === "working" && (
                  <span className="thought-bubble work">⚡</span>
                )}
                {a.status === "done" && (
                  <span className="thought-bubble done">✓</span>
                )}
              </div>
              <div className="agent-body" />
            </div>
            <div className="agent-deskpiece">
              <div className="agent-monitor">
                <div className="agent-screen" />
              </div>
            </div>
            <div className="agent-nameplate">{a.name.split(" ")[0]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

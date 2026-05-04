"use client";

import type { Agent } from "../lib/types";

interface Props {
  agents: Agent[];
  progress: number;
  running: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function OfficeStrip({
  agents,
  progress,
  running,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="office-strip">
      <div className="office-strip-row">
        {agents.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`mini-agent status-${a.status} ${selectedId === a.id ? "selected" : ""}`}
            style={{ ["--agent-color" as string]: a.color }}
            title={`${a.name} — ${a.description}`}
          >
            <span className="mini-agent-head">
              <span className="mini-agent-emoji">{a.emoji}</span>
              <span className="mini-status-dot" data-status={a.status} />
              <span className="mini-level" title={`Skill ${Math.round(a.skill)}/100`}>
                Lv {Math.max(1, Math.round(a.skill / 10))}
              </span>
            </span>
            <span className="mini-agent-name">{a.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <div className="office-strip-progress">
        <div
          className="office-strip-progress-bar"
          style={{
            width: `${progress}%`,
            opacity: running || progress > 0 ? 1 : 0.3,
          }}
        />
      </div>
    </div>
  );
}

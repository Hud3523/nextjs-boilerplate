"use client";

import type { Agent } from "../lib/types";

interface Props {
  agent?: Agent;
  onRemove: () => void;
  onClose: () => void;
}

export default function AgentDetailPanel({ agent, onRemove, onClose }: Props) {
  if (!agent) return null;

  const tier =
    agent.skill >= 75 ? "Ace" : agent.skill >= 50 ? "Solid" : "Rookie";

  return (
    <div
      className="agent-detail"
      style={{
        borderColor: `${agent.color}55`,
        background: `linear-gradient(180deg, ${agent.color}14, transparent)`,
      }}
    >
      <div className="agent-detail-row">
        <div className="agent-detail-left">
          <div
            className="agent-detail-avatar"
            style={{ background: `${agent.color}33`, borderColor: agent.color }}
          >
            {agent.emoji}
          </div>
          <div>
            <p className="agent-detail-name" style={{ color: agent.color }}>
              {agent.name}
            </p>
            <p className="agent-detail-desc">{agent.description}</p>
            <p className="agent-detail-meta">
              status: {agent.status} · runs: {agent.runs} · best:{" "}
              {agent.bestGrade || "—"}
            </p>
          </div>
        </div>
        <div className="agent-detail-actions">
          {agent.custom && (
            <button type="button" onClick={onRemove} className="btn-danger">
              Fire
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-ghost">
            Close
          </button>
        </div>
      </div>

      <div className="agent-stats">
        <div className="stat-block">
          <div className="stat-label">Skill — {tier}</div>
          <div className="skill-bar">
            <div
              className="skill-bar-fill"
              style={{ width: `${agent.skill}%`, background: agent.color }}
            />
          </div>
          <div className="stat-value">{Math.round(agent.skill)} / 100</div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Average score</div>
          <div className="stat-value lg">
            {agent.averageScore ? agent.averageScore.toFixed(1) : "—"}
          </div>
        </div>
        <div className="stat-block">
          <div className="stat-label">Recent grades</div>
          <div className="grades-row">
            {agent.recentGrades.length === 0 && (
              <span className="grade-empty">—</span>
            )}
            {agent.recentGrades.map((g, i) => (
              <span
                key={i}
                className={`grade-pill grade-${g.replace("+", "plus").replace("-", "minus")}`}
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

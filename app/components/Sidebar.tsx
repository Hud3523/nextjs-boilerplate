"use client";

import type { Conversation } from "../lib/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onHire: () => void;
  onAchievements: () => void;
  achievementsUnlocked: number;
  achievementsTotal: number;
  agentCount: number;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onHire,
  onAchievements,
  achievementsUnlocked,
  achievementsTotal,
  agentCount,
  open,
  onClose,
}: Props) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-logo">🏢</span>
          <span className="sidebar-title">AI Office</span>
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          <span>＋</span> New chat
        </button>

        <div className="convo-list">
          {sorted.length === 0 && (
            <p className="convo-empty">No conversations yet.</p>
          )}
          {sorted.map((c) => (
            <div
              key={c.id}
              className={`convo-item ${c.id === activeId ? "active" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="convo-button"
                title={c.title}
              >
                <span className="convo-title">{c.title}</span>
                <span className="convo-date">
                  {new Date(c.updatedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </button>
              <button
                type="button"
                className="convo-delete"
                onClick={() => onDelete(c.id)}
                aria-label="Delete conversation"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-action" onClick={onHire}>
            🧬 Hire agent
          </button>
          <button type="button" className="sidebar-action" onClick={onAchievements}>
            🏆 Achievements
            <span className="sidebar-badge">
              {achievementsUnlocked}/{achievementsTotal}
            </span>
          </button>
          <p className="sidebar-meta">
            {agentCount} agents · mock mode
          </p>
        </div>
      </aside>

      {open && <div className="sidebar-backdrop" onClick={onClose} />}
    </>
  );
}

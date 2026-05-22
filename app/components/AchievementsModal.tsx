"use client";

import type { Achievement } from "../lib/achievements";

interface Props {
  open: boolean;
  onClose: () => void;
  achievements: Achievement[];
}

export default function AchievementsModal({ open, onClose, achievements }: Props) {
  if (!open) return null;
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-emoji">🏆</span>
          <div>
            <h2>Achievements</h2>
            <p>
              {unlocked} / {achievements.length} unlocked
            </p>
          </div>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="achv-grid">
          {achievements.map((a) => (
            <div key={a.id} className={`achv-card ${a.unlocked ? "on" : "off"}`}>
              <span className="achv-icon">{a.unlocked ? a.icon : "🔒"}</span>
              <div>
                <div className="achv-title">{a.title}</div>
                <div className="achv-desc">{a.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

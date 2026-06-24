import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Stats } from "../types";
import { api } from "../lib/api";
import { money, cn } from "../lib/ui";

export function StatusBar({ stats, hermes, onOpenPalette, onChange }: {
  stats: Stats; hermes: { mode: string; health: { ok: boolean } }; onOpenPalette: () => void; onChange: () => void;
}) {
  const [, tick] = useState(0);
  const [armStep, setArmStep] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);

  const cap = stats.budgetCapUsd;
  const pct = cap > 0 ? Math.min(100, (stats.spendUsd / cap) * 100) : 0;
  const meter = pct >= 100 ? "var(--color-danger)" : pct >= 80 ? "var(--color-amber)" : "var(--color-cyan)";

  async function arm() {
    if (!stats.dryRun) { await api.arm(false); onChange(); return; }
    const next = armStep + 1;
    if (next < 3) { setArmStep(next); return; }
    try { await api.arm(true, 3); } catch { /* ignore */ }
    setArmStep(0); onChange();
  }
  async function editBudget() {
    const v = prompt("Budget cap (USD):", String(cap));
    if (v != null && !Number.isNaN(Number(v))) { await api.saveSettings(Number(v)); onChange(); }
  }

  return (
    <header className="relative z-10 flex items-center gap-2 px-4 h-16 bg-[var(--color-panel)]/70 backdrop-blur border-b border-cyan-400/20">
      <div className="flex items-center gap-2 pr-3">
        <span className="text-2xl">🛰️</span>
        <div className="leading-tight">
          <div className="pixel text-[10px] tracking-[0.1em] text-[var(--color-cyan)] text-glow">MISSION CONTROL</div>
          <div className="text-[10px] text-white/40 tracking-widest uppercase">Hermes dashboard</div>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-3 flex-1 overflow-x-auto">
        <span className={cn("font-mono text-[11px] px-2 py-1 rounded border", hermes.health.ok ? "border-jade-400/40 text-[var(--color-jade)]" : "border-red-500/50 text-red-300")}
          style={{ color: hermes.health.ok ? "var(--color-jade)" : "var(--color-danger)", borderColor: hermes.health.ok ? "rgba(33,243,163,0.4)" : "rgba(255,59,92,0.5)" }}>
          Hermes: {hermes.mode}{hermes.health.ok ? " ●" : " ✕"}
        </span>
        <button onClick={editBudget} className="flex flex-col px-2 border-l border-white/5 text-left">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Spend / Cap</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded bg-white/10 overflow-hidden"><div className="h-full" style={{ width: `${pct}%`, background: meter, boxShadow: `0 0 8px ${meter}` }} /></div>
            <span className="font-mono text-xs text-white/70">{money(stats.spendUsd, 4)} / {money(cap)}</span>
          </div>
        </button>
        <div className="flex flex-col px-2 border-l border-white/5">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Needs review</span>
          <span className="font-mono text-sm text-amber-300">{stats.needsReview}</span>
        </div>
      </div>
      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-2">
        <span className={cn("font-mono text-[11px] px-2 py-1 rounded border", stats.dryRun ? "border-cyan-400/40 text-cyan-300" : "border-magenta-400/60 text-[var(--color-magenta)] glow-magenta")}>
          {stats.dryRun ? "DRY-RUN" : "● LIVE"}
        </span>
        <button onClick={onOpenPalette} title="Command palette (⌘K)" className="font-mono text-[11px] px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">⌘K</button>
        <button onClick={arm} className={cn("font-mono text-[11px] px-3 py-1.5 rounded border",
          stats.dryRun ? (armStep > 0 ? "bg-magenta-500/30 border-magenta-400 text-[var(--color-magenta)]" : "bg-magenta-500/15 border-magenta-400/50 text-magenta-200") : "bg-cyan-500/15 border-cyan-400/40 text-cyan-200")}
          style={{ borderColor: stats.dryRun ? "var(--color-magenta)" : undefined }}>
          {stats.dryRun ? (armStep === 0 ? "⚡ Arm" : `Confirm ${armStep}/3`) : "↩ Dry-run"}
        </button>
        <motion.button whileTap={{ scale: 0.94 }} onClick={() => { api.estop(!stats.emergencyStop).then(onChange); }}
          className={cn("font-mono text-[11px] px-3 py-1.5 rounded border font-bold", stats.emergencyStop ? "bg-[var(--color-danger)]/30 border-red-400 text-red-200 pulse-active" : "bg-[var(--color-danger)]/15 border-red-500/50 text-red-300")}>
          🛑<span className="hidden sm:inline"> {stats.emergencyStop ? "FROZEN" : "E-STOP"}</span>
        </motion.button>
      </div>
    </header>
  );
}

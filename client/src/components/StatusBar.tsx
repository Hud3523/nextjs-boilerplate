import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Stats } from "../types";
import { api } from "../lib/api";
import { money, countdown, cn } from "../lib/ui";

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col px-3 border-l border-white/5 first:border-0">
      <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      <span className="font-mono text-sm" style={{ color: accent }}>{value}</span>
    </div>
  );
}

export function StatusBar({ stats, onOpenCommissioner, onOpenDirective }: {
  stats: Stats; onOpenCommissioner: () => void; onOpenDirective: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);

  const capPct = stats.masterFundCapUsd > 0 ? Math.min(100, (stats.fundSpendUsd / stats.masterFundCapUsd) * 100) : 0;
  const meterColor = capPct >= 100 ? "var(--color-danger)" : capPct >= 80 ? "var(--color-amber)" : "var(--color-cyan)";

  return (
    <header className="relative z-10 flex items-center gap-2 px-4 h-16 bg-[var(--color-panel)]/70 backdrop-blur border-b border-cyan-400/20">
      <div className="flex items-center gap-2 pr-3">
        <span className="text-2xl">🛰️</span>
        <div className="leading-tight">
          <div className="font-mono text-sm tracking-[0.2em] text-[var(--color-cyan)] text-glow">MISSION CONTROL</div>
          <div className="text-[10px] text-white/40 tracking-widest uppercase">Autonomous Agency Command</div>
        </div>
      </div>

      <div className="flex items-center flex-1 overflow-x-auto">
        <Metric label="Sim Revenue" value={money(stats.revenueUsd)} accent="var(--color-jade)" />
        <Metric label="Real Spend" value={money(stats.fundSpendUsd, 4)} accent="var(--color-magenta)" />
        <div className="flex flex-col px-3 border-l border-white/5 min-w-[150px]">
          <span className="text-[10px] uppercase tracking-widest text-white/40">Fund Cap</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded bg-white/10 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${capPct}%`, background: meterColor, boxShadow: `0 0 8px ${meterColor}` }} />
            </div>
            <span className="font-mono text-xs text-white/60">{money(stats.creditsRemainingUsd)} left</span>
          </div>
        </div>
        <Metric label="Model" value={stats.model} accent="var(--color-violet)" />
        <Metric label="Cycles Today" value={String(stats.cyclesToday)} />
        <Metric label="Next Run" value={countdown(stats.nextRunAt)} accent="var(--color-cyan)" />
        <Metric label="Mode" value={stats.tournamentMode} />
      </div>

      <div className="flex items-center gap-2">
        <span className={cn("font-mono text-[11px] px-2 py-1 rounded border",
          stats.dryRun ? "border-cyan-400/40 text-cyan-300" : "border-magenta-400/60 text-[var(--color-magenta)] glow-magenta")}>
          {stats.dryRun ? "DRY-RUN" : "● LIVE"}
        </span>
        <button onClick={onOpenDirective} className="font-mono text-[11px] px-3 py-1.5 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200 hover:bg-violet-500/30">
          + DIRECTIVE
        </button>
        <button onClick={onOpenCommissioner} className="font-mono text-[11px] px-3 py-1.5 rounded bg-cyan-500/10 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20">
          CONTROL ROOM
        </button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => api.emergencyStop(!stats.emergencyStop)}
          className={cn("font-mono text-[11px] px-3 py-1.5 rounded border font-bold",
            stats.emergencyStop ? "bg-[var(--color-danger)]/30 border-red-400 text-red-200 pulse-active" : "bg-[var(--color-danger)]/15 border-red-500/50 text-red-300 hover:bg-[var(--color-danger)]/25")}>
          🛑 {stats.emergencyStop ? "FROZEN" : "E-STOP"}
        </motion.button>
      </div>
    </header>
  );
}

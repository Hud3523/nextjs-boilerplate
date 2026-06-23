import { motion } from "framer-motion";
import type { Snapshot } from "../types";
import { api } from "../lib/api";
import { money, cn } from "../lib/ui";

const RANK_COLOR = ["#ffd24a", "#c8d4e8", "#cd8e5a"];

export function FleetView({ snap, onOpenAgency, onMeet }: { snap: Snapshot; onOpenAgency: (id: string) => void; onMeet: () => void }) {
  const board = snap.leaderboard;
  const maxCap = Math.max(1, ...board.map((b) => b.capital));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-cyan-300 text-glow">FLEET — {snap.season?.name ?? "League"} · {snap.stats.tournamentMode} race</div>
          <div className="text-[11px] text-white/40">Each ship is an agency. Size = capital. Net P&L decides the season.</div>
        </div>
        <button onClick={() => api.settleSeason()} className="font-mono text-[11px] px-3 py-1.5 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200 hover:bg-violet-500/30">
          🏁 SETTLE SEASON
        </button>
      </div>

      {/* Shared Meeting Hall, with every ship docked to it via a corridor */}
      <div className="relative rounded-2xl border border-white/10 bg-[var(--color-deep)]/50 p-6 mb-4 space-bg starfield overflow-hidden">
        <div className="relative flex flex-col items-center">
          <button onClick={onMeet}
            className="relative z-10 px-4 py-2.5 rounded-xl border border-cyan-400/50 bg-cyan-500/15 text-cyan-100 pixel text-[10px] hover:bg-cyan-500/25 glow-cyan">
            🏛️ MEETING HALL
          </button>
          {/* corridor linking all docked ships to the hall */}
          <div className="w-[85%] h-0.5 mt-3" style={{ background: "linear-gradient(90deg, transparent, var(--color-cyan), transparent)", boxShadow: "0 0 8px var(--color-cyan)" }} />
        </div>
        <div className="relative flex flex-wrap items-start justify-center gap-8 mt-3 min-h-[180px]">
        {board.map((b, i) => {
          const size = 56 + (b.capital / maxCap) * 60;
          const dead = b.status !== "active";
          const color = b.net >= 0 ? "var(--color-jade)" : "var(--color-danger)";
          return (
            <motion.button key={b.agencyId} layout whileHover={{ scale: 1.06 }} onClick={() => onOpenAgency(b.agencyId)}
              className="flex flex-col items-center group" style={{ opacity: dead ? 0.4 : 1 }}>
              <div className="w-px h-4 -mt-3 mb-1" style={{ background: "rgba(34,230,255,0.4)" }} />
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3 + i, repeat: Infinity }}
                className="relative rounded-full flex items-center justify-center"
                style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${color}33, transparent 70%)`, boxShadow: `0 0 24px ${color}66`, border: `1px solid ${color}88` }}>
                <span className="text-2xl">{dead ? "💀" : "🚀"}</span>
                <span className="absolute -top-2 -right-2 font-mono text-[10px] px-1.5 rounded-full text-black font-bold" style={{ background: RANK_COLOR[i] ?? "#5a6b88" }}>#{b.rank}</span>
              </motion.div>
              <div className="font-mono text-xs text-white/90 mt-2">{b.name}</div>
              <div className="font-mono text-[11px]" style={{ color }}>{b.net >= 0 ? "+" : ""}{money(b.net)}</div>
            </motion.button>
          );
        })}
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/40">
            <tr><th className="p-2">#</th><th className="p-2">Agency</th><th className="p-2">Doctrine</th><th className="p-2">Capital</th><th className="p-2">Net</th><th className="p-2">ROI</th><th className="p-2">Status</th></tr>
          </thead>
          <tbody className="font-mono text-xs">
            {board.map((b) => (
              <tr key={b.agencyId} className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => onOpenAgency(b.agencyId)}>
                <td className="p-2" style={{ color: RANK_COLOR[b.rank - 1] ?? "#9fb0cc" }}>{b.rank}</td>
                <td className="p-2 text-white/90">{b.name}</td>
                <td className="p-2 text-white/50">{b.doctrine.contentVsCommerce >= 0.5 ? "commerce" : "content"}·{b.doctrine.riskTolerance >= 0.5 ? "bold" : "cautious"}</td>
                <td className="p-2 text-cyan-300">{money(b.capital)}</td>
                <td className="p-2" style={{ color: b.net >= 0 ? "var(--color-jade)" : "var(--color-danger)" }}>{b.net >= 0 ? "+" : ""}{money(b.net)}</td>
                <td className="p-2 text-white/60">{b.roi == null ? "—" : `${(b.roi * 100).toFixed(0)}%`}</td>
                <td className="p-2"><span className={cn(b.status === "active" ? "text-jade-400" : b.status === "paused" ? "text-amber-400" : "text-red-400")} style={{ color: b.status === "active" ? "var(--color-jade)" : b.status === "paused" ? "var(--color-amber)" : "var(--color-danger)" }}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

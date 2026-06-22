import { motion } from "framer-motion";
import type { Snapshot } from "../types";
import { money, STATUS_COLOR } from "../lib/ui";

/** Live tree: Fund → Agency → Floor → Agent. New branches animate in on spawn. */
export function OrgGraph({ snap, onOpenAgency, onSelectAgent }: {
  snap: Snapshot; onOpenAgency: (id: string) => void; onSelectAgent: (id: string) => void;
}) {
  const agencies = snap.agencies;
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="font-mono text-cyan-300 text-glow mb-3">🌳 ORG GRAPH — Fund → Agency → Floor → Agent</div>
      <div className="space-y-3">
        {agencies.map((ag) => {
          const floors = snap.floors.filter((f) => f.agency_id === ag.id);
          return (
            <motion.div key={ag.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-[var(--color-panel)]/40 p-3">
              <button onClick={() => onOpenAgency(ag.id)} className="flex items-center gap-2 w-full text-left">
                <span className="text-lg">{ag.is_league ? "🏛️" : ag.status === "active" ? "🚀" : "💀"}</span>
                <span className="font-mono text-sm text-white/90">{ag.name}</span>
                <span className="text-[10px] text-white/40">{ag.is_league ? "fund HQ" : `gen ${ag.generation}`}</span>
                <span className="ml-auto font-mono text-[11px]" style={{ color: ag.pnl.net >= 0 ? "var(--color-jade)" : "var(--color-danger)" }}>
                  {money(ag.capital_usd)} cap · {ag.pnl.net >= 0 ? "+" : ""}{money(ag.pnl.net)} net
                </span>
              </button>
              <div className="pl-5 mt-2 space-y-2 border-l border-white/10">
                {floors.map((f) => {
                  const agents = snap.agents.filter((a) => a.floorId === f.id);
                  return (
                    <motion.div key={f.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-white/30">{"└─"}</span>
                        <span className="text-violet-300 font-mono">{f.name}</span>
                        <span className="text-[9px] text-white/30">d{f.depth} · {f.status}</span>
                      </div>
                      <div className="pl-6 flex flex-wrap gap-1.5 mt-1">
                        {agents.map((a) => (
                          <button key={a.id} onClick={() => onSelectAgent(a.id)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.03] hover:bg-white/10 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[a.status] ?? "var(--color-jade)" }} />
                            {a.callsign}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

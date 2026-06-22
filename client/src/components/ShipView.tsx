import { motion } from "framer-motion";
import type { Agent, Stats, Floor } from "../types";
import { STATUS_COLOR, GRADE_COLOR, money, cn } from "../lib/ui";

const AVATAR: Record<string, string> = {
  Bridge: "🛰️", "Research Lab": "🔭", "Media Lab": "🎬", "Comms Array": "📡", "Revenue Bay": "💰",
  Factory: "🏭", "Isolation Pod": "🧪", "QA Bay": "🔍", Foundry: "🛠️", Treasury: "🏦",
  "Safety Bay": "🛡️", Arbitration: "⚖️",
};

function Bay({ agent, onSelect }: { agent: Agent; onSelect: (id: string) => void }) {
  const color = STATUS_COLOR[agent.status] ?? "var(--color-jade)";
  const active = agent.status === "working";
  const grade = agent.report?.letter;
  return (
    <motion.button
      layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -3 }}
      onClick={() => onSelect(agent.id)}
      className={cn("relative overflow-hidden text-left rounded-xl p-3 border bg-[var(--color-panel)]/60",
        active ? "pulse-active border-cyan-400/60" : "neon-border border-white/10", !agent.enabled && "opacity-40")}
      style={{ boxShadow: active ? undefined : `0 0 0 1px ${color}22` }}
    >
      {active && <div className="scanner absolute inset-0 pointer-events-none" />}
      <div className="flex items-center justify-between">
        <span className="text-2xl">{AVATAR[agent.bay] ?? "🤖"}</span>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
      <div className="mt-1 font-mono text-sm text-white/90">{agent.callsign}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{agent.bay}</div>
      <div className="text-[10px] text-white/35 truncate mt-1 h-3.5">{agent.lastAction ?? agent.role}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="font-mono text-[10px]" style={{ color }}>{agent.status}</span>
        {grade && <span className="ml-auto font-mono text-[11px] font-bold" style={{ color: GRADE_COLOR[grade] }}>{grade}</span>}
      </div>
    </motion.button>
  );
}

function InfraPanel({ title, icon, children, accent }: { title: string; icon: string; children: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-xl p-3 border border-white/10 bg-[var(--color-panel)]/40" style={{ boxShadow: `0 0 0 1px ${accent}22` }}>
      <div className="flex items-center gap-2"><span className="text-xl">{icon}</span><span className="text-[10px] uppercase tracking-wider text-white/40">{title}</span></div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function ShipView({ floor, agents, stats, onSelect, selectedId }: {
  floor: Floor | null; agents: Agent[]; stats: Stats; onSelect: (id: string) => void; selectedId?: string;
}) {
  const capPct = stats.masterFundCapUsd > 0 ? Math.min(100, (stats.fundSpendUsd / stats.masterFundCapUsd) * 100) : 0;
  const working = agents.filter((a) => a.status === "working").length;
  const blocked = agents.filter((a) => a.status === "blocked").length;
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {floor && (
        <div className="mb-3">
          <div className="font-mono text-cyan-300 text-glow">{floor.name}</div>
          <div className="text-[11px] text-white/40">{floor.mission}</div>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {agents.map((a) => <Bay key={a.id} agent={a} onSelect={onSelect} />)}
        <InfraPanel title="Solar Array" icon="🔋" accent="var(--color-cyan)">
          <div className="h-2 rounded bg-white/10 overflow-hidden">
            <div className="h-full" style={{ width: `${100 - capPct}%`, background: "var(--color-cyan)", boxShadow: "0 0 10px var(--color-cyan)" }} />
          </div>
          <div className="font-mono text-[11px] text-white/60 mt-1">{money(stats.creditsRemainingUsd)} credits · {Math.round(100 - capPct)}% power</div>
        </InfraPanel>
        <InfraPanel title="Engineering" icon="⚙️" accent="var(--color-violet)">
          <div className="font-mono text-[11px] text-white/60 space-y-0.5">
            <div>{working} working · {blocked} blocked</div>
            <div className={stats.emergencyStop ? "text-red-400" : stats.paused ? "text-amber-400" : "text-jade-400"} style={{ color: stats.emergencyStop ? "var(--color-danger)" : stats.paused ? "var(--color-amber)" : "var(--color-jade)" }}>
              {stats.emergencyStop ? "EMERGENCY STOP" : stats.paused ? "PAUSED" : "all systems nominal"}
            </div>
          </div>
        </InfraPanel>
      </div>
    </div>
  );
}

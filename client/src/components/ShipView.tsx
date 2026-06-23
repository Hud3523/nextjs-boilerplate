import { motion } from "framer-motion";
import type { Agent, Stats, Floor } from "../types";
import { STATUS_COLOR, GRADE_COLOR, money, cn } from "../lib/ui";

// The character that lives in each room.
const AVATAR: Record<string, string> = {
  Bridge: "🧑‍✈️", "Research Lab": "🧑‍🔬", "Media Lab": "🧑‍🎨", "Comms Array": "🧑‍💻", "Revenue Bay": "🧑‍💼",
  Factory: "🧑‍🏭", "Isolation Pod": "🧑‍🚀", "QA Bay": "🕵️", Foundry: "🧑‍🔧", Treasury: "🧑‍💼",
  "Safety Bay": "🦸", Arbitration: "🧑‍⚖️", Airlock: "🧑‍💻", "Security Bay": "💂", "Idea Lab": "🧑‍🎓",
};

// Props scattered in the room that signal the agent's job.
const PROPS: Record<string, string[]> = {
  Bridge: ["🗺️", "📡"], "Research Lab": ["🔭", "📊"], "Media Lab": ["🎬", "✍️"],
  "Comms Array": ["📣", "📅"], "Revenue Bay": ["🛒", "🏷️"], Factory: ["📦", "🛠️"],
  "Isolation Pod": ["⚗️", "🧫"], "QA Bay": ["🔎", "✅"], Foundry: ["🧩", "🛠️"],
  Treasury: ["🪙", "📈"], "Safety Bay": ["🛡️", "📋"], Arbitration: ["⚖️", "🏁"],
  Airlock: ["⌨️", "📁"], "Security Bay": ["🔒", "👁️"], "Idea Lab": ["💡", "✨"],
};

function Room({ agent, onSelect, selected }: { agent: Agent; onSelect: (id: string) => void; selected?: boolean }) {
  const color = STATUS_COLOR[agent.status] ?? "var(--color-jade)";
  const active = agent.status === "working";
  const grade = agent.report?.letter;
  const props = PROPS[agent.bay] ?? ["•"];
  const caption = active ? agent.lastAction : agent.lastAction ?? agent.role;

  return (
    <motion.button
      layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -3 }}
      onClick={() => onSelect(agent.id)}
      className={cn("relative text-left rounded-xl border overflow-hidden",
        active ? "pulse-active border-cyan-400/60" : "border-white/10", selected && "ring-2 ring-cyan-400/70", !agent.enabled && "opacity-40")}
      style={{ background: "linear-gradient(180deg, rgba(20,26,64,0.6) 0%, rgba(8,10,26,0.85) 70%)", boxShadow: active ? undefined : `0 0 0 1px ${color}22` }}
    >
      {/* Nameplate above their head */}
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full text-[10px] font-mono whitespace-nowrap"
        style={{ background: "rgba(0,0,0,0.55)", border: `1px solid ${color}66`, color }}>
        {agent.callsign}{agent.progression ? ` · L${agent.progression.level}` : ""}
      </div>

      {/* The room interior */}
      <div className="relative h-[104px] mt-1">
        {/* wall grid */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(139,92,255,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(34,230,255,0.10) 1px,transparent 1px)", backgroundSize: "16px 16px" }} />
        {/* floor */}
        <div className="absolute bottom-0 inset-x-0 h-5" style={{ background: `linear-gradient(0deg, ${color}22, transparent)`, borderTop: `1px solid ${color}44` }} />
        {active && <div className="scanner absolute inset-0 pointer-events-none" />}

        {/* job props in the corners */}
        <span className="absolute top-7 left-2 text-base opacity-80">{props[0]}</span>
        {props[1] && <span className="absolute top-7 right-2 text-base opacity-80">{props[1]}</span>}

        {/* the character */}
        <motion.div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-3xl"
          animate={active ? { y: [0, -4, 0] } : { y: 0 }} transition={{ repeat: Infinity, duration: 1.4 }}>
          {AVATAR[agent.bay] ?? "🤖"}
          {agent.sandboxed && <span className="absolute -right-3 -top-1 text-[10px]">🧪</span>}
        </motion.div>

        {/* status light */}
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />

        {/* "what they're doing" speech bubble when active */}
        {active && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-cyan-200 whitespace-nowrap max-w-[130px] truncate">
            {agent.lastAction ?? "working…"}<span className="animate-pulse">▌</span>
          </div>
        )}
      </div>

      {/* caption + footer */}
      <div className="px-2 pb-2">
        <div className="text-[10px] uppercase tracking-wider text-white/40 truncate">{agent.bay}</div>
        <div className="text-[10px] text-white/40 truncate h-3.5">{caption}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[10px]" style={{ color }}>{agent.status}</span>
          {grade && <span className="ml-auto font-mono text-[11px] font-bold" style={{ color: GRADE_COLOR[grade] }}>{grade}</span>}
        </div>
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
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {agents.map((a) => <Room key={a.id} agent={a} onSelect={onSelect} selected={selectedId === a.id} />)}
        <InfraPanel title="Solar Array" icon="🔋" accent="var(--color-cyan)">
          <div className="h-2 rounded bg-white/10 overflow-hidden">
            <div className="h-full" style={{ width: `${100 - capPct}%`, background: "var(--color-cyan)", boxShadow: "0 0 10px var(--color-cyan)" }} />
          </div>
          <div className="font-mono text-[11px] text-white/60 mt-1">{money(stats.creditsRemainingUsd)} credits · {Math.round(100 - capPct)}% power</div>
        </InfraPanel>
        <InfraPanel title="Engineering" icon="⚙️" accent="var(--color-violet)">
          <div className="font-mono text-[11px] text-white/60 space-y-0.5">
            <div>{working} working · {blocked} blocked</div>
            <div style={{ color: stats.emergencyStop ? "var(--color-danger)" : stats.paused ? "var(--color-amber)" : "var(--color-jade)" }}>
              {stats.emergencyStop ? "EMERGENCY STOP" : stats.paused ? "PAUSED" : "all systems nominal"}
            </div>
          </div>
        </InfraPanel>
      </div>
    </div>
  );
}

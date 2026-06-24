import { motion } from "framer-motion";
import type { Agent } from "../types";
import { STATUS_COLOR, shortModel, cn } from "../lib/ui";

const CHARS = ["🧑‍✈️", "🧑‍🔬", "🧑‍🎨", "🧑‍💻", "🧑‍💼", "🧑‍🏭", "🕵️", "🧑‍🚀", "🧑‍🔧", "🦸"];
const TOOLS = ["🗺️", "🔭", "✍️", "⌨️", "🏷️", "🛠️", "🔎", "⚗️", "🧩", "📈"];
const TINTS = ["#22e6ff", "#ff2bd6", "#8b5cff", "#21f3a3", "#ffb020", "#ff6ec7"];

function Room({ agent, i, onSelect, selected }: { agent: Agent; i: number; onSelect: (id: string) => void; selected?: boolean }) {
  const color = STATUS_COLOR[agent.status] ?? STATUS_COLOR.unknown;
  const active = agent.status === "working";
  const tint = TINTS[i % TINTS.length];
  return (
    <motion.button layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -3 }}
      onClick={() => onSelect(agent.id)}
      className={cn("relative text-left rounded-lg overflow-hidden", active && "pulse-active", selected && "ring-2 ring-cyan-400/70")}
      style={{ border: `1px solid ${active ? "var(--color-cyan)" : tint + "55"}`, background: `linear-gradient(180deg, ${tint}14 0%, rgba(6,8,20,0.92) 72%)`, boxShadow: active ? undefined : `0 0 14px ${tint}18` }}>
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full text-[10px] font-mono whitespace-nowrap" style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${color}66`, color }}>{agent.name}</div>
      <div className="relative h-[104px] mt-1">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `linear-gradient(${tint}22 1px,transparent 1px),linear-gradient(90deg,${tint}1f 1px,transparent 1px)`, backgroundSize: "16px 16px" }} />
        <span className="absolute top-6 left-1/2 -translate-x-1/2 text-4xl opacity-10 select-none">{TOOLS[i % TOOLS.length]}</span>
        <div className="absolute bottom-0 inset-x-0 h-5" style={{ background: `linear-gradient(0deg, ${tint}33, transparent)`, borderTop: `1px solid ${tint}55` }} />
        {active && <div className="scanner absolute inset-0 pointer-events-none" />}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <div className="absolute bottom-3.5 left-0 right-0 flex items-end justify-center gap-0.5">
          <div className={active ? "crew-working" : "crew-idle"} style={{ fontSize: "26px", lineHeight: 1 }}>{CHARS[i % CHARS.length]}</div>
          {active && <span className="worktool text-base">{TOOLS[i % TOOLS.length]}</span>}
        </div>
      </div>
      <div className="px-2 pb-2">
        <div className="text-[10px] text-white/45 truncate h-3.5">{agent.role ?? "agent"}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="font-mono text-[9px]" style={{ color }}>{agent.status}</span>
          {agent.model && <span className="ml-auto font-mono text-[8px] text-white/30 truncate">{shortModel(agent.model)}</span>}
        </div>
      </div>
    </motion.button>
  );
}

export function ShipView({ agents, onSelect, selectedId }: { agents: Agent[]; onSelect: (id: string) => void; selectedId?: string }) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="absolute inset-0 space-bg starfield" />
      <div className="relative h-full overflow-y-auto p-4">
        <div className="hull p-4" style={{ borderColor: "rgba(255,43,214,0.55)" }}>
          <div className="mb-3 font-mono text-cyan-300 text-glow">CUTAWAY · Hermes crew</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {agents.map((a, i) => <Room key={a.id} agent={a} i={i} onSelect={onSelect} selected={selectedId === a.id} />)}
          </div>
          {agents.length === 0 && <div className="text-[11px] text-white/40 p-4">No agents reported by Hermes. Set HERMES_MODE=http or cli and point it at your install.</div>}
        </div>
      </div>
    </div>
  );
}

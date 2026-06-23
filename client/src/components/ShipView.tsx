import { motion } from "framer-motion";
import type { Agent, Stats, Floor } from "../types";
import { STATUS_COLOR, GRADE_COLOR, money, cn, shortModel } from "../lib/ui";

// The character that lives in each room.
const AVATAR: Record<string, string> = {
  Bridge: "🧑‍✈️", "Research Lab": "🧑‍🔬", "Media Lab": "🧑‍🎨", "Comms Array": "🧑‍💻", "Revenue Bay": "🧑‍💼",
  Factory: "🧑‍🏭", "Isolation Pod": "🧑‍🚀", "QA Bay": "🕵️", Foundry: "🧑‍🔧", Treasury: "🧑‍💼",
  "Safety Bay": "🦸", Arbitration: "🧑‍⚖️", Airlock: "🧑‍💻", "Security Bay": "💂", "Idea Lab": "🧑‍🎓",
};
// A tool the character "uses" while working (animates).
const TOOL: Record<string, string> = {
  Bridge: "🗺️", "Research Lab": "🔭", "Media Lab": "✍️", "Comms Array": "📣", "Revenue Bay": "🏷️",
  Factory: "🛠️", "Isolation Pod": "⚗️", "QA Bay": "🔎", Foundry: "🧩", Treasury: "📈",
  "Safety Bay": "🛡️", Arbitration: "⚖️", Airlock: "⌨️", "Security Bay": "🔒", "Idea Lab": "💡",
};
// Furniture / props that signal the job.
const PROPS: Record<string, string[]> = {
  Bridge: ["🖥️", "📡"], "Research Lab": ["📊", "📚"], "Media Lab": ["🎬", "🎙️"],
  "Comms Array": ["📅", "📨"], "Revenue Bay": ["🛒", "💵"], Factory: ["📦", "🏭"],
  "Isolation Pod": ["🧫", "🛰️"], "QA Bay": ["✅", "📋"], Foundry: ["🔧", "⚙️"],
  Treasury: ["🪙", "🏦"], "Safety Bay": ["📋", "🚨"], Arbitration: ["🏁", "📜"],
  Airlock: ["📁", "💾"], "Security Bay": ["👁️", "📹"], "Idea Lab": ["✨", "📝"],
};
// Per-job room tint so each room looks different.
const TINT: Record<string, string> = {
  Bridge: "#22e6ff", "Research Lab": "#22e6ff", "Media Lab": "#ff2bd6", "Comms Array": "#8b5cff",
  "Revenue Bay": "#21f3a3", Factory: "#ffb020", "Isolation Pod": "#ff3b5c", "QA Bay": "#8b5cff",
  Foundry: "#ffb020", Treasury: "#21f3a3", "Safety Bay": "#22e6ff", Arbitration: "#8b5cff",
  Airlock: "#22e6ff", "Security Bay": "#ff3b5c", "Idea Lab": "#ffb020",
};

function Room({ agent, onSelect, selected }: { agent: Agent; onSelect: (id: string) => void; selected?: boolean }) {
  const color = STATUS_COLOR[agent.status] ?? "var(--color-jade)";
  const active = agent.status === "working";
  const grade = agent.report?.letter;
  const tint = TINT[agent.bay] ?? "#8b5cff";
  const props = PROPS[agent.bay] ?? ["•"];

  return (
    <motion.button
      layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -3 }}
      onClick={() => onSelect(agent.id)}
      className={cn("relative text-left rounded-lg overflow-hidden", active && "pulse-active", selected && "ring-2 ring-cyan-400/70", !agent.enabled && "opacity-40")}
      style={{ border: `1px solid ${active ? "var(--color-cyan)" : tint + "55"}`, background: `linear-gradient(180deg, ${tint}14 0%, rgba(6,8,20,0.92) 72%)`, boxShadow: active ? undefined : `0 0 14px ${tint}18` }}
    >
      {/* Nameplate above their head */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full text-[10px] font-mono whitespace-nowrap"
        style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${color}66`, color }}>
        {agent.callsign}{agent.progression ? ` · L${agent.progression.level}` : ""}
      </div>

      {/* Room interior */}
      <div className="relative h-[112px] mt-1">
        {/* back wall + faint job sigil */}
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: `linear-gradient(${tint}22 1px,transparent 1px),linear-gradient(90deg,${tint}1f 1px,transparent 1px)`, backgroundSize: "16px 16px" }} />
        <span className="absolute top-6 left-1/2 -translate-x-1/2 text-4xl opacity-10 select-none">{TOOL[agent.bay]}</span>
        {/* floor */}
        <div className="absolute bottom-0 inset-x-0 h-5" style={{ background: `linear-gradient(0deg, ${tint}33, transparent)`, borderTop: `1px solid ${tint}55` }} />
        {active && <div className="scanner absolute inset-0 pointer-events-none" />}

        {/* furniture in the corners */}
        <span className="absolute top-7 left-1.5 text-sm opacity-85">{props[0]}</span>
        {props[1] && <span className="absolute top-7 right-1.5 text-sm opacity-85">{props[1]}</span>}

        {/* status light */}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />

        {/* the moving character + animated tool */}
        <div className="absolute bottom-3.5 left-0 right-0 flex items-end justify-center gap-0.5">
          <div className={active ? "crew-working" : "crew-idle"} style={{ fontSize: "26px", lineHeight: 1 }}>
            {AVATAR[agent.bay] ?? "🤖"}
            {agent.sandboxed && <span className="text-[9px]">🧪</span>}
          </div>
          {active && <span className="worktool text-base">{TOOL[agent.bay]}</span>}
        </div>

        {/* live "what they're doing" */}
        {active && agent.lastAction && (
          <div className="absolute bottom-[68px] left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/75 text-[8px] text-cyan-200 whitespace-nowrap max-w-[140px] truncate">
            {agent.lastAction}<span className="animate-pulse">▌</span>
          </div>
        )}
      </div>

      {/* footer: job + model + status */}
      <div className="px-2 pb-2">
        <div className="text-[10px] uppercase tracking-wider truncate" style={{ color: tint }}>{agent.bay}</div>
        <div className="text-[9px] text-white/35 truncate h-3">{agent.role}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="font-mono text-[9px]" style={{ color }}>{agent.status}</span>
          <span className="font-mono text-[8px] text-white/30 truncate">{shortModel(agent.model)}</span>
          {grade && <span className="ml-auto font-mono text-[11px] font-bold" style={{ color: GRADE_COLOR[grade] }}>{grade}</span>}
        </div>
      </div>
    </motion.button>
  );
}

function InfraPanel({ title, icon, children, accent }: { title: string; icon: string; children: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-lg p-3 border bg-black/40" style={{ borderColor: `${accent}44`, boxShadow: `0 0 14px ${accent}18` }}>
      <div className="flex items-center gap-2"><span className="text-xl">{icon}</span><span className="text-[10px] uppercase tracking-wider text-white/40">{title}</span></div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function ShipView({ floor, agents, stats, onSelect, selectedId, accent = "#ff2bd6" }: {
  floor: Floor | null; agents: Agent[]; stats: Stats; onSelect: (id: string) => void; selectedId?: string; accent?: string;
}) {
  const capPct = stats.masterFundCapUsd > 0 ? Math.min(100, (stats.fundSpendUsd / stats.masterFundCapUsd) * 100) : 0;
  const working = agents.filter((a) => a.status === "working").length;
  const blocked = agents.filter((a) => a.status === "blocked").length;
  return (
    <div className="relative flex-1 overflow-hidden">
      {/* space backdrop */}
      <div className="absolute inset-0 space-bg starfield" />
      <div className="relative h-full overflow-y-auto p-4">
        <div className="hull p-4" style={{ borderColor: `${accent}88`, boxShadow: `0 0 44px ${accent}33, inset 0 0 60px ${accent}14` }}>
          {floor && (
            <div className="mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
              <div>
                <div className="font-mono text-glow" style={{ color: accent }}>{floor.name}</div>
                <div className="text-[11px] text-white/40">{floor.mission}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {agents.map((a) => <Room key={a.id} agent={a} onSelect={onSelect} selected={selectedId === a.id} />)}
            <InfraPanel title="Solar Array" icon="🔋" accent="#22e6ff">
              <div className="h-2 rounded bg-white/10 overflow-hidden">
                <div className="h-full" style={{ width: `${100 - capPct}%`, background: "var(--color-cyan)", boxShadow: "0 0 10px var(--color-cyan)" }} />
              </div>
              <div className="font-mono text-[11px] text-white/60 mt-1">{money(stats.creditsRemainingUsd)} · {Math.round(100 - capPct)}% power</div>
            </InfraPanel>
            <InfraPanel title="Engineering" icon="⚙️" accent="#8b5cff">
              <div className="font-mono text-[11px] text-white/60 space-y-0.5">
                <div>{working} working · {blocked} blocked</div>
                <div style={{ color: stats.emergencyStop ? "var(--color-danger)" : stats.paused ? "var(--color-amber)" : "var(--color-jade)" }}>
                  {stats.emergencyStop ? "EMERGENCY STOP" : stats.paused ? "PAUSED" : "all systems nominal"}
                </div>
              </div>
            </InfraPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

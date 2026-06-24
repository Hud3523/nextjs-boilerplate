import { motion } from "framer-motion";
import type { Agent } from "../types";
import { STATUS_COLOR, shortModel, cn } from "../lib/ui";

export function CrewRoster({ agents, onSelect, selectedId }: {
  agents: Agent[]; onSelect: (id: string) => void; selectedId?: string;
}) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-[var(--color-deep)]/70 border-r border-white/5 overflow-hidden">
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 border-b border-white/5">CREW · {agents.length}</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {agents.map((a) => {
          const color = STATUS_COLOR[a.status] ?? STATUS_COLOR.unknown;
          return (
            <motion.button key={a.id} layout onClick={() => onSelect(a.id)}
              className={cn("w-full text-left rounded-lg p-2 border transition-colors",
                selectedId === a.id ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]")}>
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", a.status === "working" && "pulse-active")} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="font-mono text-sm text-white/90">{a.name}</span>
                {a.parentId && <span className="text-[9px] text-white/25">sub</span>}
                <span className="ml-auto font-mono text-[10px]" style={{ color }}>{a.status}</span>
              </div>
              {a.role && <div className="text-[10px] text-white/45 truncate mt-0.5">{a.role}</div>}
              {a.model && <div className="text-[9px] font-mono text-violet-300/70 truncate mt-0.5">{shortModel(a.model)}</div>}
            </motion.button>
          );
        })}
        {agents.length === 0 && <div className="text-[11px] text-white/30 p-3">No agents. Connect Hermes (HERMES_MODE) to see your crew.</div>}
      </div>
    </aside>
  );
}

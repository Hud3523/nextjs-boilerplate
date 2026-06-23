import { motion } from "framer-motion";
import type { Agent } from "../types";
import { STATUS_COLOR, GRADE_COLOR, countdown, cn } from "../lib/ui";

export function CrewRoster({ agents, title, onSelect, selectedId }: {
  agents: Agent[]; title: string; onSelect: (id: string) => void; selectedId?: string;
}) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-[var(--color-deep)]/60 border-r border-white/5 overflow-hidden">
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 border-b border-white/5">{title} · {agents.length}</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {agents.map((a) => {
          const color = STATUS_COLOR[a.status] ?? "var(--color-jade)";
          const grade = a.report?.letter;
          return (
            <motion.button
              key={a.id}
              layout
              onClick={() => onSelect(a.id)}
              className={cn("w-full text-left rounded-lg p-2 border transition-colors",
                selectedId === a.id ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
                !a.enabled && "opacity-40")}
            >
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", a.status === "working" && "pulse-active")} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="font-mono text-sm text-white/90">{a.callsign}</span>
                {a.sandboxed && <span title="sandboxed" className="text-[9px]">🧪</span>}
                <span className="ml-auto font-mono text-[10px]" style={{ color }}>{a.status}</span>
                {a.progression && <span className="font-mono text-[10px] text-violet-300">L{a.progression.level}</span>}
                {grade && <span className="font-mono text-[11px] font-bold px-1 rounded" style={{ color: GRADE_COLOR[grade] }}>{grade}</span>}
              </div>
              <div className="text-[10px] text-white/40 truncate mt-0.5">{a.role}</div>
              <div className="text-[10px] text-white/30 truncate">
                {a.status === "working" ? a.lastAction : a.trigger !== "event" ? `next ${countdown(a.nextRunAt)}` : (a.lastAction ?? "awaiting work")}
              </div>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}

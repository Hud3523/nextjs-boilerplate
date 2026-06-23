import { motion } from "framer-motion";
import type { Agent } from "../types";
import { STATUS_COLOR, GRADE_COLOR, countdown, shortModel, cn } from "../lib/ui";

function doing(a: Agent): string {
  if (a.status === "working") return a.lastAction ?? "working…";
  if (a.status === "blocked") return "blocked — needs you";
  if (a.status === "needs-setup") return "needs setup";
  if (a.trigger !== "event") return `next cycle: ${countdown(a.nextRunAt)}`;
  return a.lastAction ?? "awaiting orders";
}

export function CrewRoster({ agents, title, onSelect, selectedId }: {
  agents: Agent[]; title: string; onSelect: (id: string) => void; selectedId?: string;
}) {
  return (
    <aside className="w-64 shrink-0 flex flex-col bg-[var(--color-deep)]/70 border-r border-white/5 overflow-hidden">
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 border-b border-white/5">CREW · {title} · {agents.length}</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {agents.map((a) => {
          const color = STATUS_COLOR[a.status] ?? "var(--color-jade)";
          const grade = a.report?.letter;
          return (
            <motion.button
              key={a.id} layout onClick={() => onSelect(a.id)}
              className={cn("w-full text-left rounded-lg p-2 border transition-colors",
                selectedId === a.id ? "border-cyan-400/60 bg-cyan-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]",
                !a.enabled && "opacity-40")}
            >
              <div className="flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", a.status === "working" && "pulse-active")} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="font-mono text-sm text-white/90">{a.callsign}</span>
                {a.sandboxed && <span title="sandboxed" className="text-[9px]">🧪</span>}
                {a.progression && <span className="font-mono text-[9px] text-violet-300">L{a.progression.level}</span>}
                {grade && <span className="ml-auto font-mono text-[11px] font-bold" style={{ color: GRADE_COLOR[grade] }}>{grade}</span>}
              </div>
              {/* job */}
              <div className="text-[10px] text-white/45 truncate mt-0.5">{a.role}</div>
              {/* what they're doing */}
              <div className="text-[10px] truncate" style={{ color: a.status === "working" ? "var(--color-cyan)" : a.status === "blocked" ? "var(--color-danger)" : "rgba(255,255,255,0.35)" }}>
                {doing(a)}
              </div>
              {/* model + trigger */}
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-mono px-1 rounded bg-violet-500/15 text-violet-300/80 truncate">{shortModel(a.model)}</span>
                <span className="text-[9px] text-white/25 truncate">{a.trigger === "event" ? "event-driven" : a.trigger === "solo" ? "solo · isolated" : `cycle ${a.intervalMinutes ?? ""}m`}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </aside>
  );
}

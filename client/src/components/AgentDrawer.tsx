import { useState } from "react";
import { motion } from "framer-motion";
import type { Agent, Task } from "../types";
import { api } from "../lib/api";
import { money, shortModel, STATUS_COLOR, cn } from "../lib/ui";

export function AgentDrawer({ agent, tasks, onClose, onChange }: {
  agent: Agent; tasks: Task[]; onClose: () => void; onChange: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = tasks.filter((t) => t.agent_id === agent.id).slice(0, 8);
  const color = STATUS_COLOR[agent.status] ?? STATUS_COLOR.unknown;

  async function assign() {
    if (!instruction.trim()) return;
    setBusy(true);
    try { await api.createTask(agent.id, instruction); setInstruction(""); onChange(); } finally { setBusy(false); }
  }

  return (
    <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed right-0 top-0 h-full w-full md:w-[440px] z-30 bg-[var(--color-panel)]/95 backdrop-blur border-l border-cyan-400/30 overflow-y-auto">
      <div className="sticky top-0 bg-[var(--color-panel)]/95 backdrop-blur p-4 border-b border-white/10 flex items-start justify-between">
        <div>
          <div className="font-mono text-lg text-cyan-300 text-glow flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />{agent.name}
          </div>
          <div className="text-[11px] text-white/50">{agent.role ?? "Hermes agent"}</div>
          {agent.model && <div className="text-[10px] text-violet-300/70 font-mono mt-0.5">{shortModel(agent.model)}</div>}
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white text-lg">✕</button>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">📋 Assign a job</div>
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={4} placeholder={`Tell ${agent.name} what to do…`}
            className="w-full bg-black/40 text-[12px] rounded p-2 border border-white/10 text-white/80" />
          <button disabled={busy || !instruction.trim()} onClick={assign}
            className="w-full mt-2 text-[12px] py-2 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 disabled:opacity-40">
            {busy ? "Sending to Hermes…" : "Send to Hermes"}
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">🗂️ Recent jobs</div>
          <div className="space-y-1">
            {mine.map((t) => (
              <div key={t.id} className="text-[11px] flex items-center gap-2 border-b border-white/5 pb-1">
                <span className={cn("font-mono text-[9px] px-1 rounded", statusCls(t.status))}>{t.status}</span>
                <span className="text-white/70 truncate flex-1">{t.instruction}</span>
                <span className="text-white/30 font-mono">{money(t.cost_usd, 4)}</span>
              </div>
            ))}
            {!mine.length && <div className="text-[11px] text-white/30">No jobs yet.</div>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function statusCls(s: string) {
  if (s === "needs_review") return "bg-amber-500/20 text-amber-300";
  if (s === "approved") return "bg-jade-500/20 text-[var(--color-jade)]";
  if (s === "running") return "bg-cyan-500/20 text-cyan-300";
  if (s === "rejected" || s === "error") return "bg-red-500/20 text-red-300";
  return "bg-white/10 text-white/50";
}

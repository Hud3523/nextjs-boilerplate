import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Snapshot } from "../types";
import { api } from "../lib/api";

interface Cmd { label: string; hint?: string; run: () => void | Promise<unknown>; }

export function CommandPalette({ snap, onSelectAgent, onClose, reload }: {
  snap: Snapshot; onSelectAgent: (id: string) => void; onClose: () => void; reload: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const close = (p?: void | Promise<unknown>) => { Promise.resolve(p).then(reload); onClose(); };
  const find = (name: string) => snap.agents.find((a) => a.name.toLowerCase() === name.toLowerCase() || a.id.toLowerCase() === name.toLowerCase());

  const cmds = useMemo<Cmd[]>(() => {
    const nl: Cmd[] = [];
    const tell = q.match(/^tell\s+(\S+)\s+(?:to\s+)?(.+)/i);
    if (tell) { const a = find(tell[1]); if (a) nl.push({ label: `Tell ${a.name}: "${tell[2]}"`, hint: "assign job", run: () => api.createTask(a.id, tell[2]) }); }
    const base: Cmd[] = [
      { label: `🛑 ${snap.stats.emergencyStop ? "Release" : "Engage"} Emergency Stop`, hint: "control", run: () => api.estop(!snap.stats.emergencyStop) },
      { label: `${snap.stats.dryRun ? "⚡ Arm real actions" : "↩ Back to dry-run"}`, hint: "control", run: () => api.arm(snap.stats.dryRun, snap.stats.dryRun ? 3 : undefined) },
    ];
    const agentCmds: Cmd[] = snap.agents.map((a) => ({ label: `Open ${a.name}`, hint: a.role ?? "agent", run: () => onSelectAgent(a.id) }));
    const all = [...nl, ...base, ...agentCmds];
    if (!q.trim()) return all.slice(0, 12);
    const lower = q.toLowerCase();
    return [...nl, ...[...base, ...agentCmds].filter((c) => c.label.toLowerCase().includes(lower))].slice(0, 12);
  }, [q, snap]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.97, y: -10 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[95vw] rounded-xl border border-cyan-400/40 bg-[var(--color-panel)]/95 overflow-hidden glow-cyan">
        <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, cmds.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && cmds[sel]) close(cmds[sel].run());
            if (e.key === "Escape") onClose();
          }}
          placeholder='Type a command… e.g. "tell Scout research phone cases"'
          className="w-full bg-transparent px-4 py-3 text-[13px] text-white/90 outline-none border-b border-white/10" />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {cmds.map((c, i) => (
            <button key={i} onMouseEnter={() => setSel(i)} onClick={() => close(c.run())}
              className={`w-full text-left px-4 py-2 flex items-center gap-2 ${i === sel ? "bg-cyan-500/15" : ""}`}>
              <span className="text-[13px] text-white/85 flex-1 truncate">{c.label}</span>
              {c.hint && <span className="text-[10px] text-white/30 font-mono">{c.hint}</span>}
            </button>
          ))}
          {!cmds.length && <div className="px-4 py-3 text-[12px] text-white/30">No matching command.</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

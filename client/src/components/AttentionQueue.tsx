import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Task } from "../types";
import { api } from "../lib/api";
import { ago, money } from "../lib/ui";

function Card({ task, onAct }: { task: Task; onAct: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.output ?? "");
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); } finally { onAct(); } };
  const err = task.status === "error";

  return (
    <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="rounded-lg border p-2.5 bg-[var(--color-panel)]/60" style={{ borderColor: err ? "rgba(255,59,92,0.5)" : "rgba(255,176,32,0.45)" }}>
      <div className="text-[12px] text-white/90 leading-tight">{task.agent_name ?? task.agent_id}</div>
      <div className="text-[10px] text-white/40 truncate">{task.instruction}</div>
      <div className="text-[9px] text-white/25 mt-0.5">{ago(task.created_at)} · {money(task.cost_usd, 4)}{task.model ? ` · ${task.model}` : ""}</div>

      <div className="mt-2 rounded bg-black/30 p-2 border border-white/5">
        {editing ? (
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6} className="w-full bg-black/40 text-[11px] font-mono text-white/80 rounded p-1.5 border border-cyan-400/30" />
        ) : (
          <div className="text-[11px] text-white/60 whitespace-pre-wrap line-clamp-6 font-mono">{task.output}</div>
        )}
        <div className="flex gap-1.5 mt-2">
          {editing ? (
            <>
              <button onClick={() => run(async () => { await api.editTask(task.id, draft); await api.approveTask(task.id); })} className="flex-1 text-[10px] py-1 rounded border" style={{ borderColor: "var(--color-jade)", color: "var(--color-jade)" }}>Save & Approve</button>
              <button onClick={() => setEditing(false)} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/60">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => run(() => api.approveTask(task.id))} className="flex-1 text-[10px] py-1 rounded border" style={{ borderColor: "var(--color-jade)", color: "var(--color-jade)" }}>✓ Approve</button>
              <button onClick={() => { setDraft(task.output ?? ""); setEditing(true); }} className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">Edit</button>
              <button onClick={() => run(() => api.rejectTask(task.id))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/40 text-red-300">✕ Kill</button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function AttentionQueue({ tasks, onAct }: { tasks: Task[]; onAct: () => void }) {
  const items = tasks.filter((t) => t.status === "needs_review" || t.status === "error");
  return (
    <aside className="w-full md:w-[340px] shrink-0 flex flex-col bg-[var(--color-deep)]/60 md:border-l border-white/5">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-widest text-white/40">⚡ Approval inbox</span>
        <span className="font-mono text-[11px] px-1.5 rounded bg-amber-500/20 text-amber-300">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence>
          {items.length === 0 && <div className="text-[11px] text-white/30 p-4 text-center">Nothing awaiting review. 🛰️</div>}
          {items.map((t) => <Card key={t.id} task={t} onAct={onAct} />)}
        </AnimatePresence>
      </div>
    </aside>
  );
}

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Snapshot, Attention, Task } from "../types";
import { api } from "../lib/api";
import { ago, cn } from "../lib/ui";

const SEV: Record<string, string> = { info: "var(--color-cyan)", warn: "var(--color-amber)", critical: "var(--color-danger)" };
const KIND_ICON: Record<string, string> = {
  approval: "✍️", opportunity: "💡", blocker: "⛔", escalation: "⚠️", alert: "🚨", agent_review: "🔍", directive: "🎯",
};

function ListingView({ output }: { output: string }) {
  try {
    const l = JSON.parse(output) as { title: string; description: string; tags: string[] };
    return (
      <div className="text-[11px] space-y-1">
        <div className="text-white/90 font-semibold">{l.title}</div>
        <div className="text-white/50 line-clamp-3">{l.description}</div>
        <div className="flex flex-wrap gap-1">{l.tags.map((t, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-[10px]">{t}</span>)}</div>
      </div>
    );
  } catch {
    return <div className="text-[11px] text-white/50 whitespace-pre-wrap line-clamp-4">{output}</div>;
  }
}

function Card({ item, task, onAct }: { item: Attention; task?: Task; onAct: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task?.output ?? "");
  const payload = item.payload ? safe(item.payload) : null;
  const isStructured = task?.structured === 1;

  async function run(fn: () => Promise<unknown>) { try { await fn(); } finally { onAct(); } }

  return (
    <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="rounded-lg border bg-[var(--color-panel)]/60 p-2.5" style={{ borderColor: `${SEV[item.severity]}55` }}>
      <div className="flex items-start gap-2">
        <span>{KIND_ICON[item.kind] ?? "•"}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-white/90 leading-tight">{item.title}</div>
          {item.body && <div className="text-[10px] text-white/45 mt-0.5 whitespace-pre-wrap line-clamp-3">{item.body}</div>}
          <div className="text-[9px] text-white/25 mt-0.5">{ago(item.ts)}</div>
        </div>
      </div>

      {/* Task draft preview + Approve / Edit / Kill */}
      {task && (item.kind === "approval") && (
        <div className="mt-2 rounded bg-black/30 p-2 border border-white/5">
          {editing ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={6}
              className="w-full bg-black/40 text-[11px] font-mono text-white/80 rounded p-1.5 border border-cyan-400/30" />
          ) : isStructured ? <ListingView output={task.output ?? ""} /> : (
            <div className="text-[11px] text-white/55 whitespace-pre-wrap line-clamp-5 font-mono">{task.output}</div>
          )}
          <div className="flex gap-1.5 mt-2">
            {editing ? (
              <>
                <button onClick={() => run(async () => { await api.editTask(task.id, draft); await api.approveTask(task.id); })}
                  className="flex-1 text-[10px] py-1 rounded bg-jade-500/20 border border-jade-400/40 text-[var(--color-jade)]" style={{ borderColor: "var(--color-jade)" }}>Save & Approve</button>
                <button onClick={() => setEditing(false)} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/60">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => run(() => api.approveTask(task.id))} className="flex-1 text-[10px] py-1 rounded bg-jade-500/15 border text-[var(--color-jade)]" style={{ borderColor: "var(--color-jade)" }}>✓ Approve</button>
                <button onClick={() => { setDraft(task.output ?? ""); setEditing(true); }} className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">Edit</button>
                <button onClick={() => run(() => api.rejectTask(task.id))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/40 text-red-300">✕ Kill</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Opportunity approve/kill */}
      {item.kind === "opportunity" && payload?.opportunityId && (
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => run(() => api.approveOpp(payload.opportunityId))} className="flex-1 text-[10px] py-1 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200">🏗️ Approve → Spawn Floor</button>
          <button onClick={() => run(() => api.killOpp(payload.opportunityId))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/40 text-red-300">Kill</button>
        </div>
      )}

      {/* Agent-spec / prompt-improvement approve/kill */}
      {(payload?.kind === "agent_spec" || payload?.kind === "prompt_improvement") && (
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => run(() => api.actAttention(item.id, "approve"))} className="flex-1 text-[10px] py-1 rounded bg-jade-500/15 border text-[var(--color-jade)]" style={{ borderColor: "var(--color-jade)" }}>✓ Approve</button>
          <button onClick={() => run(() => api.actAttention(item.id, "kill"))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 border border-red-500/40 text-red-300">Kill</button>
        </div>
      )}

      {/* Blockers / escalations / alerts → acknowledge */}
      {["blocker", "escalation", "alert"].includes(item.kind) && (
        <button onClick={() => run(() => api.resolveAttention(item.id))} className="w-full mt-2 text-[10px] py-1 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">Acknowledge</button>
      )}
    </motion.div>
  );
}

export function AttentionQueue({ snap, onAct }: { snap: Snapshot; onAct: () => void }) {
  const tasksById = new Map(snap.tasks.map((t) => [t.id, t]));
  const items = snap.attention;
  return (
    <aside className="w-full md:w-[340px] shrink-0 flex flex-col bg-[var(--color-deep)]/60 md:border-l border-white/5">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-widest text-white/40">⚡ Attention</span>
        <span className="font-mono text-[11px] px-1.5 rounded bg-amber-500/20 text-amber-300">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence>
          {items.length === 0 && <div className="text-[11px] text-white/30 p-4 text-center">Nothing needs you right now. 🛰️</div>}
          {items.map((it) => <Card key={it.id} item={it} task={it.task_id ? tasksById.get(it.task_id) : undefined} onAct={onAct} />)}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function safe(s: string): any { try { return JSON.parse(s); } catch { return null; } }

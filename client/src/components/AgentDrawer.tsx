import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { GRADE_COLOR, money, ago, cn } from "../lib/ui";

function Spark({ history }: { history: { score: number; ts: number }[] }) {
  if (history.length < 2) return null;
  const w = 120, h = 28, max = 100;
  const pts = history.map((p, i) => `${(i / (history.length - 1)) * w},${h - (p.score / max) * h}`).join(" ");
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" /></svg>;
}

export function AgentDrawer({ agentId, onClose, onChange }: { agentId: string; onClose: () => void; onChange: () => void }) {
  const [a, setA] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feasInput, setFeasInput] = useState("");
  const [feas, setFeas] = useState<any>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInput, setTaskInput] = useState("");

  const load = () => api.agent(agentId).then(setA).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [agentId]);

  if (!a) return null;
  const report = a.report ?? { latest: null, letter: null, history: [] };

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); await load(); onChange(); } finally { setBusy(null); }
  }

  const lastTask = a.tasks?.[0];

  return (
    <motion.div initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="fixed right-0 top-0 h-full w-[460px] z-30 bg-[var(--color-panel)]/95 backdrop-blur border-l border-cyan-400/30 overflow-y-auto">
      <div className="sticky top-0 bg-[var(--color-panel)]/95 backdrop-blur p-4 border-b border-white/10 flex items-start justify-between">
        <div>
          <div className="font-mono text-lg text-cyan-300 text-glow">{a.callsign}</div>
          <div className="text-[11px] text-white/50">{a.role}</div>
          <div className="text-[10px] text-white/30 mt-0.5">{a.bay} · {a.trigger}{a.sandboxed ? " · 🧪 sandboxed" : ""}</div>
        </div>
        <div className="flex items-center gap-3">
          {report.letter && <span className="font-mono text-2xl font-bold" style={{ color: GRADE_COLOR[report.letter] }}>{report.letter}</span>}
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">✕</button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Report card */}
        <Section title="🎓 Report Card">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-white/80">{report.latest != null ? `${report.latest}/100` : "ungraded"}</span>
            <Spark history={report.history} />
          </div>
          <div className="flex gap-1.5 mt-2">
            <button disabled={busy != null} onClick={() => run("train", () => api.train(agentId, "dry-run"))}
              className="flex-1 text-[11px] py-1.5 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200 disabled:opacity-40">
              {busy === "train" ? "Training…" : "▶ Training Run (dry-run)"}
            </button>
            <button disabled={busy != null} onClick={() => run("trainm", () => api.train(agentId, "mock"))}
              className="text-[11px] px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white/60 disabled:opacity-40">Mock</button>
          </div>
        </Section>

        {/* Test Lab */}
        <Section title="🧪 Test Lab — Feasibility">
          <input value={feasInput} onChange={(e) => setFeasInput(e.target.value)} placeholder="Describe a task… would it work?"
            className="w-full bg-black/40 text-[12px] rounded p-2 border border-white/10 text-white/80" />
          <button disabled={!feasInput} onClick={() => run("feas", async () => setFeas(await api.feasibility(agentId, feasInput)))}
            className="w-full mt-1.5 text-[11px] py-1.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 disabled:opacity-40">Check feasibility</button>
          {feas && <div className="mt-2 text-[11px] text-white/60"><span className="text-cyan-300 font-mono">{Math.round(feas.confidence * 100)}% confident</span> — {feas.reasoning}</div>}
        </Section>

        {/* Assign a task */}
        <Section title="📋 Assign Task">
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Title"
            className="w-full bg-black/40 text-[12px] rounded p-2 border border-white/10 text-white/80 mb-1.5" />
          <textarea value={taskInput} onChange={(e) => setTaskInput(e.target.value)} rows={3} placeholder="Instructions / product brief…"
            className="w-full bg-black/40 text-[12px] rounded p-2 border border-white/10 text-white/80" />
          <button disabled={!taskTitle || !taskInput || busy != null}
            onClick={() => run("task", async () => { await api.createTask({ agentId, title: taskTitle, input: taskInput }); setTaskTitle(""); setTaskInput(""); })}
            className="w-full mt-1.5 text-[11px] py-1.5 rounded bg-jade-500/15 border text-[var(--color-jade)] disabled:opacity-40" style={{ borderColor: "var(--color-jade)" }}>Queue task</button>
        </Section>

        {/* Recent tasks */}
        <Section title="🗂️ Recent Tasks">
          <div className="space-y-1">
            {(a.tasks ?? []).slice(0, 6).map((t: any) => (
              <div key={t.id} className="text-[11px] flex items-center gap-2 border-b border-white/5 pb-1">
                <span className={cn("font-mono text-[9px] px-1 rounded", statusCls(t.status))}>{t.status}</span>
                <span className="text-white/70 truncate flex-1">{t.title}</span>
                <span className="text-white/30 font-mono">{money(t.cost_usd, 4)}</span>
              </div>
            ))}
            {(!a.tasks || a.tasks.length === 0) && <div className="text-[11px] text-white/30">No tasks yet.</div>}
          </div>
        </Section>

        {/* Config + guardrails */}
        <Section title="⚙️ Config">
          <Row k="Model" v={a.model} />
          <Row k="Tools" v={(a.allowedTools ?? []).join(", ") || "—"} />
          <div className="text-[10px] text-white/40 mt-1">Guardrails (inherited):</div>
          <ul className="text-[10px] text-white/50 list-disc pl-4">{(a.guardrails ?? []).map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>
          <details className="mt-2"><summary className="text-[10px] text-white/40 cursor-pointer">System prompt</summary>
            <div className="text-[10px] text-white/50 whitespace-pre-wrap mt-1 font-mono bg-black/30 p-2 rounded">{a.systemPrompt}</div>
          </details>
        </Section>

        {/* Raw debug log */}
        {lastTask?.raw_response && (
          <Section title="🐞 Raw Log (last task)">
            <details><summary className="text-[10px] text-white/40 cursor-pointer">Prompt → Response</summary>
              <div className="text-[10px] text-white/45 whitespace-pre-wrap mt-1 font-mono bg-black/30 p-2 rounded max-h-48 overflow-y-auto">
                {lastTask.raw_prompt}{"\n\n--- RESPONSE ---\n"}{lastTask.raw_response}
              </div>
            </details>
          </Section>
        )}
      </div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{title}</div>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between text-[11px] py-0.5"><span className="text-white/40">{k}</span><span className="text-white/70 font-mono">{v}</span></div>; }
function statusCls(s: string) {
  if (s === "needs_review") return "bg-amber-500/20 text-amber-300";
  if (s === "done" || s === "approved") return "bg-jade-500/20 text-[var(--color-jade)]";
  if (s === "running" || s === "reviewing") return "bg-cyan-500/20 text-cyan-300";
  if (s === "rejected") return "bg-red-500/20 text-red-300";
  return "bg-white/10 text-white/50";
}

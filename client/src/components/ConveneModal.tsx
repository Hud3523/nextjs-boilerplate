import { useState } from "react";
import { motion } from "framer-motion";
import type { Snapshot, Agent } from "../types";
import { api } from "../lib/api";
import { GRADE_COLOR, cn } from "../lib/ui";

type Mode = "meeting" | "training" | "coaching";
const MODE_INFO: Record<Mode, { icon: string; blurb: string }> = {
  meeting: { icon: "🗣️", blurb: "The selected crew hold a roundtable — they talk, cross-pollinate ideas, and Chair saves a shared lesson to memory." },
  training: { icon: "🎓", blurb: "Run a graded training cycle on each selected agent against their golden tests." },
  coaching: { icon: "🧑‍🏫", blurb: "Foreman reviews each selected agent and gives specific, actionable coaching." },
};

export function ConveneModal({ snap, initialMode, onClose, onChange }: {
  snap: Snapshot; initialMode: Mode; onClose: () => void; onChange: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const agents = snap.agents.filter((a) => a.enabled);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pickAll = () => setPicked(new Set(agents.map((a) => a.id)));

  async function run() {
    if (!picked.size) return;
    setBusy(true); setResult(null);
    try { setResult(await api.convene(mode, [...picked], topic || undefined)); onChange(); }
    finally { setBusy(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-[720px] max-w-[96vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[var(--color-panel)]/95 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-cyan-300 text-glow">🏛️ MEETING HALL</div>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        {/* mode tabs */}
        <div className="flex gap-1.5 mb-2">
          {(["meeting", "training", "coaching"] as Mode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setResult(null); }}
              className={cn("flex-1 text-[12px] py-2 rounded border font-mono capitalize", mode === m ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200" : "bg-white/5 border-white/10 text-white/50")}>
              {MODE_INFO[m].icon} {m}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-white/45 mb-3">{MODE_INFO[mode].blurb}</div>

        {/* pick agents */}
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Pick agents · {picked.size} selected</div>
          <div className="flex gap-2"><button onClick={pickAll} className="text-[10px] text-cyan-300">all</button><button onClick={() => setPicked(new Set())} className="text-[10px] text-white/40">clear</button></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3 max-h-[34vh] overflow-y-auto">
          {agents.map((a) => (
            <button key={a.id} onClick={() => toggle(a.id)}
              className={cn("text-left rounded-lg p-2 border", picked.has(a.id) ? "border-cyan-400/60 bg-cyan-500/15" : "border-white/10 bg-white/[0.02]")}>
              <div className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full", picked.has(a.id) && "bg-cyan-400")} style={{ background: picked.has(a.id) ? "var(--color-cyan)" : "rgba(255,255,255,0.2)" }} />
                <span className="font-mono text-[12px] text-white/85">{a.callsign}</span>
                {a.report?.letter && <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: GRADE_COLOR[a.report.letter] }}>{a.report.letter}</span>}
              </div>
              <div className="text-[9px] text-white/35 truncate">{a.role}</div>
            </button>
          ))}
        </div>

        {mode !== "training" && (
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={mode === "meeting" ? "Meeting topic (optional)" : "What to coach on (optional)"}
            className="w-full bg-black/40 text-[12px] rounded p-2 border border-white/10 text-white/80 mb-3" />
        )}

        <button disabled={busy || !picked.size} onClick={run}
          className="w-full text-[12px] py-2.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 disabled:opacity-40">
          {busy ? "In session…" : `Start ${mode} with ${picked.size || "…"} agent${picked.size === 1 ? "" : "s"}`}
        </button>

        {/* results */}
        {result && (
          <div className="mt-4">
            {result.mode === "meeting" && (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Roundtable</div>
                <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                  {(result.transcript ?? []).map((t: any, i: number) => (
                    <div key={i} className="text-[12px]"><span className="font-mono text-cyan-300">{t.speaker}:</span> <span className="text-white/70">{t.line}</span></div>
                  ))}
                </div>
                {result.takeaway && <div className="mt-2 text-[11px] text-jade-300 border-t border-white/10 pt-2" style={{ color: "var(--color-jade)" }}>🧠 Saved to memory: {result.takeaway}</div>}
              </div>
            )}
            {result.mode === "training" && (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-1">
                {(result.grades ?? []).map((g: any, i: number) => (
                  <div key={i} className="flex justify-between text-[12px]"><span className="text-white/80">{g.callsign}</span><span className="font-mono font-bold" style={{ color: GRADE_COLOR[g.letter] }}>{g.letter} ({g.avg})</span></div>
                ))}
              </div>
            )}
            {result.mode === "coaching" && (
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                {(result.tips ?? []).map((t: any, i: number) => (
                  <div key={i} className="text-[12px]"><span className="font-mono text-cyan-300">{t.callsign}:</span> <span className="text-white/70">{t.tip}</span></div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

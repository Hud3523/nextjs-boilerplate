import { motion } from "framer-motion";
import type { Snapshot } from "../types";
import { money } from "../lib/ui";

/** Daily briefing: what every agency did, what needs you, P&L, top opportunities. */
export function BriefingModal({ snap, onClose }: { snap: Snapshot; onClose: () => void }) {
  const b = snap.briefing;
  const lessons = (snap.memory ?? []).filter((m: any) => m.kind === "lesson").slice(0, 4);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-w-[95vw] max-h-[88vh] overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[var(--color-panel)]/95 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-cyan-300 text-glow">📋 DAILY BRIEFING</div>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 font-mono">
          <Stat label="Needs you" v={String(b.pendingApprovals)} c="var(--color-amber)" />
          <Stat label="Blocked" v={String(b.blocked)} c="var(--color-danger)" />
          <Stat label="Net (league)" v={money(b.consolidatedNet)} c="var(--color-jade)" />
        </div>

        <Block title="🏁 Standings">
          {b.leaderboard.map((l) => (
            <Line key={l.name} left={`#${l.rank} ${l.name}`} right={`${l.net >= 0 ? "+" : ""}${money(l.net)}`} dim={l.status !== "active"} />
          ))}
        </Block>

        <Block title="💡 Top opportunities awaiting you">
          {b.topOpportunities.length ? b.topOpportunities.map((o, i) => (
            <Line key={i} left={o.title} right={`${(o.confidence * 100).toFixed(0)}%`} />
          )) : <Empty>None right now.</Empty>}
        </Block>

        <Block title="🧠 Recent lessons learned">
          {lessons.length ? lessons.map((m: any) => (
            <div key={m.id} className="text-[11px] text-white/60 border-b border-white/5 py-1"><span className="text-cyan-300">{m.title}:</span> {m.content}</div>
          )) : <Empty>No lessons yet.</Empty>}
        </Block>

        <div className="text-[10px] text-white/30 mt-3">Generated {new Date(b.generatedAt).toLocaleString()} · {b.season ?? "no season"}</div>
      </motion.div>
    </motion.div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-3"><div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{title}</div>{children}</div>;
}
function Line({ left, right, dim }: { left: string; right: string; dim?: boolean }) {
  return <div className={`flex justify-between text-[12px] py-0.5 ${dim ? "opacity-40" : ""}`}><span className="text-white/80 truncate pr-2">{left}</span><span className="font-mono text-white/60">{right}</span></div>;
}
function Stat({ label, v, c }: { label: string; v: string; c: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-center"><div className="text-[9px] uppercase text-white/30">{label}</div><div className="text-lg" style={{ color: c }}>{v}</div></div>;
}
function Empty({ children }: { children: React.ReactNode }) { return <div className="text-[11px] text-white/30">{children}</div>; }

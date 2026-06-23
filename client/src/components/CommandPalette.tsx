import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Snapshot } from "../types";
import { api } from "../lib/api";

interface Cmd { label: string; hint?: string; run: () => void | Promise<unknown>; }

export function CommandPalette({ snap, actions, onClose }: {
  snap: Snapshot;
  actions: { goto: (v: "deck" | "fleet" | "treasury" | "org") => void; openCommissioner: () => void; openBriefing: () => void; openDirective: () => void; selectAgent: (id: string) => void; reload: () => void };
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const close = (p?: void | Promise<unknown>) => { Promise.resolve(p).then(actions.reload); onClose(); };

  const cmds = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      { label: "Go to Deck", hint: "view", run: () => actions.goto("deck") },
      { label: "Go to Fleet", hint: "view", run: () => actions.goto("fleet") },
      { label: "Go to Money / Treasury", hint: "view", run: () => actions.goto("treasury") },
      { label: "Go to Org graph", hint: "view", run: () => actions.goto("org") },
      { label: "Open Control Room", hint: "panel", run: actions.openCommissioner },
      { label: "Open Daily Briefing", hint: "panel", run: actions.openBriefing },
      { label: "Issue a Directive…", hint: "action", run: actions.openDirective },
      { label: `🛑 ${snap.stats.emergencyStop ? "Release" : "Engage"} Emergency Stop`, hint: "control", run: () => api.emergencyStop(!snap.stats.emergencyStop) },
    ];
    // NL parsing — surfaced as the top command when matched.
    const nl: Cmd[] = [];
    const tell = q.match(/^tell\s+(\w+)\s+to\s+(.+)/i);
    const grade = q.match(/^grade\s+(\w+)/i);
    const findAgent = (name: string) => snap.agents.find((a) => a.callsign.toLowerCase() === name.toLowerCase());
    if (tell) {
      const a = findAgent(tell[1]);
      if (a) nl.push({ label: `Tell ${a.callsign}: "${tell[2]}"`, hint: "new task", run: () => api.createTask({ agentId: a.id, title: tell[2].slice(0, 40), input: tell[2] }) });
    }
    if (grade) {
      const a = findAgent(grade[1]);
      if (a) nl.push({ label: `Run training for ${a.callsign}`, hint: "grade", run: () => api.train(a.id, "dry-run") });
    }
    const ideas = q.match(/^(?:ideas?|brainstorm)\b(?:\s+(?:for|about|on))?\s+(.+)/i);
    if (ideas) {
      const m = snap.agents.find((a) => a.callsign.toLowerCase() === "muse");
      if (m) nl.push({ label: `Ask Muse for ideas: "${ideas[1]}"`, hint: "ideation", run: () => api.createTask({ agentId: m.id, title: `Ideas: ${ideas[1].slice(0, 40)}`, input: `Give me ideas for: ${ideas[1]}` }) });
    }
    if (/^(find|launch|grow|make|build)\b/i.test(q)) nl.push({ label: `Issue directive: "${q}"`, hint: "directive", run: () => api.createDirective(q) });

    const agentCmds: Cmd[] = snap.agents.map((a) => ({ label: `Open ${a.callsign}`, hint: a.role, run: () => actions.selectAgent(a.id) }));
    const all = [...nl, ...base, ...agentCmds];
    if (!q.trim()) return all.slice(0, 12);
    const lower = q.toLowerCase();
    return [...nl, ...[...base, ...agentCmds].filter((c) => c.label.toLowerCase().includes(lower) || c.hint?.toLowerCase().includes(lower))].slice(0, 12);
  }, [q, snap, actions]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.97, y: -10 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[95vw] rounded-xl border border-cyan-400/40 bg-[var(--color-panel)]/95 overflow-hidden glow-cyan">
        <input autoFocus value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, cmds.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter" && cmds[sel]) close(cmds[sel].run());
            if (e.key === "Escape") onClose();
          }}
          placeholder='Type a command… e.g. "tell Forge to draft a mug listing", "grade Nova", "find me money"'
          className="w-full bg-transparent px-4 py-3 text-[13px] text-white/90 outline-none border-b border-white/10" />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {cmds.map((c, i) => (
            <button key={i} onMouseEnter={() => setSel(i)} onClick={() => close(c.run())}
              className={`w-full text-left px-4 py-2 flex items-center gap-2 ${i === sel ? "bg-cyan-500/15" : ""}`}>
              <span className="text-[13px] text-white/85 flex-1 truncate">{c.label}</span>
              {c.hint && <span className="text-[10px] text-white/30 font-mono">{c.hint}</span>}
            </button>
          ))}
          {cmds.length === 0 && <div className="px-4 py-3 text-[12px] text-white/30">No matching command.</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

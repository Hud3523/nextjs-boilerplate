import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";

export function DirectiveModal({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const [tab, setTab] = useState<"directive" | "agent">("directive");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (tab === "directive") {
        await api.createDirective(text);
        setMsg("Directive received — Commander is decomposing it. Check the Attention queue for ranked opportunities to approve.");
      } else {
        await api.proposeAgent(text);
        setMsg("Architect drafted an agent — approve it in the Attention queue to bring it online (hot-loaded).");
      }
      setText(""); onChange();
    } finally { setBusy(false); }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[95vw] rounded-2xl border border-violet-400/30 bg-[var(--color-panel)]/95 p-5">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setTab("directive")} className={tabCls(tab === "directive")}>🎯 Directive</button>
          <button onClick={() => setTab("agent")} className={tabCls(tab === "agent")}>🛠️ New Agent</button>
          <button onClick={onClose} className="ml-auto text-white/40 hover:text-white">✕</button>
        </div>
        <div className="text-[11px] text-white/50 mb-2">
          {tab === "directive"
            ? "Give a high-level goal. Atlas decomposes it, Vega scouts ranked opportunities, and you approve which ones spawn a purpose-built floor."
            : "Describe an agent in plain language. Architect drafts a config from the Tool Registry; you approve before it goes live."}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
          placeholder={tab === "directive" ? "e.g. find ways to make me money" : "e.g. an agent that researches trending TikTok sounds"}
          className="w-full bg-black/40 text-[13px] rounded p-2.5 border border-white/10 text-white/85" />
        <button disabled={busy || !text.trim()} onClick={submit}
          className="w-full mt-3 text-[12px] py-2 rounded bg-violet-500/25 border border-violet-400/50 text-violet-100 disabled:opacity-40">
          {busy ? "Working…" : tab === "directive" ? "Issue directive" : "Draft agent"}
        </button>
        {msg && <div className="text-[11px] text-cyan-300 mt-3">{msg}</div>}
      </motion.div>
    </motion.div>
  );
}

function tabCls(active: boolean) {
  return `font-mono text-[11px] px-3 py-1.5 rounded border ${active ? "bg-violet-500/20 border-violet-400/50 text-violet-200" : "bg-white/5 border-white/10 text-white/50"}`;
}

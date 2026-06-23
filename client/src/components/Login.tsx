import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pw) return;
    setBusy(true); setErr("");
    try { await api.login(pw); onSuccess(); }
    catch { setErr("Wrong password — try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="h-full flex items-center justify-center relative z-10 p-6">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-[360px] max-w-[92vw] rounded-2xl border border-cyan-400/30 bg-[var(--color-panel)]/90 p-6 glow-cyan text-center">
        <div className="text-4xl mb-2">🛰️</div>
        <div className="font-mono text-cyan-300 text-glow tracking-[0.2em]">MISSION CONTROL</div>
        <div className="text-[11px] text-white/40 mb-5">Operator login</div>
        <input type="password" autoFocus value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          className="w-full bg-black/40 text-center text-[14px] rounded p-2.5 border border-white/15 text-white/90 outline-none focus:border-cyan-400/60" />
        <button disabled={busy || !pw} onClick={submit}
          className="w-full mt-3 text-[12px] py-2.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-100 disabled:opacity-40">
          {busy ? "Authenticating…" : "Enter command deck"}
        </button>
        {err && <div className="text-[11px] text-red-400 mt-3">{err}</div>}
      </motion.div>
    </div>
  );
}

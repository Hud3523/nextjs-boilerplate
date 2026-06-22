import { useState } from "react";
import { motion } from "framer-motion";
import type { Snapshot } from "../types";
import { api } from "../lib/api";
import { money, cn } from "../lib/ui";

export function Commissioner({ snap, onClose, onChange }: { snap: Snapshot; onClose: () => void; onChange: () => void }) {
  const s = snap.settings;
  const [fundCap, setFundCap] = useState(String(s.masterFundCapUsd));
  const [drawdown, setDrawdown] = useState(String(s.drawdownPct));
  const [model, setModel] = useState(s.model);
  const [mode, setMode] = useState(s.tournamentMode);
  const [armStep, setArmStep] = useState(0); // triple-confirm counter
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    await api.saveSettings({ masterFundCapUsd: Number(fundCap), drawdownPct: Number(drawdown), model, tournamentMode: mode });
    onChange(); setMsg("Settings saved.");
  }

  async function arm() {
    const next = armStep + 1;
    if (next < 3) { setArmStep(next); setMsg(`Are you sure? (${next}/3) Live mode allows real API spend.`); return; }
    try {
      await api.setDryRun(false, 3);
      setMsg("⚡ LIVE mode armed.");
    } catch (e: any) {
      setMsg(e.data?.error ?? "Could not arm.");
    }
    setArmStep(0); onChange();
  }

  async function disarm() { await api.setDryRun(true); onChange(); setMsg("Back to DRY-RUN."); }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
        className="w-[640px] max-h-[88vh] overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[var(--color-panel)]/95 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono text-cyan-300 text-glow">🎛️ COMMISSIONER CONTROL ROOM</div>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        {/* Money guardrails */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Panel title="Execution mode">
            <div className="text-[11px] text-white/50 mb-2">{s.dryRun ? "DRY-RUN — zero real spend." : "LIVE — real API spend possible."}</div>
            {s.dryRun ? (
              <button onClick={arm} disabled={!s.apiKeyConfigured}
                className={cn("w-full text-[11px] py-2 rounded border font-bold disabled:opacity-40",
                  armStep > 0 ? "bg-magenta-500/30 border-magenta-400 text-[var(--color-magenta)]" : "bg-magenta-500/15 border-magenta-400/50 text-magenta-200")}
                style={{ borderColor: "var(--color-magenta)" }}>
                {armStep === 0 ? "⚡ Arm LIVE mode" : `Confirm ${armStep}/3 — click again`}
              </button>
            ) : (
              <button onClick={disarm} className="w-full text-[11px] py-2 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-200">↩ Return to DRY-RUN</button>
            )}
            {!s.apiKeyConfigured && <div className="text-[10px] text-amber-400 mt-1">Set ANTHROPIC_API_KEY in .env to arm.</div>}
          </Panel>

          <Panel title="Freeze / Pause">
            <button onClick={() => { api.emergencyStop(!s.emergencyStop); onChange(); }}
              className={cn("w-full text-[11px] py-2 rounded border font-bold mb-1.5", s.emergencyStop ? "bg-red-500/30 border-red-400 text-red-200 pulse-active" : "bg-red-500/15 border-red-500/50 text-red-300")}>
              🛑 {s.emergencyStop ? "Release E-STOP" : "EMERGENCY STOP"}
            </button>
            <button onClick={() => { api.pause(!s.paused); onChange(); }}
              className="w-full text-[11px] py-1.5 rounded bg-white/5 border border-white/10 text-white/70">{s.paused ? "Resume agents" : "Pause agents"}</button>
          </Panel>
        </div>

        {/* Caps + settings */}
        <Panel title="Fund & governance">
          <Field label={`Master fund cap (real $, spent ${money(snap.stats.fundSpendUsd, 4)})`} value={fundCap} onChange={setFundCap} />
          <Field label="Per-agency drawdown breaker (%)" value={drawdown} onChange={setDrawdown} />
          <Field label="Default model" value={model} onChange={setModel} text />
          <div className="text-[11px] text-white/50 mb-1 mt-2">Tournament mode</div>
          <div className="flex gap-1.5">
            {["profit", "efficiency", "survival", "niche"].map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("text-[10px] px-2 py-1 rounded border", mode === m ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-200" : "bg-white/5 border-white/10 text-white/50")}>{m}</button>
            ))}
          </div>
          <button onClick={save} className="w-full mt-3 text-[11px] py-2 rounded bg-violet-500/20 border border-violet-400/40 text-violet-200">Save settings</button>
          <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-white/40">
            <div>Depth cap: {s.maxDepth}</div><div>Agents/floor: {s.maxAgentsPerFloor}</div><div>Active floors: {s.maxActiveFloors}</div>
          </div>
        </Panel>

        {/* Consolidated P&L */}
        <Panel title="Consolidated fund P&L">
          <div className="grid grid-cols-3 gap-2 font-mono text-[12px]">
            <Stat label="Sim revenue" v={money(snap.stats.revenueUsd)} c="var(--color-jade)" />
            <Stat label="Real spend" v={money(snap.stats.fundSpendUsd, 4)} c="var(--color-magenta)" />
            <Stat label="Net (league)" v={money(snap.leaderboard.reduce((n, b) => n + b.net, 0))} c="var(--color-cyan)" />
          </div>
        </Panel>

        {msg && <div className="text-[11px] text-cyan-300 mt-3 font-mono">{msg}</div>}
      </motion.div>
    </motion.div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-3 mb-3"><div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{title}</div>{children}</div>;
}
function Field({ label, value, onChange, text }: { label: string; value: string; onChange: (v: string) => void; text?: boolean }) {
  return (
    <label className="block mb-2">
      <span className="text-[11px] text-white/50">{label}</span>
      <input type={text ? "text" : "number"} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/40 text-[12px] rounded p-1.5 border border-white/10 text-white/80 font-mono mt-0.5" />
    </label>
  );
}
function Stat({ label, v, c }: { label: string; v: string; c: string }) {
  return <div><div className="text-[9px] uppercase text-white/30">{label}</div><div style={{ color: c }}>{v}</div></div>;
}

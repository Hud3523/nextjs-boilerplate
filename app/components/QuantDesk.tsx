"use client";

import { useState } from "react";

// Two code-word-gated quant bots: TradingView signals + Polymarket edge scanner.
// Enter the code word ("Money" by default) to reveal the picks + reasoning.

type Signal = {
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  score: number;
  confidence: number;
  price: number;
  changePct: number;
  rsi: number | null;
  reasons: string[];
};

type Opportunity = {
  id: string;
  question: string;
  slug?: string;
  volume: number;
  liquidity: number;
  endDate?: string;
  impliedYes: number;
  mispricing?: { sum: number; type: string };
  model?: {
    spot: number;
    vol: number;
    years: number;
    modelYes: number;
    edge: {
      side: "YES" | "NO";
      edge: number;
      evPerDollar: number;
      halfKelly: number;
    };
  };
  reasons: string[];
};

const actionColor: Record<string, string> = {
  BUY: "#34d399",
  SELL: "#f87171",
  HOLD: "#94a3b8",
};

function Disclaimer() {
  return (
    <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[0.7rem] text-amber-200/80">
      ⚠️ Estimates only — not financial advice. These bots find statistical{" "}
      <em>edge</em> and probabilities; no outcome is guaranteed. Never stake more than you can lose.
    </p>
  );
}

function CodeGate({
  unlocked,
  code,
  setCode,
  onUnlock,
  loading,
}: {
  unlocked: boolean;
  code: string;
  setCode: (v: string) => void;
  onUnlock: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onUnlock()}
        placeholder="Enter code word…"
        className="w-40 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400/60"
      />
      <button
        onClick={onUnlock}
        disabled={loading || !code}
        className="rounded-lg border border-sky-400/50 bg-sky-400/10 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-400/20 disabled:opacity-50"
      >
        {loading ? "Scanning…" : unlocked ? "↻ Rescan" : "🔓 Unlock"}
      </button>
    </div>
  );
}

export default function QuantDesk() {
  const [code, setCode] = useState("");

  const [sigLoading, setSigLoading] = useState(false);
  const [sigErr, setSigErr] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[] | null>(null);

  const [edgeLoading, setEdgeLoading] = useState(false);
  const [edgeErr, setEdgeErr] = useState<string | null>(null);
  const [opps, setOpps] = useState<Opportunity[] | null>(null);

  async function runSignals() {
    setSigLoading(true);
    setSigErr(null);
    try {
      const res = await fetch("/api/signals/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, top: 4 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setSignals(json.signals ?? []);
    } catch (e) {
      setSigErr(String(e instanceof Error ? e.message : e));
      setSignals(null);
    } finally {
      setSigLoading(false);
    }
  }

  async function runEdges() {
    setEdgeLoading(true);
    setEdgeErr(null);
    try {
      const res = await fetch("/api/polymarket/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, top: 4 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed");
      setOpps(json.opportunities ?? []);
    } catch (e) {
      setEdgeErr(String(e instanceof Error ? e.message : e));
      setOpps(null);
    } finally {
      setEdgeLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold holo-text">Quant Desk</h2>
        <p className="text-sm text-slate-400">
          Two bots, one code word. Enter your code word to unlock the top picks and the
          full reasoning behind each. Default code word: <code className="text-slate-300">Money</code>.
        </p>
      </header>

      {/* ---- TradingView Signals Bot ---- */}
      <section className="glass rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-medium">
              📈 TradingView Signals Bot
              <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[0.55rem] text-emerald-200">
                BEST 4
              </span>
            </h3>
            <p className="text-[0.7rem] text-slate-500">
              Trend + MACD + momentum + RSI blended into one conviction score.
            </p>
          </div>
          <CodeGate
            unlocked={!!signals}
            code={code}
            setCode={setCode}
            onUnlock={runSignals}
            loading={sigLoading}
          />
        </div>

        {sigErr && <p className="mt-3 text-sm text-red-300">{sigErr}</p>}

        {signals && signals.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">No signals returned (data source unreachable?).</p>
        )}

        {signals && signals.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {signals.map((s, i) => (
              <div key={s.symbol} className="rounded-lg border border-[var(--border)] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">#{i + 1}</span>
                    <span className="font-medium">{s.symbol.split(":")[1] ?? s.symbol}</span>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
                    style={{ background: `${actionColor[s.action]}22`, color: actionColor[s.action] }}
                  >
                    {s.action}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[0.7rem] text-slate-400">
                  <span>${s.price.toLocaleString()}</span>
                  <span style={{ color: s.changePct >= 0 ? "#34d399" : "#f87171" }}>
                    {s.changePct >= 0 ? "▲" : "▼"} {Math.abs(s.changePct).toFixed(2)}%
                  </span>
                  {s.rsi != null && <span>RSI {s.rsi.toFixed(0)}</span>}
                  <span className="ml-auto">conf {s.confidence}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.confidence}%`, background: actionColor[s.action] }}
                  />
                </div>
                <ul className="mt-2 space-y-0.5 text-[0.7rem] text-slate-400">
                  {s.reasons.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <Disclaimer />
      </section>

      {/* ---- Polymarket Edge Scanner Bot ---- */}
      <section className="glass rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-medium">
              🎲 Polymarket Edge Bot
              <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[0.55rem] text-emerald-200">
                BEST 4
              </span>
            </h3>
            <p className="text-[0.7rem] text-slate-500">
              Model probability (price + volatility) vs market price → edge, EV & Kelly sizing.
            </p>
          </div>
          <CodeGate
            unlocked={!!opps}
            code={code}
            setCode={setCode}
            onUnlock={runEdges}
            loading={edgeLoading}
          />
        </div>

        {edgeErr && <p className="mt-3 text-sm text-red-300">{edgeErr}</p>}

        {opps && opps.length === 0 && (
          <p className="mt-3 text-sm text-slate-400">No opportunities returned (data source unreachable?).</p>
        )}

        {opps && opps.length > 0 && (
          <div className="mt-3 space-y-2">
            {opps.map((o, i) => (
              <div key={o.id} className="rounded-lg border border-[var(--border)] bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-slate-500">#{i + 1}</span>
                    <span className="text-sm font-medium">{o.question}</span>
                  </div>
                  {o.model && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
                      style={{
                        background: o.model.edge.side === "YES" ? "#34d39922" : "#f8717122",
                        color: o.model.edge.side === "YES" ? "#34d399" : "#f87171",
                      }}
                    >
                      BUY {o.model.edge.side}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-slate-400">
                  <span>Market: {(o.impliedYes * 100).toFixed(0)}% YES</span>
                  {o.model && <span>Model: {(o.model.modelYes * 100).toFixed(0)}% YES</span>}
                  {o.model && (
                    <span style={{ color: "#a78bfa" }}>
                      Edge {(o.model.edge.edge * 100).toFixed(1)}pts
                    </span>
                  )}
                  {o.model && <span>EV {(o.model.edge.evPerDollar * 100).toFixed(0)}%</span>}
                  {o.model && <span>Half-Kelly {(o.model.edge.halfKelly * 100).toFixed(1)}%</span>}
                  <span className="ml-auto">vol ${Math.round(o.volume).toLocaleString()}</span>
                </div>

                <ul className="mt-2 space-y-0.5 text-[0.7rem] text-slate-400">
                  {o.reasons.map((r) => (
                    <li key={r}>· {r}</li>
                  ))}
                  {o.reasons.length === 0 && <li>· No model match — shown for liquidity/mispricing only.</li>}
                </ul>
              </div>
            ))}
          </div>
        )}

        <Disclaimer />
      </section>
    </div>
  );
}

import type { Snapshot } from "../types";
import { money } from "../lib/ui";

/**
 * Treasury / P&L. Honest-money guardrail: REAL API cost and SIMULATED revenue
 * are shown separately and never blended. Per-agency totals are lifetime.
 */
export function Treasury({ snap }: { snap: Snapshot }) {
  const t = snap.treasury;
  const agencies = t.agencies;
  const maxRev = Math.max(1, ...agencies.map((a) => a.revenue));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3">
        <div className="font-mono text-cyan-300 text-glow">💰 TREASURY — Earnings & Cost</div>
        <div className="text-[11px] text-white/40">Real money out (API cost) is kept separate from simulated revenue — the headline stays honest.</div>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Card label="Total Made (revenue)" big={money(t.fund.totalRevenue)} color="var(--color-jade)"
          sub={`${money(t.fund.realRevenue)} real · ${money(t.fund.simRevenue)} simulated`} />
        <Card label="Total Cost (spend)" big={money(t.fund.totalSpend, 4)} color="var(--color-magenta)"
          sub={`${money(t.fund.realSpend, 4)} REAL API · ${money(t.fund.simSpend)} simulated`} highlight={`${money(t.fund.realSpend, 4)} real`} />
        <Card label="Net" big={`${t.fund.net >= 0 ? "+" : ""}${money(t.fund.net)}`} color={t.fund.net >= 0 ? "var(--color-jade)" : "var(--color-danger)"}
          sub={snap.stats.dryRun ? "dry-run — revenue is simulated" : "live mode"} />
      </div>

      {/* Real-money reality strip */}
      <div className="rounded-lg border border-magenta-400/30 bg-[var(--color-magenta)]/5 p-3 mb-4 text-[11px] text-white/60"
        style={{ borderColor: "rgba(255,43,214,0.3)" }}>
        💸 <span className="text-[var(--color-magenta)] font-mono">{money(t.fund.realSpend, 4)}</span> is the only money that has actually left your account
        (API tokens). Everything green is simulated revenue while you're in {snap.stats.dryRun ? "dry-run" : "live"} mode.
      </div>

      {/* Per-agency earnings */}
      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Per-agency totals (lifetime)</div>
      <div className="space-y-2">
        {agencies.map((a) => (
          <div key={a.id} className="rounded-lg border border-white/10 bg-[var(--color-panel)]/40 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span>{a.isLeague ? "🏛️" : a.status === "active" ? "🚀" : "💀"}</span>
              <span className="font-mono text-sm text-white/90">{a.name}</span>
              {a.isLeague && <span className="text-[9px] text-white/30">fund HQ</span>}
              <span className="ml-auto font-mono text-sm" style={{ color: a.net >= 0 ? "var(--color-jade)" : "var(--color-danger)" }}>
                {a.net >= 0 ? "+" : ""}{money(a.net)} net
              </span>
            </div>
            {/* revenue bar */}
            <div className="h-2 rounded bg-white/5 overflow-hidden mb-1.5">
              <div className="h-full rounded" style={{ width: `${(a.revenue / maxRev) * 100}%`, background: "var(--color-jade)", boxShadow: "0 0 8px var(--color-jade)" }} />
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <Stat label="Made" v={money(a.revenue)} c="var(--color-jade)" />
              <Stat label="Cost (real API)" v={money(a.realSpend, 4)} c="var(--color-magenta)" />
              <Stat label="ROI" v={a.roi == null ? "—" : `${(a.roi * 100).toFixed(0)}%`} c="var(--color-cyan)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, big, sub, color, highlight }: { label: string; big: string; sub: string; color: string; highlight?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-panel)]/50 p-4 neon-border">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="font-mono text-2xl mt-1" style={{ color }}>{big}</div>
      <div className="text-[10px] text-white/40 mt-1">{sub}</div>
    </div>
  );
}
function Stat({ label, v, c }: { label: string; v: string; c: string }) {
  return <div><div className="text-[9px] uppercase text-white/30">{label}</div><div style={{ color: c }}>{v}</div></div>;
}

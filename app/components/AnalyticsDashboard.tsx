"use client";

import Sparkline from "./Sparkline";
import { initialAgents, departmentMap, metrics } from "../lib/data";
import { formatValue } from "../lib/format";

const accents = ["#38bdf8", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#22d3ee"];

export default function AnalyticsDashboard() {
  // Aggregate per-department profit from the agent roster.
  const byDept = new Map<string, { revenue: number; cost: number; count: number }>();
  for (const a of initialAgents) {
    const cur = byDept.get(a.department) ?? { revenue: 0, cost: 0, count: 0 };
    cur.revenue += a.revenue;
    cur.cost += a.cost;
    cur.count += 1;
    byDept.set(a.department, cur);
  }
  const deptRows = [...byDept.entries()]
    .map(([id, v]) => ({
      id,
      name: departmentMap[id]?.name ?? id,
      accent: departmentMap[id]?.accent ?? "#38bdf8",
      profit: v.revenue - v.cost,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.profit - a.profit);
  const maxProfit = Math.max(...deptRows.map((d) => Math.abs(d.profit)), 1);

  const topAgents = [...initialAgents]
    .sort((a, b) => b.revenue - b.cost - (a.revenue - a.cost))
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold holo-text">Command Analytics</h2>
        <p className="text-sm text-slate-400">
          Live revenue, cost, profit and performance across the fleet (mock data).
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m, i) => (
          <div key={m.label} className="glass rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[0.7rem] uppercase tracking-wide text-slate-500">{m.label}</div>
                <div className="mt-1 text-2xl font-semibold">{formatValue(m.value, m.format)}</div>
              </div>
              <Sparkline data={m.trend} color={accents[i % accents.length]} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* department profit */}
        <div className="glass rounded-xl p-4">
          <h3 className="mb-3 font-medium">Profit by Department</h3>
          <div className="space-y-2.5">
            {deptRows.map((d) => (
              <div key={d.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-300">{d.name}</span>
                  <span style={{ color: d.profit >= 0 ? "#34d399" : "#f87171" }}>
                    {formatValue(d.profit, "currency")}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(Math.abs(d.profit) / maxProfit) * 100}%`,
                      background: d.accent,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* top performers */}
        <div className="glass rounded-xl p-4">
          <h3 className="mb-3 font-medium">Top Performing Crew</h3>
          <div className="space-y-2">
            {topAgents.map((a, i) => {
              const profit = a.revenue - a.cost;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-center text-sm text-slate-500">{i + 1}</span>
                    <span className="text-lg">{a.avatar}</span>
                    <div>
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-[0.7rem] text-slate-500">{a.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm" style={{ color: profit >= 0 ? "#34d399" : "#f87171" }}>
                      {formatValue(profit, "currency")}
                    </div>
                    <div className="text-[0.6rem] text-slate-500">Grade {a.grade}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

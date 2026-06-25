"use client";

import { useState } from "react";
import { modelProviders } from "../lib/data";
import type { ModelProvider, RoutingStrategy } from "../lib/types";

const strategies: { id: RoutingStrategy; label: string; desc: string }[] = [
  { id: "balanced", label: "Balanced", desc: "Blend cost, speed and quality." },
  { id: "quality", label: "Max Quality", desc: "Route to the strongest model available." },
  { id: "cost", label: "Lowest Cost", desc: "Cheapest model that meets the bar." },
  { id: "speed", label: "Fastest", desc: "Lowest latency for realtime work." },
];

function scoreProvider(p: ModelProvider, strategy: RoutingStrategy): number {
  const costScore = 100 - Math.min(100, p.costPer1k * 5);
  switch (strategy) {
    case "quality": return p.quality;
    case "cost": return costScore;
    case "speed": return p.speed;
    default: return (p.quality + p.speed + costScore) / 3;
  }
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export default function ModelRouter() {
  const [strategy, setStrategy] = useState<RoutingStrategy>("balanced");
  const ranked = [...modelProviders]
    .filter((p) => p.available)
    .map((p) => ({ p, score: scoreProvider(p, strategy) }))
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0]?.p;

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold holo-text">AI Model Router</h2>
        <p className="text-sm text-slate-400">
          Route each task to the best provider by cost, speed, context size, quality and
          availability. New providers drop in without code changes.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {strategies.map((s) => (
          <button
            key={s.id}
            onClick={() => setStrategy(s.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              strategy === s.id
                ? "border-sky-400/60 bg-sky-400/10 text-sky-200"
                : "border-[var(--border)] text-slate-300 hover:bg-white/5"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-[0.75rem] text-slate-500">
        {strategies.find((s) => s.id === strategy)?.desc}
        {winner && (
          <>
            {" "}Current pick:{" "}
            <span className="text-sky-300">{winner.name}</span>.
          </>
        )}
      </p>

      <div className="space-y-2">
        {ranked.map(({ p, score }, i) => (
          <div
            key={p.id}
            className={`glass rounded-xl p-4 ${i === 0 ? "ring-1 ring-sky-400/50" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">
                  {p.name}
                  {i === 0 && (
                    <span className="ml-2 rounded-full bg-sky-400/15 px-2 py-0.5 text-[0.6rem] text-sky-200">
                      ROUTED
                    </span>
                  )}
                </h3>
                <p className="text-[0.7rem] text-slate-500">{p.models.join(" · ")}</p>
              </div>
              <div className="text-right text-[0.7rem] text-slate-400">
                <div className="text-base font-semibold text-slate-200">{score.toFixed(0)}</div>
                match score
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <Metric label="Quality" value={p.quality} color="#a78bfa" />
              <Metric label="Speed" value={p.speed} color="#38bdf8" />
              <Metric
                label="Cost-eff."
                value={100 - Math.min(100, p.costPer1k * 5)}
                color="#34d399"
              />
              <div>
                <div className="mb-1 flex justify-between text-[0.7rem] text-slate-400">
                  <span>Context</span>
                  <span>{(p.maxContext / 1000).toFixed(0)}k</span>
                </div>
                <div className="text-[0.7rem] text-slate-500">${p.costPer1k}/1k tok</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[0.7rem] text-slate-400">
        <span>{label}</span>
        <span>{value.toFixed(0)}</span>
      </div>
      <Bar value={value} color={color} />
    </div>
  );
}

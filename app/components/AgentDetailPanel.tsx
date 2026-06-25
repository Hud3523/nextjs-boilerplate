"use client";

import type { Agent } from "../lib/types";
import { agentMap, departmentMap, roomMap } from "../lib/data";
import { formatValue } from "../lib/format";

const gradeColor: Record<string, string> = {
  S: "#e879f9",
  A: "#34d399",
  B: "#fbbf24",
  C: "#94a3b8",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Chips({ items, accent }: { items: string[]; accent: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span
          key={s}
          className="rounded-full px-2 py-0.5 text-[0.7rem]"
          style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}40` }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export default function AgentDetailPanel({
  agent,
  onClose,
}: {
  agent: Agent | null;
  onClose: () => void;
}) {
  if (!agent) return null;
  const dept = departmentMap[agent.department];
  const accent = dept?.accent ?? "#38bdf8";
  const profit = agent.revenue - agent.cost;
  const xpPct = Math.min(100, Math.round((agent.xp / agent.xpToNext) * 100));

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <aside className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
              style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}
            >
              {agent.avatar}
            </span>
            <div>
              <h3 className="text-lg font-semibold">{agent.name}</h3>
              <p className="text-sm text-slate-400">
                {agent.role} · {dept?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-slate-300 hover:bg-white/5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* headline stats */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Stat label="Grade" value={agent.grade} color={gradeColor[agent.grade]} />
          <Stat label="Revenue" value={formatValue(agent.revenue, "currency")} />
          <Stat label="Cost" value={formatValue(agent.cost, "currency")} />
          <Stat
            label="Profit"
            value={formatValue(profit, "currency")}
            color={profit >= 0 ? "#34d399" : "#f87171"}
          />
        </div>

        {/* xp bar */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[0.7rem] text-slate-400">
            <span>XP {agent.xp.toLocaleString()}</span>
            <span>{xpPct}% to next level</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${xpPct}%`, background: accent }} />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Section title="Personality">
            <p className="text-sm text-slate-300">{agent.personality}</p>
          </Section>
          <Section title="Current Task">
            <p className="text-sm text-slate-200">
              {agent.currentTask}
              <span className="ml-2 text-[0.7rem] text-slate-500">
                ({agent.state} · {roomMap[agent.targetRoomId]?.name ?? "ship"})
              </span>
            </p>
          </Section>
          <Section title="Skills"><Chips items={agent.skills} accent={accent} /></Section>
          <Section title="Certifications"><Chips items={agent.certifications} accent="#a78bfa" /></Section>
          <Section title="Goals">
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-slate-300">
              {agent.goals.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </Section>
          <Section title="Work Queue">
            <ul className="space-y-1 text-sm text-slate-300">
              {agent.workQueue.map((w, i) => (
                <li key={w} className="flex items-center gap-2">
                  <span className="text-[0.7rem] text-slate-500">{i + 1}.</span> {w}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Memory">
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-slate-400">
              {agent.memory.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </Section>
          <Section title="Learning History">
            <ul className="list-disc space-y-0.5 pl-4 text-sm text-slate-400">
              {agent.learningHistory.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </Section>
          <Section title="Relationships">
            <Chips
              items={agent.relationships.map((id) => agentMap[id]?.name ?? id)}
              accent="#22d3ee"
            />
          </Section>
        </div>
      </aside>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white/[0.03] px-1 py-2">
      <div className="text-sm font-semibold" style={{ color: color ?? "var(--foreground)" }}>
        {value}
      </div>
      <div className="text-[0.6rem] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

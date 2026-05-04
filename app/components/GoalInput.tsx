"use client";

import { useState } from "react";

interface Props {
  running: boolean;
  onRun: (goal: string) => void;
  onStop: () => void;
  onOpenAgentMaker: () => void;
}

const SAMPLE_GOALS = [
  "Plan a Shopify store selling phone grips",
  "Write a launch tweet thread for an indie app",
  "Brainstorm 5 print-on-demand product ideas",
  "Outline a 7-day email sequence for new customers",
];

export default function GoalInput({ running, onRun, onStop, onOpenAgentMaker }: Props) {
  const [goal, setGoal] = useState("");

  const submit = () => {
    if (!goal.trim() || running) return;
    onRun(goal.trim());
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="What should the office work on?  e.g. Plan a Shopify store selling phone grips"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          disabled={running}
        />
        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:opacity-90"
          >
            ▶ Run the office
          </button>
        )}
        <button
          type="button"
          onClick={onOpenAgentMaker}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/20"
        >
          🧬 Hire agent
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SAMPLE_GOALS.map((g) => (
          <button
            key={g}
            type="button"
            disabled={running}
            onClick={() => setGoal(g)}
            className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-cyan-500/60 hover:text-cyan-200 disabled:opacity-50"
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

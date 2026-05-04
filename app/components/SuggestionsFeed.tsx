"use client";

import type { Suggestion } from "../lib/types";

interface Props {
  suggestions: Suggestion[];
}

export default function SuggestionsFeed({ suggestions }: Props) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
          <span>💡</span> Suggestions for you
        </h3>
        <span className="text-xs text-amber-300/70">{suggestions.length}</span>
      </div>
      <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
        {suggestions.length === 0 && (
          <p className="text-xs text-amber-200/60">
            Sage will ping you with ideas while the office works.
          </p>
        )}
        {suggestions.map((s) => (
          <div key={s.id} className="rounded-lg border border-amber-500/20 bg-amber-950/30 p-2.5">
            <p className="text-sm text-amber-100">{s.text}</p>
            <p className="mt-0.5 text-[10px] text-amber-300/60">
              {new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

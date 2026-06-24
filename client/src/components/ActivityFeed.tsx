import { useEffect, useRef } from "react";
import type { ActivityRow } from "../types";
import { ago } from "../lib/ui";

const C: Record<string, string> = {
  run_start: "var(--color-cyan)", run_end: "var(--color-jade)", approval: "var(--color-magenta)",
  system: "var(--color-violet)", info: "#9fb0cc",
};

export function ActivityFeed({ activity, stream, variant = "bar" }: { activity: ActivityRow[]; stream: Record<string, string>; variant?: "bar" | "full" }) {
  const ref = useRef<HTMLDivElement>(null);
  const keys = Object.keys(stream);
  const live = keys.length ? stream[keys[keys.length - 1]] : "";
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [activity]);

  return (
    <div className={`${variant === "full" ? "flex-1" : "h-40 shrink-0"} bg-[var(--color-deep)]/70 border-t border-cyan-400/15 flex flex-col`}>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-white/5">
        <span className="text-[10px] uppercase tracking-widest text-white/40">📡 Activity</span>
        <span className="w-1.5 h-1.5 rounded-full pulse-active" style={{ background: "var(--color-jade)" }} />
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px] leading-relaxed">
        {live && <div className="text-cyan-300/90 border-l-2 border-cyan-400/60 pl-2 mb-1"><span className="text-cyan-400">▶ </span>{live.slice(-180)}<span className="animate-pulse">▌</span></div>}
        {activity.map((a) => (
          <div key={a.id} className="flex gap-2 hover:bg-white/[0.02] rounded px-1">
            <span className="text-white/25 shrink-0">{ago(a.ts)}</span>
            <span style={{ color: C[a.type] ?? "#9fb0cc" }} className="shrink-0 uppercase text-[9px] pt-0.5 w-16 truncate">{a.type}</span>
            <span className="text-white/70">{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

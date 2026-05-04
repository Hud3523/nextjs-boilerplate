"use client";

import type { Agent, Task } from "../lib/types";

interface Props {
  tasks: Task[];
  agents: Agent[];
  progress: number;
}

export default function TaskBoard({ tasks, agents, progress }: Props) {
  const findAgent = (id: string) => agents.find((a) => a.id === id);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Task Board</h3>
        <span className="text-xs text-zinc-400">{tasks.length} tasks</span>
      </div>

      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
        {tasks.length === 0 && (
          <p className="text-xs text-zinc-500">
            No tasks yet — type a goal and press Run.
          </p>
        )}
        {tasks.map((t) => {
          const a = findAgent(t.ownerId);
          return (
            <div
              key={t.id}
              className={`task-card status-${t.status}`}
              style={{ ["--owner-color" as string]: a?.color || "#888" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-200 truncate">
                  {t.title}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                  {t.status.replace("_", " ")}
                </span>
              </div>
              {a && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span>{a.emoji}</span>
                  <span>{a.name}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

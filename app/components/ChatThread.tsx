"use client";

import { useEffect, useRef } from "react";
import type { Agent, Message, Suggestion } from "../lib/types";

interface Props {
  agents: Agent[];
  messages: Message[];
  suggestions: Suggestion[];
  goal: string;
  running: boolean;
  empty: boolean;
  onSampleClick: (s: string) => void;
  onRetry: (agentId: string) => void;
}

const SAMPLE_GOALS = [
  "Plan a Shopify store selling phone grips",
  "Write a launch tweet thread for an indie app",
  "Brainstorm 5 print-on-demand product ideas",
  "Outline a 7-day email sequence for new customers",
];

export default function ChatThread({
  agents,
  messages,
  suggestions,
  goal,
  running,
  empty,
  onSampleClick,
  onRetry,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const findAgent = (id: string) => agents.find((a) => a.id === id);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, suggestions.length, running]);

  const items = mergeTimeline(messages, suggestions);

  if (empty) {
    return (
      <div className="thread-empty">
        <div className="thread-empty-inner">
          <div className="thread-empty-emoji">🏢</div>
          <h2>What should the office work on?</h2>
          <p>Type a goal below — your agents will plan, build, and review it.</p>
          <div className="thread-empty-samples">
            {SAMPLE_GOALS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSampleClick(s)}
                className="sample-pill"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="thread">
      {goal && (
        <div className="user-turn">
          <div className="user-avatar">🧑</div>
          <div className="user-bubble">{goal}</div>
        </div>
      )}

      {items.map((it) => {
        if (it.kind === "suggestion") {
          return (
            <div key={`s-${it.id}`} className="suggest-bubble">
              <span className="suggest-icon">💡</span>
              <div>
                <div className="suggest-label">Suggestion for you</div>
                <p>{it.text}</p>
              </div>
            </div>
          );
        }
        const a = findAgent(it.agentId);
        if (!a) return null;
        return (
          <div key={it.id} className="agent-turn">
            <div
              className="agent-turn-avatar"
              style={{ ["--avatar-color" as string]: a.color }}
              title={a.name}
            >
              {a.emoji}
            </div>
            <div className="agent-turn-body">
              <div className="agent-turn-meta">
                <span className="agent-turn-name" style={{ color: a.color }}>
                  {a.name}
                </span>
                <span className="agent-turn-role">{a.role}</span>
                {it.kind === "review" && <span className="badge">review</span>}
                {"retry" in it && it.retry && (
                  <span className="badge retry">retry</span>
                )}
                {"grade" in it && it.grade && (
                  <span
                    className={`grade-pill grade-${it.grade.replace("+", "plus").replace("-", "minus")}`}
                    title={`Score: ${it.score ?? "—"}`}
                  >
                    {it.grade}
                  </span>
                )}
              </div>
              <p className="agent-turn-text">{it.text}</p>
              {a.role !== "agentmaker" && (
                <button
                  type="button"
                  className="retry-btn"
                  disabled={running}
                  onClick={() => onRetry(a.id)}
                  title="Have this agent try again to beat their grade"
                >
                  ↻ Try again
                </button>
              )}
            </div>
          </div>
        );
      })}

      {running && (
        <div className="thinking-row">
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-label">Office is working…</span>
        </div>
      )}
    </div>
  );
}

type TimelineItem =
  | (Message & { kind: Message["kind"] })
  | { kind: "suggestion"; id: string; text: string; ts: number };

function mergeTimeline(messages: Message[], suggestions: Suggestion[]): TimelineItem[] {
  const merged: TimelineItem[] = [
    ...messages,
    ...suggestions.map((s) => ({ kind: "suggestion" as const, id: s.id, text: s.text, ts: s.ts })),
  ];
  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}

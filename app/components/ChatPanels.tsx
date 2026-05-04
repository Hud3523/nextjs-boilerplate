"use client";

import { useEffect, useRef } from "react";
import type { Agent, Message } from "../lib/types";

interface Props {
  agents: Agent[];
  messages: Message[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function ChatPanels({ agents, messages, selectedId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedId]);

  const filtered = selectedId ? messages.filter((m) => m.agentId === selectedId) : messages;
  const findAgent = (id: string) => agents.find((a) => a.id === id);

  return (
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/60 h-full">
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-800 p-3">
        <button
          type="button"
          onClick={() => onSelect("")}
          className={`chip ${!selectedId ? "active" : ""}`}
        >
          All
        </button>
        {agents.map((a) => (
          <button
            type="button"
            key={a.id}
            onClick={() => onSelect(a.id)}
            className={`chip ${selectedId === a.id ? "active" : ""}`}
            style={{ ["--chip-color" as string]: a.color }}
          >
            <span className="mr-1">{a.emoji}</span>
            {a.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[260px] max-h-[420px]">
        {filtered.length === 0 && (
          <p className="text-xs text-zinc-500">No messages yet. The office is quiet… for now.</p>
        )}
        {filtered.map((m) => {
          const a = findAgent(m.agentId);
          if (!a) return null;
          return (
            <div key={m.id} className="chat-row">
              <div
                className="chat-avatar"
                style={{ ["--avatar-color" as string]: a.color }}
                title={a.name}
              >
                {a.emoji}
              </div>
              <div className="chat-bubble">
                <div className="chat-meta">
                  <span className="font-semibold" style={{ color: a.color }}>{a.name}</span>
                  <span className="text-zinc-500">· {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {m.kind === "review" && <span className="badge">review</span>}
                  {m.kind === "suggest" && <span className="badge suggest">suggestion</span>}
                </div>
                <p className="whitespace-pre-line text-sm text-zinc-200">{m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

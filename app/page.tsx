"use client";

import { useCallback, useRef, useState } from "react";
import Office from "./components/Office";
import TaskBoard from "./components/TaskBoard";
import ChatPanels from "./components/ChatPanels";
import SuggestionsFeed from "./components/SuggestionsFeed";
import GoalInput from "./components/GoalInput";
import AgentMakerModal from "./components/AgentMakerModal";
import { DEFAULT_AGENTS, makeCustomAgent } from "./lib/agents";
import { runOffice } from "./lib/orchestrator";
import type { Agent, Message, Suggestion, Task } from "./lib/types";

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [makerOpen, setMakerOpen] = useState(false);
  const cancelRef = useRef(false);

  const setAgentStatus = useCallback((id: string, status: Agent["status"]) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const handleRun = useCallback(
    async (goal: string) => {
      cancelRef.current = false;
      setRunning(true);
      setTasks([]);
      setMessages([]);
      setSuggestions([]);
      setProgress(0);

      const currentAgents = agents;

      await runOffice(goal, currentAgents, {
        setAgentStatus,
        addMessage: (m) => setMessages((prev) => [...prev, m]),
        addTask: (t) => setTasks((prev) => [...prev, t]),
        updateTask: (id, patch) =>
          setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
        addSuggestion: (s) => setSuggestions((prev) => [...prev, s]),
        setProgress,
        isCancelled: () => cancelRef.current,
      });

      setRunning(false);
    },
    [agents, setAgentStatus],
  );

  const handleStop = () => {
    cancelRef.current = true;
    setRunning(false);
    setAgents((prev) => prev.map((a) => ({ ...a, status: "idle" })));
  };

  const handleCreateAgent = ({ name, job }: { name: string; job: string }) => {
    const newAgent = makeCustomAgent({ name, job });
    setAgents((prev) => [...prev, newAgent]);
    const hugo = agents.find((a) => a.role === "agentmaker");
    const ts = Date.now();
    if (hugo) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-hire-${ts}`,
          agentId: hugo.id,
          text: `Onboarded ${newAgent.name} (${newAgent.emoji}). Job: ${newAgent.description}. Desk assigned — ready for work.`,
          ts,
          kind: "say",
        },
      ]);
    }
  };

  const removeAgent = (id: string) => {
    const a = agents.find((ag) => ag.id === id);
    if (!a?.custom) return;
    setAgents((prev) => prev.filter((ag) => ag.id !== id));
    if (selectedAgent === id) setSelectedAgent("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                AI Office
              </span>{" "}
              <span className="text-zinc-400 text-base font-normal">
                — your team of agents at work
              </span>
            </h1>
            <p className="text-xs text-zinc-500">
              Type a goal. Watch the office plan, prompt, build, review, and pitch ideas back to you.
            </p>
          </div>
          <div className="text-xs text-zinc-500">
            {agents.length} agents · {running ? "🟢 working" : "⚪ idle"}
          </div>
        </header>

        <GoalInput
          running={running}
          onRun={handleRun}
          onStop={handleStop}
          onOpenAgentMaker={() => setMakerOpen(true)}
        />

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-5">
            <Office
              agents={agents}
              onAgentClick={(id) => setSelectedAgent((cur) => (cur === id ? "" : id))}
              selectedId={selectedAgent}
            />
            {selectedAgent && (
              <AgentDetail
                agent={agents.find((a) => a.id === selectedAgent)}
                onRemove={() => removeAgent(selectedAgent)}
                onClose={() => setSelectedAgent("")}
              />
            )}
            <ChatPanels
              agents={agents}
              messages={messages}
              selectedId={selectedAgent}
              onSelect={setSelectedAgent}
            />
          </div>

          <div className="flex flex-col gap-5">
            <TaskBoard tasks={tasks} agents={agents} progress={progress} />
            <SuggestionsFeed suggestions={suggestions} />
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-zinc-600">
          v1 · running in mock mode (no API key needed). Add Claude API later for real reasoning.
        </footer>
      </div>

      <AgentMakerModal
        open={makerOpen}
        onClose={() => setMakerOpen(false)}
        onCreate={handleCreateAgent}
      />
    </div>
  );
}

function AgentDetail({
  agent,
  onRemove,
  onClose,
}: {
  agent?: Agent;
  onRemove: () => void;
  onClose: () => void;
}) {
  if (!agent) return null;
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: `${agent.color}55`, background: `${agent.color}0d` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
            style={{ background: `${agent.color}33` }}
          >
            {agent.emoji}
          </div>
          <div>
            <p className="font-semibold" style={{ color: agent.color }}>
              {agent.name}
            </p>
            <p className="text-xs text-zinc-300">{agent.description}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
              status: {agent.status}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {agent.custom && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
            >
              Fire
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

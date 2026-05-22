"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import OfficeStrip from "./components/OfficeStrip";
import ChatThread from "./components/ChatThread";
import InputBar from "./components/InputBar";
import AgentMakerModal from "./components/AgentMakerModal";
import AgentDetailPanel from "./components/AgentDetailPanel";
import AchievementsModal from "./components/AchievementsModal";
import { DEFAULT_AGENTS, makeCustomAgent } from "./lib/agents";
import { learn, retryAgent, runOffice } from "./lib/orchestrator";
import { computeAchievements, unlockedCount } from "./lib/achievements";
import {
  conversationToMarkdown,
  downloadMarkdown,
  loadState,
  newConversation,
  saveState,
  truncateTitle,
} from "./lib/storage";
import type {
  Agent,
  Conversation,
  Grade,
  Message,
  Suggestion,
  Task,
} from "./lib/types";

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [makerOpen, setMakerOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelRef = useRef(false);
  const agentsRef = useRef(agents);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    const s = loadState();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgents(s.agents);
    setConversations(s.conversations);
    setActiveId(s.activeId);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveState({ agents, conversations, activeId });
  }, [agents, conversations, activeId, hydrated]);

  const active = conversations.find((c) => c.id === activeId) || null;

  const setAgentStatus = useCallback((id: string, status: Agent["status"]) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const applyAgentLearning = useCallback(
    (id: string, grade: Grade, score: number) => {
      setAgents((prev) => prev.map((a) => (a.id === id ? learn(a, grade, score) : a)));
    },
    [],
  );

  const updateConvo = useCallback(
    (id: string, patch: Partial<Conversation> | ((c: Conversation) => Conversation)) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? typeof patch === "function"
              ? patch(c)
              : { ...c, ...patch, updatedAt: Date.now() }
            : c,
        ),
      );
    },
    [],
  );

  const handleSend = useCallback(
    async (goal: string) => {
      let convoId = activeId;
      if (!convoId) {
        const c = newConversation(goal);
        setConversations((prev) => [c, ...prev]);
        setActiveId(c.id);
        convoId = c.id;
      } else {
        const cur = conversations.find((c) => c.id === convoId);
        const nextTitle = cur && cur.messages.length === 0 && !cur.goal
          ? truncateTitle(goal)
          : cur?.title;
        updateConvo(convoId, {
          goal,
          title: nextTitle,
          messages: [],
          tasks: [],
          suggestions: [],
          progress: 0,
        });
      }

      cancelRef.current = false;
      setRunning(true);

      await runOffice(goal, agentsRef.current, {
        setAgentStatus,
        applyAgentLearning,
        addMessage: (m) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId
                ? { ...c, messages: [...c.messages, m], updatedAt: Date.now() }
                : c,
            ),
          ),
        addTask: (t) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId
                ? { ...c, tasks: [...c.tasks, t], updatedAt: Date.now() }
                : c,
            ),
          ),
        updateTask: (id, patch) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId
                ? {
                    ...c,
                    tasks: c.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
                    updatedAt: Date.now(),
                  }
                : c,
            ),
          ),
        addSuggestion: (s) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId
                ? { ...c, suggestions: [...c.suggestions, s], updatedAt: Date.now() }
                : c,
            ),
          ),
        setProgress: (p) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId ? { ...c, progress: p, updatedAt: Date.now() } : c,
            ),
          ),
        isCancelled: () => cancelRef.current,
        getAgent: (id) => agentsRef.current.find((a) => a.id === id),
      });

      setRunning(false);
    },
    [activeId, conversations, setAgentStatus, applyAgentLearning, updateConvo],
  );

  const handleStop = () => {
    cancelRef.current = true;
    setRunning(false);
    setAgents((prev) => prev.map((a) => ({ ...a, status: "idle" })));
  };

  const handleNewChat = () => {
    if (active && active.messages.length === 0) return;
    const c = newConversation();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setSidebarOpen(false);
  };

  const handleSelectConvo = (id: string) => {
    if (running) return;
    setActiveId(id);
    setSidebarOpen(false);
  };

  const handleDeleteConvo = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleCreateAgent = ({ name, job }: { name: string; job: string }) => {
    const newAgent = makeCustomAgent({ name, job });
    setAgents((prev) => [...prev, newAgent]);
  };

  const removeAgent = (id: string) => {
    const a = agents.find((ag) => ag.id === id);
    if (!a?.custom) return;
    setAgents((prev) => prev.filter((ag) => ag.id !== id));
    if (selectedAgent === id) setSelectedAgent("");
  };

  const handleRetry = useCallback(
    async (agentId: string) => {
      const convoId = activeId;
      const cur = conversations.find((c) => c.id === convoId);
      if (!convoId || !cur || running) return;
      const retryGoal = cur.goal;

      cancelRef.current = false;
      setRunning(true);

      await retryAgent(agentId, retryGoal, {
        setAgentStatus,
        applyAgentLearning,
        addMessage: (m) =>
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convoId
                ? { ...c, messages: [...c.messages, m], updatedAt: Date.now() }
                : c,
            ),
          ),
        getAgent: (id) => agentsRef.current.find((a) => a.id === id),
        isCancelled: () => cancelRef.current,
      });

      setRunning(false);
    },
    [activeId, conversations, running, setAgentStatus, applyAgentLearning],
  );

  const handleExport = () => {
    if (!active || active.messages.length === 0) return;
    const md = conversationToMarkdown(active, agents);
    const safe = (active.title || "conversation").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadMarkdown(`ai-office-${safe}.md`, md);
  };

  const achievements = computeAchievements(agents, conversations);

  const messages: Message[] = active?.messages || [];
  const suggestions: Suggestion[] = active?.suggestions || [];
  const tasks: Task[] = active?.tasks || [];
  const progress = active?.progress || 0;
  const goal = active?.goal || "";
  const empty = !active || (messages.length === 0 && !running);

  const activeAgents = agents;

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConvo}
        onNewChat={handleNewChat}
        onDelete={handleDeleteConvo}
        onHire={() => setMakerOpen(true)}
        onAchievements={() => setAchievementsOpen(true)}
        achievementsUnlocked={unlockedCount(achievements)}
        achievementsTotal={achievements.length}
        agentCount={agents.length}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-col">
        <header className="main-header">
          <button
            type="button"
            className="header-icon-btn lg-hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <div className="header-title">
            <span className="header-title-main">
              {active?.title || "New chat"}
            </span>
            <span className="header-title-sub">
              {agents.length} agents · {running ? "🟢 working" : "⚪ idle"} · {tasks.length} tasks
            </span>
          </div>
          <button
            type="button"
            className="header-action"
            onClick={handleExport}
            disabled={!active || active.messages.length === 0}
            title="Export this conversation as Markdown"
          >
            ⬇ Export
          </button>
        </header>

        <OfficeStrip
          agents={activeAgents}
          progress={progress}
          running={running}
          selectedId={selectedAgent}
          onSelect={(id) => setSelectedAgent((cur) => (cur === id ? "" : id))}
        />

        {selectedAgent && (
          <AgentDetailPanel
            agent={agents.find((a) => a.id === selectedAgent)}
            onRemove={() => removeAgent(selectedAgent)}
            onClose={() => setSelectedAgent("")}
          />
        )}

        <ChatThread
          agents={activeAgents}
          messages={messages}
          suggestions={suggestions}
          goal={goal}
          running={running}
          empty={empty}
          onSampleClick={(s) => setDraft(s)}
          onRetry={handleRetry}
        />

        <InputBar
          running={running}
          value={draft}
          onChange={setDraft}
          onSend={() => {
            const v = draft.trim();
            if (!v) return;
            setDraft("");
            handleSend(v);
          }}
          onStop={handleStop}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </main>

      <AgentMakerModal
        open={makerOpen}
        onClose={() => setMakerOpen(false)}
        onCreate={handleCreateAgent}
      />

      <AchievementsModal
        open={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        achievements={achievements}
      />
    </div>
  );
}

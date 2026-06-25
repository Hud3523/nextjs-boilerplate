"use client";

import { useMemo, useState } from "react";
import { useShipSimulation } from "./hooks/useShipSimulation";
import { agentMap, departments, initialAgents } from "./lib/data";
import ShipMap from "./components/ShipMap";
import AgentDetailPanel from "./components/AgentDetailPanel";
import ToolManager from "./components/ToolManager";
import ModelRouter from "./components/ModelRouter";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import PluginStore from "./components/PluginStore";

type View = "ship" | "tools" | "router" | "analytics" | "plugins";

const nav: { id: View; label: string; icon: string }[] = [
  { id: "ship", label: "Ship Deck", icon: "🛸" },
  { id: "tools", label: "Tool Manager", icon: "🧰" },
  { id: "router", label: "Model Router", icon: "🧭" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "plugins", label: "Plugin Store", icon: "🧩" },
];

export default function Home() {
  const { agents, meetingActive } = useShipSimulation();
  const [view, setView] = useState<View>("ship");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Live snapshot from the simulation if available, else seed roster.
  const selectedAgent = useMemo(() => {
    if (!selectedId) return null;
    return agents.find((a) => a.id === selectedId) ?? agentMap[selectedId] ?? null;
  }, [selectedId, agents]);

  const working = agents.filter((a) => a.state === "working").length;
  const walking = agents.filter((a) => a.state === "walking").length;

  return (
    <div className="min-h-screen">
      {/* top command bar */}
      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl float">🛰️</span>
          <div>
            <h1 className="text-base font-semibold leading-tight sm:text-lg">
              HERMES <span className="holo-text">OMEGA INFINITY</span>
            </h1>
            <p className="text-[0.65rem] text-slate-500 sm:text-xs">
              AI Company OS · CEO Command Deck
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-4 text-[0.7rem] text-slate-400 md:flex">
          <Status label="Crew" value={`${initialAgents.length}`} dot="#38bdf8" />
          <Status label="Working" value={`${working}`} dot="#34d399" />
          <Status label="In transit" value={`${walking}`} dot="#38bdf8" />
          <Status
            label="Meeting"
            value={meetingActive ? "ACTIVE" : "—"}
            dot={meetingActive ? "#f472b6" : "#475569"}
          />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-4 px-3 py-4 sm:px-5">
        {/* side nav */}
        <nav className="glass sticky top-[68px] hidden h-fit w-44 shrink-0 flex-col gap-1 rounded-xl p-2 sm:flex">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                view === n.id
                  ? "bg-sky-400/15 text-sky-200"
                  : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
          <div className="mt-2 border-t border-[var(--border)] pt-2">
            <p className="px-3 text-[0.6rem] uppercase tracking-wide text-slate-600">Departments</p>
            <div className="mt-1 max-h-48 space-y-0.5 overflow-y-auto px-1">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center gap-2 px-2 py-1 text-[0.7rem] text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.accent }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* mobile nav */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-[var(--border)] bg-[rgba(8,10,20,0.95)] px-2 py-2 backdrop-blur sm:hidden">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[0.6rem] ${
                view === n.id ? "text-sky-300" : "text-slate-400"
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* main view */}
        <main className="min-w-0 flex-1 pb-20 sm:pb-0">
          {view === "ship" && (
            <div className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold holo-text">Flagship Deck</h2>
                <p className="text-sm text-slate-400">
                  {initialAgents.length} AI crew live aboard. Watch them work in their pods,
                  roam the ship, and gather in the Meeting Hall for all-hands.
                </p>
              </div>
              <ShipMap
                agents={agents}
                meetingActive={meetingActive}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )}
          {view === "tools" && <ToolManager />}
          {view === "router" && <ModelRouter />}
          {view === "analytics" && <AnalyticsDashboard />}
          {view === "plugins" && <PluginStore />}
        </main>
      </div>

      <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function Status({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-200">{value}</span>
    </span>
  );
}

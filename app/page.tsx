"use client";

import { useMemo, useState } from "react";
import { useShipSimulation } from "./hooks/useShipSimulation";
import { agentMap, departments, initialAgents } from "./lib/data";
import ShipMap from "./components/ShipMap";
import ActivityLog from "./components/ActivityLog";
import AgentDetailPanel from "./components/AgentDetailPanel";
import ToolManager from "./components/ToolManager";
import ModelRouter from "./components/ModelRouter";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import PluginStore from "./components/PluginStore";
import QuantDesk from "./components/QuantDesk";

type View = "ship" | "quant" | "tools" | "router" | "analytics" | "plugins";

const nav: { id: View; label: string; icon: string }[] = [
  { id: "ship", label: "SHIP DECK", icon: "▚" },
  { id: "quant", label: "QUANT DESK", icon: "▲" },
  { id: "tools", label: "TOOL MANAGER", icon: "⛒" },
  { id: "router", label: "MODEL ROUTER", icon: "◇" },
  { id: "analytics", label: "ANALYTICS", icon: "▤" },
  { id: "plugins", label: "PLUGIN STORE", icon: "⬡" },
];

export default function Home() {
  const { agents, meetingActive } = useShipSimulation();
  const [view, setView] = useState<View>("ship");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAgent = useMemo(() => {
    if (!selectedId) return null;
    return agents.find((a) => a.id === selectedId) ?? agentMap[selectedId] ?? null;
  }, [selectedId, agents]);

  const working = agents.filter((a) => a.state === "working").length;
  const walking = agents.filter((a) => a.state === "walking").length;
  const meeting = agents.filter((a) => a.state === "meeting").length;

  return (
    <div className="crt-flicker min-h-screen p-1.5 sm:p-3">
      {/* fixed scanline + vignette overlay */}
      <div className="crt-overlay" />

      <div className="crt-frame mx-auto flex min-h-[calc(100vh-12px)] max-w-[1600px] flex-col overflow-hidden rounded-lg sm:min-h-[calc(100vh-24px)]">
        {/* ---- top readout bar ---- */}
        <header className="glass-strong flex items-center justify-between gap-3 border-b-2 border-[var(--green)] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-lg holo-text">◈</span>
            <div className="leading-none">
              <h1 className="text-sm font-bold tracking-[0.18em] holo-text sm:text-base">
                HERMES·OMEGA·INFINITY
              </h1>
              <p className="mt-0.5 text-[0.55rem] tracking-[0.3em] text-[var(--green-dim)]">
                AI COMPANY OS // CEO COMMAND DECK
              </p>
            </div>
          </div>
          <div className="hidden items-stretch gap-0 md:flex">
            <Readout label="CREW" value={`${initialAgents.length}`} />
            <Readout label="WORK" value={`${working}`} />
            <Readout label="TRANSIT" value={`${walking}`} />
            <Readout label="MEET" value={meetingActive ? `${meeting}` : "0"} hot={meetingActive} />
            <Readout label="SYS" value="ONLINE" />
          </div>
        </header>

        {/* ---- body: nav | main ---- */}
        <div className="flex min-h-0 flex-1">
          {/* side nav */}
          <nav className="hidden w-40 shrink-0 flex-col gap-1 border-r border-[var(--border-dim)] p-2 sm:flex">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`flex items-center gap-2 border px-2 py-1.5 text-left text-[0.62rem] font-bold tracking-widest transition-colors ${
                  view === n.id
                    ? "border-[var(--green)] bg-[var(--green)]/15 text-[var(--green)] glow"
                    : "border-transparent text-[var(--green-dim)] hover:border-[var(--border-dim)] hover:text-[var(--green)]"
                }`}
              >
                <span className="text-[0.7rem]">{n.icon}</span>
                {n.label}
              </button>
            ))}
            <div className="mt-2 border-t border-[var(--border-dim)] pt-2">
              <p className="px-1 text-[0.55rem] tracking-widest text-[var(--green-deep)]">DEPARTMENTS</p>
              <div className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
                {departments.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 px-1 py-0.5 text-[0.58rem] text-[var(--green-dim)]">
                    <span className="h-2 w-2 rounded-[1px]" style={{ background: d.accent, boxShadow: `0 0 4px ${d.accent}` }} />
                    {d.name.toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          </nav>

          {/* mobile nav */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t-2 border-[var(--green)] bg-[#02080c]/95 px-1 py-1.5 sm:hidden">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-0.5 text-[0.5rem] tracking-wider ${
                  view === n.id ? "text-[var(--green)] glow" : "text-[var(--green-dim)]"
                }`}
              >
                <span className="text-sm">{n.icon}</span>
                {n.label.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* main */}
          <main className="min-w-0 flex-1 overflow-y-auto p-2 pb-16 sm:p-3 sm:pb-3">
            {view === "ship" ? (
              <div className="flex h-full min-h-[70vh] flex-col gap-2 lg:flex-row">
                {/* activity log column */}
                <div className="h-48 shrink-0 lg:h-auto lg:w-60">
                  <ActivityLog agents={agents} meetingActive={meetingActive} />
                </div>
                {/* ship map */}
                <div className="min-w-0 flex-1">
                  <ShipMap
                    agents={agents}
                    meetingActive={meetingActive}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
              </div>
            ) : (
              <div className="text-[var(--foreground)]">
                {view === "quant" && <QuantDesk />}
                {view === "tools" && <ToolManager />}
                {view === "router" && <ModelRouter />}
                {view === "analytics" && <AnalyticsDashboard />}
                {view === "plugins" && <PluginStore />}
              </div>
            )}
          </main>
        </div>
      </div>

      <AgentDetailPanel agent={selectedAgent} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function Readout({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center border-l border-[var(--border-dim)] px-3 py-0.5"
      style={hot ? { color: "#ff8c42" } : undefined}
    >
      <span className="text-[0.55rem] tracking-widest text-[var(--green-dim)]">{label}</span>
      <span className={`text-sm font-bold ${hot ? "" : "text-[var(--green)] glow"}`}>{value}</span>
    </div>
  );
}

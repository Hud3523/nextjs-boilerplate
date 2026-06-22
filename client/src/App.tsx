import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useMissionControl } from "./lib/store";
import { StatusBar } from "./components/StatusBar";
import { CrewRoster } from "./components/CrewRoster";
import { ShipView } from "./components/ShipView";
import { FleetView } from "./components/FleetView";
import { OrgGraph } from "./components/OrgGraph";
import { AttentionQueue } from "./components/AttentionQueue";
import { ActivityFeed } from "./components/ActivityFeed";
import { AgentDrawer } from "./components/AgentDrawer";
import { Commissioner } from "./components/Commissioner";
import { DirectiveModal } from "./components/DirectiveModal";
import { cn } from "./lib/ui";

type View = "deck" | "fleet" | "org";

export function App() {
  const { snap, connected, stream, reload } = useMissionControl();
  const [view, setView] = useState<View>("deck");
  const [agencyId, setAgencyId] = useState<string>("league");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showCommissioner, setShowCommissioner] = useState(false);
  const [showDirective, setShowDirective] = useState(false);

  const agency = useMemo(() => snap?.agencies.find((a) => a.id === agencyId) ?? snap?.agencies[0], [snap, agencyId]);
  const deckFloor = useMemo(
    () => snap?.floors.find((f) => f.agency_id === agency?.id && f.depth === 0) ?? null,
    [snap, agency],
  );
  const deckAgents = useMemo(
    () => (snap && agency ? snap.agents.filter((a) => a.agencyId === agency.id) : []),
    [snap, agency],
  );

  if (!snap) {
    return (
      <div className="h-full flex items-center justify-center text-cyan-300 font-mono">
        <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🛰️</div>booting mission control…</div>
      </div>
    );
  }

  const openAgency = (id: string) => { setAgencyId(id); setView("deck"); };

  return (
    <div className="h-full flex flex-col relative z-10">
      <StatusBar stats={snap.stats} onOpenCommissioner={() => setShowCommissioner(true)} onOpenDirective={() => setShowDirective(true)} />

      {/* View tabs */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-[var(--color-deep)]/40 border-b border-white/5">
        {(["deck", "fleet", "org"] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn("font-mono text-[11px] px-3 py-1 rounded", view === v ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40" : "text-white/40 hover:text-white/70")}>
            {v === "deck" ? `🛸 ${agency?.name ?? "Deck"}` : v === "fleet" ? "🌌 Fleet" : "🌳 Org"}
          </button>
        ))}
        {view === "deck" && !agency?.is_league && (
          <button onClick={() => setAgencyId("league")} className="font-mono text-[10px] px-2 py-1 rounded text-white/40 hover:text-white/70">↩ Fund HQ</button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-white/40">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? "var(--color-jade)" : "var(--color-danger)" }} />
          {connected ? "SSE live" : "reconnecting…"}
        </div>
      </div>

      {/* Main row */}
      <div className="flex-1 flex overflow-hidden">
        {view === "deck" && <CrewRoster agents={deckAgents} title={agency?.name ?? "Crew"} onSelect={setSelectedAgent} selectedId={selectedAgent ?? undefined} />}
        {view === "deck" && <ShipView floor={deckFloor} agents={deckAgents} stats={snap.stats} onSelect={setSelectedAgent} selectedId={selectedAgent ?? undefined} />}
        {view === "fleet" && <FleetView snap={snap} onOpenAgency={openAgency} />}
        {view === "org" && <OrgGraph snap={snap} onOpenAgency={openAgency} onSelectAgent={setSelectedAgent} />}
        <AttentionQueue snap={snap} onAct={reload} />
      </div>

      <ActivityFeed snap={snap} stream={stream} />

      <AnimatePresence>
        {selectedAgent && <AgentDrawer key="drawer" agentId={selectedAgent} onClose={() => setSelectedAgent(null)} onChange={reload} />}
        {showCommissioner && <Commissioner key="comm" snap={snap} onClose={() => setShowCommissioner(false)} onChange={reload} />}
        {showDirective && <DirectiveModal key="dir" onClose={() => setShowDirective(false)} onChange={reload} />}
      </AnimatePresence>
    </div>
  );
}

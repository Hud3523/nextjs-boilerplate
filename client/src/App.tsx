import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useMissionControl } from "./lib/store";
import { useIsMobile } from "./lib/useIsMobile";
import { StatusBar } from "./components/StatusBar";
import { CrewRoster } from "./components/CrewRoster";
import { ShipView } from "./components/ShipView";
import { FleetView } from "./components/FleetView";
import { OrgGraph } from "./components/OrgGraph";
import { Treasury } from "./components/Treasury";
import { AttentionQueue } from "./components/AttentionQueue";
import { ActivityFeed } from "./components/ActivityFeed";
import { AgentDrawer } from "./components/AgentDrawer";
import { Commissioner } from "./components/Commissioner";
import { DirectiveModal } from "./components/DirectiveModal";
import { BriefingModal } from "./components/BriefingModal";
import { CommandPalette } from "./components/CommandPalette";
import { Toasts } from "./components/Toasts";
import { Login } from "./components/Login";
import { api } from "./lib/api";
import { cn } from "./lib/ui";

type View = "deck" | "fleet" | "treasury" | "org";
type MobileTab = View | "inbox" | "feed";

/** Auth gate: shows the login screen when the server requires it. */
export function App() {
  const [auth, setAuth] = useState<{ ready: boolean; required: boolean; authed: boolean }>({ ready: false, required: false, authed: false });

  useEffect(() => {
    api.authStatus()
      .then((a: { authEnabled: boolean; authed: boolean }) => setAuth({ ready: true, required: a.authEnabled, authed: a.authed }))
      .catch(() => setAuth({ ready: true, required: false, authed: true }));
  }, []);

  if (!auth.ready) {
    return (
      <div className="h-full flex items-center justify-center text-cyan-300 font-mono">
        <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🛰️</div>connecting…</div>
      </div>
    );
  }
  if (auth.required && !auth.authed) return <Login onSuccess={() => setAuth((a) => ({ ...a, authed: true }))} />;
  return <Dashboard />;
}

function Dashboard() {
  const { snap, connected, stream, toasts, dismissToast, reload } = useMissionControl();
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("deck");
  const [mobileTab, setMobileTab] = useState<MobileTab>("deck");
  const [agencyId, setAgencyId] = useState<string>("league");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showCommissioner, setShowCommissioner] = useState(false);
  const [showDirective, setShowDirective] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setShowPalette((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const agency = useMemo(() => snap?.agencies.find((a) => a.id === agencyId) ?? snap?.agencies[0], [snap, agencyId]);
  const deckFloor = useMemo(() => snap?.floors.find((f) => f.agency_id === agency?.id && f.depth === 0) ?? null, [snap, agency]);
  const deckAgents = useMemo(() => (snap && agency ? snap.agents.filter((a) => a.agencyId === agency.id) : []), [snap, agency]);

  if (!snap) {
    return (
      <div className="h-full flex items-center justify-center text-cyan-300 font-mono">
        <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🛰️</div>booting mission control…</div>
      </div>
    );
  }

  const gotoView = (v: View) => { setView(v); setMobileTab(v); };
  const openAgency = (id: string) => { setAgencyId(id); gotoView("deck"); };
  const attnCount = snap.attention.length;

  const statusBar = (
    <StatusBar stats={snap.stats}
      onOpenCommissioner={() => setShowCommissioner(true)}
      onOpenDirective={() => setShowDirective(true)}
      onOpenBriefing={() => setShowBriefing(true)}
      onOpenPalette={() => setShowPalette(true)} />
  );

  const body = isMobile ? (
    <div className="h-full flex flex-col relative z-10">
      {statusBar}
      <div className="flex-1 flex flex-col overflow-hidden">
        {mobileTab === "deck" && <ShipView floor={deckFloor} agents={deckAgents} stats={snap.stats} onSelect={setSelectedAgent} />}
        {mobileTab === "fleet" && <FleetView snap={snap} onOpenAgency={openAgency} />}
        {mobileTab === "treasury" && <Treasury snap={snap} />}
        {mobileTab === "org" && <OrgGraph snap={snap} onOpenAgency={openAgency} onSelectAgent={setSelectedAgent} />}
        {mobileTab === "inbox" && <AttentionQueue snap={snap} onAct={reload} />}
        {mobileTab === "feed" && <ActivityFeed snap={snap} stream={stream} variant="full" />}
      </div>
      <nav className="shrink-0 flex items-stretch bg-[var(--color-panel)]/90 border-t border-cyan-400/20">
        {([
          ["deck", "🛸", "Deck"], ["fleet", "🌌", "Fleet"], ["treasury", "💰", "Money"], ["org", "🌳", "Org"],
          ["inbox", "⚡", "Inbox"], ["feed", "📡", "Feed"],
        ] as [MobileTab, string, string][]).map(([t, icon, label]) => (
          <button key={t} onClick={() => setMobileTab(t)}
            className={cn("flex-1 flex flex-col items-center py-2 text-[10px] font-mono relative", mobileTab === t ? "text-cyan-300" : "text-white/40")}>
            <span className="text-lg leading-none">{icon}</span>{label}
            {t === "inbox" && attnCount > 0 && <span className="absolute top-1 right-1/4 text-[8px] px-1 rounded-full bg-amber-500 text-black font-bold">{attnCount}</span>}
          </button>
        ))}
      </nav>
    </div>
  ) : (
    <div className="h-full flex flex-col relative z-10">
      {statusBar}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-[var(--color-deep)]/40 border-b border-white/5">
        {(["deck", "fleet", "treasury", "org"] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn("font-mono text-[11px] px-3 py-1 rounded", view === v ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40" : "text-white/40 hover:text-white/70")}>
            {v === "deck" ? `🛸 ${agency?.name ?? "Deck"}` : v === "fleet" ? "🌌 Fleet" : v === "treasury" ? "💰 Money" : "🌳 Org"}
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
      <div className="flex-1 flex overflow-hidden">
        {view === "deck" && <CrewRoster agents={deckAgents} title={agency?.name ?? "Crew"} onSelect={setSelectedAgent} selectedId={selectedAgent ?? undefined} />}
        {view === "deck" && <ShipView floor={deckFloor} agents={deckAgents} stats={snap.stats} onSelect={setSelectedAgent} selectedId={selectedAgent ?? undefined} />}
        {view === "fleet" && <FleetView snap={snap} onOpenAgency={openAgency} />}
        {view === "treasury" && <Treasury snap={snap} />}
        {view === "org" && <OrgGraph snap={snap} onOpenAgency={openAgency} onSelectAgent={setSelectedAgent} />}
        <AttentionQueue snap={snap} onAct={reload} />
      </div>
      <ActivityFeed snap={snap} stream={stream} />
    </div>
  );

  return (
    <>
      {body}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      <AnimatePresence>
        {selectedAgent && <AgentDrawer key="drawer" agentId={selectedAgent} onClose={() => setSelectedAgent(null)} onChange={reload} />}
        {showCommissioner && <Commissioner key="comm" snap={snap} onClose={() => setShowCommissioner(false)} onChange={reload} />}
        {showDirective && <DirectiveModal key="dir" onClose={() => setShowDirective(false)} onChange={reload} />}
        {showBriefing && <BriefingModal key="brief" snap={snap} onClose={() => setShowBriefing(false)} />}
        {showPalette && (
          <CommandPalette key="palette" snap={snap} onClose={() => setShowPalette(false)}
            actions={{ goto: gotoView, openCommissioner: () => setShowCommissioner(true), openBriefing: () => setShowBriefing(true), openDirective: () => setShowDirective(true), selectAgent: setSelectedAgent, reload }} />
        )}
      </AnimatePresence>
    </>
  );
}

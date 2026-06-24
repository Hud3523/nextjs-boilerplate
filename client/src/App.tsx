import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useDashboard } from "./lib/store";
import { useIsMobile } from "./lib/useIsMobile";
import { StatusBar } from "./components/StatusBar";
import { CrewRoster } from "./components/CrewRoster";
import { ShipView } from "./components/ShipView";
import { AttentionQueue } from "./components/AttentionQueue";
import { ActivityFeed } from "./components/ActivityFeed";
import { AgentDrawer } from "./components/AgentDrawer";
import { CommandPalette } from "./components/CommandPalette";
import { Login } from "./components/Login";
import { api } from "./lib/api";
import { cn } from "./lib/ui";

export function App() {
  const [auth, setAuth] = useState<{ ready: boolean; required: boolean; authed: boolean }>({ ready: false, required: false, authed: false });
  useEffect(() => {
    api.authStatus().then((a: { authEnabled: boolean; authed: boolean }) => setAuth({ ready: true, required: a.authEnabled, authed: a.authed }))
      .catch(() => setAuth({ ready: true, required: false, authed: true }));
  }, []);
  if (!auth.ready) return <Boot text="connecting…" />;
  if (auth.required && !auth.authed) return <Login onSuccess={() => setAuth((a) => ({ ...a, authed: true }))} />;
  return <Dashboard />;
}

function Boot({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-cyan-300 font-mono"><div className="text-center"><div className="text-4xl mb-3 animate-pulse">🛰️</div>{text}</div></div>;
}

type MobileTab = "deck" | "inbox" | "feed";

function Dashboard() {
  const { snap, connected, stream, reload } = useDashboard();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [tab, setTab] = useState<MobileTab>("deck");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!snap) return <Boot text="booting dashboard…" />;
  const agent = snap.agents.find((a) => a.id === selected) ?? null;

  const status = <StatusBar stats={snap.stats} hermes={snap.hermes} onOpenPalette={() => setPalette(true)} onChange={reload} />;

  return (
    <div className="h-full flex flex-col relative z-10">
      {status}
      {isMobile ? (
        <>
          <div className="flex-1 flex flex-col overflow-hidden">
            {tab === "deck" && <ShipView agents={snap.agents} onSelect={setSelected} />}
            {tab === "inbox" && <AttentionQueue tasks={snap.tasks} onAct={reload} />}
            {tab === "feed" && <ActivityFeed activity={snap.activity} stream={stream} variant="full" />}
          </div>
          <nav className="shrink-0 flex bg-[var(--color-panel)]/90 border-t border-cyan-400/20">
            {([["deck", "🛸", "Deck"], ["inbox", "⚡", "Inbox"], ["feed", "📡", "Feed"]] as [MobileTab, string, string][]).map(([t, ic, l]) => (
              <button key={t} onClick={() => setTab(t)} className={cn("flex-1 flex flex-col items-center py-2 text-[10px] font-mono relative", tab === t ? "text-cyan-300" : "text-white/40")}>
                <span className="text-lg leading-none">{ic}</span>{l}
                {t === "inbox" && snap.stats.needsReview > 0 && <span className="absolute top-1 right-1/4 text-[8px] px-1 rounded-full bg-amber-500 text-black font-bold">{snap.stats.needsReview}</span>}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-deep)]/40 border-b border-white/5">
            <span className="text-[11px] text-white/40 font-mono">Hermes dashboard — assign jobs, approve results</span>
            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-white/40">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? "var(--color-jade)" : "var(--color-danger)" }} />
              {connected ? "SSE live" : "reconnecting…"}
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <CrewRoster agents={snap.agents} onSelect={setSelected} selectedId={selected ?? undefined} />
            <ShipView agents={snap.agents} onSelect={setSelected} selectedId={selected ?? undefined} />
            <AttentionQueue tasks={snap.tasks} onAct={reload} />
          </div>
          <ActivityFeed activity={snap.activity} stream={stream} />
        </>
      )}

      <AnimatePresence>
        {agent && <AgentDrawer key="drawer" agent={agent} tasks={snap.tasks} onClose={() => setSelected(null)} onChange={reload} />}
        {palette && <CommandPalette key="palette" snap={snap} onSelectAgent={setSelected} onClose={() => setPalette(false)} reload={reload} />}
      </AnimatePresence>
    </div>
  );
}

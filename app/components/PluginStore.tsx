"use client";

// Plugin Store — models its catalog on the Claude plugin marketplace schema
// (marketplace.json + plugin.json), as used by higgsfield-ai/skills.

type Plugin = {
  name: string;
  publisher: string;
  category: string;
  description: string;
  installed: boolean;
  icon: string;
};

const plugins: Plugin[] = [
  { name: "TradingView Signals", publisher: "core", category: "Market Data", description: "Realtime prices + indicators for the Research Lab.", installed: true, icon: "📊" },
  { name: "Polymarket Sentiment", publisher: "core", category: "Market Data", description: "Prediction-market odds via Bitquery.", installed: true, icon: "🎲" },
  { name: "OpenClaw Automations", publisher: "core", category: "Runtime", description: "Browser + workflow automation runtime.", installed: true, icon: "🦾" },
  { name: "Hermes Memory", publisher: "core", category: "Reasoning", description: "Long-term memory + skills + model routing.", installed: true, icon: "🧠" },
  { name: "YouTube Studio", publisher: "media", category: "Media", description: "Upload + schedule videos.", installed: false, icon: "▶️" },
  { name: "Etsy Seller", publisher: "commerce", category: "Commerce", description: "Listings + product image upload.", installed: false, icon: "🛍️" },
  { name: "Image Forge", publisher: "media", category: "Media", description: "Logos, thumbnails, mockups, illustrations.", installed: false, icon: "🖼️" },
  { name: "VoiceLab TTS/STT", publisher: "media", category: "Audio", description: "Voiceovers, transcription, podcast audio.", installed: false, icon: "🎙️" },
  { name: "Stripe Payments", publisher: "finance", category: "Commerce", description: "Charges, payouts, revenue tracking.", installed: false, icon: "💳" },
];

export default function PluginStore() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold holo-text">Plugin Store</h2>
        <p className="text-sm text-slate-400">
          Install new tools, models and services as plugins — the platform grows without
          redesign. Schema follows the Claude plugin marketplace format.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plugins.map((p, i) => (
          <div key={p.name} className="glass float rounded-xl p-4" style={{ animationDelay: `${(i % 5) * 0.4}s` }}>
            <div className="flex items-start justify-between">
              <span className="text-2xl">{p.icon}</span>
              {p.installed ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[0.6rem] text-emerald-300">
                  INSTALLED
                </span>
              ) : (
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.6rem] text-slate-400">
                  AVAILABLE
                </span>
              )}
            </div>
            <h3 className="mt-2 font-medium">{p.name}</h3>
            <p className="text-[0.7rem] text-slate-500">{p.category} · @{p.publisher}</p>
            <p className="mt-2 text-sm text-slate-300">{p.description}</p>
            <button
              disabled={p.installed}
              className={`mt-3 w-full rounded-lg py-1.5 text-sm transition-colors ${
                p.installed
                  ? "cursor-default border border-[var(--border)] text-slate-500"
                  : "border border-sky-400/50 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20"
              }`}
            >
              {p.installed ? "Installed" : "Install plugin"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

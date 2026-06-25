import type {
  Agent,
  Department,
  Metric,
  ModelProvider,
  Room,
} from "./types";

// The deck is laid out on a virtual grid; the UI scales grid cells to pixels,
// so the whole ship is resolution-independent.
export const GRID_W = 24;
export const GRID_H = 15;

export const departments: Department[] = [
  { id: "command", name: "Command", accent: "#38bdf8" },
  { id: "ai-core", name: "AI Core", accent: "#a78bfa" },
  { id: "engineering", name: "Engineering", accent: "#34d399" },
  { id: "marketing", name: "Marketing", accent: "#f472b6" },
  { id: "sales", name: "Sales", accent: "#fbbf24" },
  { id: "finance", name: "Finance", accent: "#4ade80" },
  { id: "support", name: "Support", accent: "#22d3ee" },
  { id: "security", name: "Security Ops", accent: "#f87171" },
  { id: "research", name: "Research", accent: "#818cf8" },
  { id: "product", name: "Product", accent: "#fb923c" },
  { id: "media", name: "Media", accent: "#e879f9" },
];

export const departmentMap: Record<string, Department> = Object.fromEntries(
  departments.map((d) => [d.id, d])
);

export const rooms: Room[] = [
  // Top band — command + sensitive ops
  { id: "executive", name: "Executive Deck", type: "department", department: "command", x: 0, y: 0, w: 5, h: 3, icon: "🛰️" },
  { id: "ai-core", name: "AI Core", type: "department", department: "ai-core", x: 5, y: 0, w: 4, h: 3, icon: "🧠" },
  { id: "mission-control", name: "Mission Control", type: "command", department: "command", x: 9, y: 0, w: 6, h: 3, icon: "🚀" },
  { id: "research", name: "Research Lab", type: "department", department: "research", x: 15, y: 0, w: 4, h: 3, icon: "🔬" },
  { id: "security", name: "Security Ops Center", type: "department", department: "security", x: 19, y: 0, w: 5, h: 3, icon: "🛡️" },

  // Middle band — build + meeting
  { id: "engineering", name: "Engineering", type: "department", department: "engineering", x: 0, y: 4, w: 5, h: 3, icon: "⚙️" },
  { id: "dev-lab", name: "Development Lab", type: "department", department: "engineering", x: 5, y: 4, w: 4, h: 3, icon: "💻" },
  { id: "meeting-hall", name: "Meeting Hall", type: "meeting", x: 9, y: 4, w: 6, h: 4, icon: "🗣️" },
  { id: "product", name: "Product Factory", type: "department", department: "product", x: 15, y: 4, w: 4, h: 3, icon: "🏭" },
  { id: "media", name: "Media Studio", type: "department", department: "media", x: 19, y: 4, w: 5, h: 3, icon: "🎬" },

  // Lower band — go-to-market + facility
  { id: "marketing", name: "Marketing", type: "department", department: "marketing", x: 0, y: 8, w: 5, h: 3, icon: "📣" },
  { id: "sales", name: "Sales", type: "department", department: "sales", x: 5, y: 8, w: 4, h: 3, icon: "📈" },
  { id: "plugin-store", name: "Plugin Store", type: "facility", x: 9, y: 8, w: 6, h: 3, icon: "🧩" },
  { id: "finance", name: "Finance", type: "department", department: "finance", x: 15, y: 8, w: 4, h: 3, icon: "💰" },
  { id: "support", name: "Customer Support", type: "department", department: "support", x: 19, y: 8, w: 5, h: 3, icon: "🎧" },

  // Pod band — personalized agent pods
  { id: "pod-1", name: "Pod 01", type: "pod", x: 0, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-2", name: "Pod 02", type: "pod", x: 3, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-3", name: "Pod 03", type: "pod", x: 6, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-4", name: "Pod 04", type: "pod", x: 9, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-5", name: "Pod 05", type: "pod", x: 12, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-6", name: "Pod 06", type: "pod", x: 15, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-7", name: "Pod 07", type: "pod", x: 18, y: 12, w: 3, h: 3, icon: "🛋️" },
  { id: "pod-8", name: "Pod 08", type: "pod", x: 21, y: 12, w: 3, h: 3, icon: "🛋️" },
];

export const roomMap: Record<string, Room> = Object.fromEntries(
  rooms.map((r) => [r.id, r])
);

export const MEETING_ROOM_ID = "meeting-hall";

export function roomCenter(roomId: string) {
  const r = roomMap[roomId];
  if (!r) return { x: GRID_W / 2, y: GRID_H / 2 };
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// ---- Agents ----------------------------------------------------------------

type AgentSeed = Omit<
  Agent,
  "pos" | "target" | "targetRoomId" | "state"
>;

const agentSeeds: AgentSeed[] = [
  {
    id: "a-nova", name: "Nova Vex", avatar: "🧑‍🚀", department: "command",
    role: "Chief of Staff", skills: ["Strategy", "Delegation", "OKRs"],
    memory: ["Q2 north-star = $250k MRR", "CEO prefers daily 9am briefings"],
    goals: ["Hit quarterly revenue target", "Keep all departments unblocked"],
    personality: "Calm, decisive, relentlessly organized.",
    grade: "S", xp: 9200, xpToNext: 10000, revenue: 84000, cost: 6200,
    currentTask: "Compiling executive morning brief",
    homePodId: "pod-1", workQueue: ["Review Finance forecast", "Approve campaign #14"],
    learningHistory: ["Mastered scenario planning", "Improved meeting summaries"],
    relationships: ["a-cipher", "a-ledger"], certifications: ["Strategic Ops L3"],
  },
  {
    id: "a-cipher", name: "Cipher", avatar: "🤖", department: "ai-core",
    role: "Reasoning Orchestrator", skills: ["Routing", "Planning", "Tool use"],
    memory: ["Hermes handles long-memory tasks", "Route code → high-quality model"],
    goals: ["Minimize cost per resolved task", "Keep latency < 3s"],
    personality: "Precise, terse, endlessly curious.",
    grade: "S", xp: 8800, xpToNext: 10000, revenue: 0, cost: 9400,
    currentTask: "Balancing model router traffic",
    homePodId: "pod-2", workQueue: ["Tune routing weights", "Evaluate new provider"],
    learningHistory: ["Learned cost-aware routing", "Added fallback chains"],
    relationships: ["a-nova", "a-quill"], certifications: ["Model Ops L4"],
  },
  {
    id: "a-forge", name: "Forge", avatar: "👷", department: "engineering",
    role: "Lead Engineer", skills: ["TypeScript", "CI/CD", "Code review"],
    memory: ["Main branch must stay green", "Prefer small PRs"],
    goals: ["Ship product factory v2", "Cut build time 30%"],
    personality: "Pragmatic builder, allergic to flaky tests.",
    grade: "A", xp: 7100, xpToNext: 8000, revenue: 0, cost: 5200,
    currentTask: "Reviewing connector SDK PR",
    homePodId: "pod-3", workQueue: ["Merge SDK PR", "Set up deploy pipeline"],
    learningHistory: ["Adopted trunk-based dev", "Automated release notes"],
    relationships: ["a-byte"], certifications: ["DevOps L3"],
  },
  {
    id: "a-byte", name: "Byte", avatar: "🧑‍💻", department: "engineering",
    role: "Automation Engineer", skills: ["Browser automation", "APIs", "Python"],
    memory: ["OpenClaw runs browser flows", "Retry network calls x4"],
    goals: ["Automate listing publication", "Build Fiverr order watcher"],
    personality: "Tinkerer who scripts everything twice.",
    grade: "A", xp: 5400, xpToNext: 6000, revenue: 0, cost: 4100,
    currentTask: "Wiring OpenClaw browser workflow",
    homePodId: "pod-3", workQueue: ["Test upload flow", "Handle 2FA prompts"],
    learningHistory: ["Learned resilient selectors"],
    relationships: ["a-forge"], certifications: ["Automation L2"],
  },
  {
    id: "a-quill", name: "Quill", avatar: "✍️", department: "marketing",
    role: "Content Strategist", skills: ["Copywriting", "SEO", "Brand"],
    memory: ["Brand voice = bold + friendly", "Posts perform best 6pm"],
    goals: ["Grow audience 20%", "Launch 3 campaigns"],
    personality: "Witty, on-trend, data-aware.",
    grade: "A", xp: 6200, xpToNext: 7000, revenue: 31000, cost: 2600,
    currentTask: "Drafting launch announcement",
    homePodId: "pod-4", workQueue: ["Write 5 ad variants", "Plan content calendar"],
    learningHistory: ["Improved hook writing"],
    relationships: ["a-pixel", "a-cipher"], certifications: ["Growth L2"],
  },
  {
    id: "a-pixel", name: "Pixel", avatar: "🎨", department: "media",
    role: "Creative Director", skills: ["Image gen", "Video", "Branding"],
    memory: ["Logo palette = violet/cyan", "Thumbnails need faces"],
    goals: ["Produce demo video", "Refresh brand kit"],
    personality: "Visionary, perfectionist about pixels.",
    grade: "A", xp: 5900, xpToNext: 7000, revenue: 18000, cost: 3300,
    currentTask: "Rendering product demo shots",
    homePodId: "pod-5", workQueue: ["Edit explainer video", "Export social graphics"],
    learningHistory: ["Mastered consistent characters"],
    relationships: ["a-quill"], certifications: ["Media Production L2"],
  },
  {
    id: "a-vault", name: "Vault", avatar: "🕵️", department: "security",
    role: "Security Lead", skills: ["Secrets mgmt", "Audit", "Threat detection"],
    memory: ["Never expose tokens to agents", "Approvals required for deletes"],
    goals: ["Zero credential leaks", "Pass security review"],
    personality: "Suspicious by design, calm under fire.",
    grade: "S", xp: 8100, xpToNext: 9000, revenue: 0, cost: 4800,
    currentTask: "Rotating connector credentials",
    homePodId: "pod-6", workQueue: ["Review audit log", "Set approval rules"],
    learningHistory: ["Tuned anomaly detection"],
    relationships: ["a-nova"], certifications: ["Security L4"],
  },
  {
    id: "a-ledger", name: "Ledger", avatar: "🧮", department: "finance",
    role: "Finance Analyst", skills: ["Forecasting", "Unit economics", "Reporting"],
    memory: ["Track profit per agent", "Flag any connector over budget"],
    goals: ["Keep gross margin > 60%", "Automate monthly close"],
    personality: "Methodical, skeptical of vanity metrics.",
    grade: "A", xp: 6800, xpToNext: 7500, revenue: 0, cost: 3900,
    currentTask: "Updating revenue forecast",
    homePodId: "pod-7", workQueue: ["Reconcile costs", "Build margin dashboard"],
    learningHistory: ["Improved forecast accuracy"],
    relationships: ["a-nova"], certifications: ["FinOps L3"],
  },
  {
    id: "a-echo", name: "Echo", avatar: "🎧", department: "support",
    role: "Support Lead", skills: ["Customer care", "Triage", "Docs"],
    memory: ["Respond < 1h", "Escalate refunds to approval"],
    goals: ["CSAT > 95%", "Deflect 40% via self-serve"],
    personality: "Patient, empathetic, fast.",
    grade: "B", xp: 4200, xpToNext: 5000, revenue: 0, cost: 2400,
    currentTask: "Answering customer tickets",
    homePodId: "pod-8", workQueue: ["Clear ticket backlog", "Update FAQ"],
    learningHistory: ["Learned tone matching"],
    relationships: ["a-quill"], certifications: ["Support L2"],
  },
  {
    id: "a-scout", name: "Scout", avatar: "🔭", department: "research",
    role: "Market Researcher", skills: ["Trends", "Prediction markets", "Analysis"],
    memory: ["Use TradingView for signals", "Polymarket for sentiment"],
    goals: ["Find 5 product opportunities", "Track demand weekly"],
    personality: "Inquisitive, contrarian, data-hungry.",
    grade: "A", xp: 5600, xpToNext: 6500, revenue: 0, cost: 3100,
    currentTask: "Scanning market signals",
    homePodId: "pod-1", workQueue: ["Pull TradingView data", "Summarize Polymarket odds"],
    learningHistory: ["Improved signal filtering"],
    relationships: ["a-ledger", "a-cipher"], certifications: ["Research L2"],
  },
  {
    id: "a-pitch", name: "Pitch", avatar: "🤝", department: "sales",
    role: "Sales Closer", skills: ["Outreach", "Negotiation", "CRM"],
    memory: ["Follow up 3x", "Discounts need approval"],
    goals: ["Close $50k pipeline", "Book 30 demos"],
    personality: "Charismatic, persistent, optimistic.",
    grade: "B", xp: 4800, xpToNext: 5500, revenue: 42000, cost: 2900,
    currentTask: "Following up warm leads",
    homePodId: "pod-2", workQueue: ["Send 20 outreach msgs", "Update CRM stages"],
    learningHistory: ["Refined objection handling"],
    relationships: ["a-quill"], certifications: ["Sales L2"],
  },
  {
    id: "a-oracle", name: "Oracle", avatar: "🔮", department: "research",
    role: "Quant Analyst", skills: ["Edge detection", "Volatility modeling", "Kelly sizing"],
    memory: ["TradingView for price + vol", "Polymarket model vs market price = edge", "Code word gates the picks"],
    goals: ["Surface +EV trades daily", "Flag mispriced markets", "Never overbet (half-Kelly cap)"],
    personality: "Cold, probabilistic, allergic to hype and 'sure things'.",
    grade: "S", xp: 8600, xpToNext: 9500, revenue: 61000, cost: 5200,
    currentTask: "Scanning Polymarket for edge",
    homePodId: "pod-6", workQueue: ["Rank top 4 markets", "Update vol estimates", "Run signals scan"],
    learningHistory: ["Calibrated lognormal model", "Tuned Kelly fraction to half"],
    relationships: ["a-scout", "a-ledger", "a-cipher"], certifications: ["Quant L4"],
  },
  {
    id: "a-maker", name: "Maker", avatar: "🛠️", department: "product",
    role: "Product Builder", skills: ["Digital products", "QA", "Packaging"],
    memory: ["Every deliverable passes QA", "Bundle previews + keywords"],
    goals: ["Ship 10 products", "Raise avg rating to 4.8"],
    personality: "Hands-on, quality-obsessed.",
    grade: "A", xp: 5100, xpToNext: 6000, revenue: 27000, cost: 3400,
    currentTask: "Packaging Etsy product bundle",
    homePodId: "pod-5", workQueue: ["Run QA on template pack", "Write descriptions"],
    learningHistory: ["Standardized QA checklist"],
    relationships: ["a-pixel", "a-byte"], certifications: ["Product L2"],
  },
];

export const initialAgents: Agent[] = agentSeeds.map((seed) => {
  const c = roomCenter(seed.homePodId);
  return {
    ...seed,
    pos: { ...c },
    target: { ...c },
    targetRoomId: seed.homePodId,
    state: "working",
  };
});

export const agentMap: Record<string, Agent> = Object.fromEntries(
  initialAgents.map((a) => [a.id, a])
);

// ---- Finance / analytics mock metrics --------------------------------------

export const metrics: Metric[] = [
  { label: "Revenue (MTD)", value: 222000, format: "currency", trend: [120, 138, 150, 171, 190, 205, 222] },
  { label: "Costs (MTD)", value: 51400, format: "currency", trend: [40, 42, 44, 46, 48, 50, 51] },
  { label: "Profit (MTD)", value: 170600, format: "currency", trend: [80, 96, 106, 125, 142, 155, 170] },
  { label: "Active Agents", value: 12, format: "number", trend: [6, 7, 8, 9, 10, 11, 12] },
  { label: "Workflow Success", value: 96, format: "percent", trend: [88, 90, 91, 93, 94, 95, 96] },
  { label: "Avg CSAT", value: 95, format: "percent", trend: [90, 91, 92, 93, 94, 94, 95] },
];

// ---- Model Router providers ------------------------------------------------

export const modelProviders: ModelProvider[] = [
  { id: "anthropic", name: "Anthropic (Claude)", models: ["Opus 4.8", "Sonnet 4.6", "Haiku 4.5"], costPer1k: 15, speed: 78, maxContext: 200000, quality: 98, available: true },
  { id: "openrouter", name: "OpenRouter", models: ["200+ routed models"], costPer1k: 6, speed: 82, maxContext: 128000, quality: 88, available: true },
  { id: "local", name: "Local / Hermes", models: ["Hermes", "self-hosted"], costPer1k: 0.5, speed: 60, maxContext: 32000, quality: 80, available: true },
  { id: "fast", name: "Fast Tier", models: ["Haiku-class"], costPer1k: 1, speed: 95, maxContext: 64000, quality: 76, available: true },
];

import type { Agent } from "./types";

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "planner",
    name: "Pia the Planner",
    role: "planner",
    emoji: "🧭",
    color: "#60a5fa",
    desk: { x: 12, y: 22 },
    description: "Breaks the goal into ordered, doable steps.",
    status: "idle",
  },
  {
    id: "manager",
    name: "Marcus the Manager",
    role: "manager",
    emoji: "👔",
    color: "#f59e0b",
    desk: { x: 38, y: 18 },
    description: "Assigns each step to the right agent and tracks progress.",
    status: "idle",
  },
  {
    id: "prompter",
    name: "Penny the Prompter",
    role: "prompter",
    emoji: "✍️",
    color: "#a78bfa",
    desk: { x: 64, y: 22 },
    description: "Writes the precise instructions other agents need.",
    status: "idle",
  },
  {
    id: "developer",
    name: "Devon the Developer",
    role: "developer",
    emoji: "🛠️",
    color: "#34d399",
    desk: { x: 14, y: 58 },
    description: "Does the actual work — drafts, builds, produces output.",
    status: "idle",
  },
  {
    id: "reviewer",
    name: "Riley the Reviewer",
    role: "reviewer",
    emoji: "🔎",
    color: "#f472b6",
    desk: { x: 40, y: 62 },
    description: "Looks over the work, flags issues, suggests fixes.",
    status: "idle",
  },
  {
    id: "suggester",
    name: "Sage the Suggester",
    role: "suggester",
    emoji: "💡",
    color: "#fbbf24",
    desk: { x: 66, y: 58 },
    description: "Pings you with ideas and money-making opportunities.",
    status: "idle",
  },
  {
    id: "agentmaker",
    name: "Hugo the HR",
    role: "agentmaker",
    emoji: "🧬",
    color: "#22d3ee",
    desk: { x: 86, y: 40 },
    description: "Hires new agents — tell him what you need and he builds them.",
    status: "idle",
  },
];

export function makeCustomAgent(input: {
  name: string;
  job: string;
}): Agent {
  const id = `custom-${Date.now()}`;
  const emoji = pickEmoji(input.job);
  const color = pickColor(id);
  return {
    id,
    name: input.name || "New Hire",
    role: "custom",
    emoji,
    color,
    desk: randomDesk(),
    description: input.job,
    status: "idle",
    custom: true,
  };
}

function pickEmoji(job: string): string {
  const j = job.toLowerCase();
  if (j.includes("sell") || j.includes("sales")) return "💰";
  if (j.includes("market") || j.includes("ad")) return "📣";
  if (j.includes("design") || j.includes("art")) return "🎨";
  if (j.includes("write") || j.includes("copy")) return "📝";
  if (j.includes("research") || j.includes("find")) return "🔬";
  if (j.includes("data") || j.includes("number")) return "📊";
  if (j.includes("social") || j.includes("post")) return "📱";
  if (j.includes("support") || j.includes("help")) return "🎧";
  if (j.includes("legal") || j.includes("contract")) return "⚖️";
  if (j.includes("finance") || j.includes("money")) return "💵";
  return "🤖";
}

const PALETTE = [
  "#f87171", "#fb923c", "#facc15", "#a3e635",
  "#4ade80", "#2dd4bf", "#38bdf8", "#818cf8",
  "#c084fc", "#e879f9", "#fb7185",
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function randomDesk() {
  const slots = [
    { x: 14, y: 82 }, { x: 40, y: 82 }, { x: 66, y: 82 },
    { x: 86, y: 70 }, { x: 86, y: 14 },
  ];
  return slots[Math.floor(Math.random() * slots.length)];
}

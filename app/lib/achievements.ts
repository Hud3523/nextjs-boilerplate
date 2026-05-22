import type { Agent, Conversation } from "./types";

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

const A_RANGE = new Set(["A+", "A", "A-"]);

export function computeAchievements(
  agents: Agent[],
  conversations: Conversation[],
): Achievement[] {
  const totalRuns = agents.reduce((sum, a) => sum + a.runs, 0);
  const anyAPlus = agents.some((a) => a.bestGrade === "A+");
  const anyAce = agents.some((a) => a.skill >= 75);
  const anyLvl5 = agents.some((a) => a.skill >= 50);
  const customAgents = agents.filter((a) => a.custom);
  const defaults = agents.filter((a) => !a.custom);
  const allSolid = defaults.length > 0 && defaults.every((a) => a.skill >= 50);
  const streak3 = agents.some((a) => {
    const last3 = a.recentGrades.slice(-3);
    return last3.length === 3 && last3.every((g) => A_RANGE.has(g));
  });

  const list: Achievement[] = [
    {
      id: "first-run",
      icon: "🌱",
      title: "First Day on the Job",
      description: "Complete your first office run.",
      unlocked: totalRuns >= 1,
    },
    {
      id: "five-runs",
      icon: "⚙️",
      title: "Getting Into Rhythm",
      description: "Complete 5 agent tasks total.",
      unlocked: totalRuns >= 5,
    },
    {
      id: "veteran",
      icon: "🏛️",
      title: "Office Veteran",
      description: "Complete 25 agent tasks total.",
      unlocked: totalRuns >= 25,
    },
    {
      id: "first-aplus",
      icon: "⭐",
      title: "Top Marks",
      description: "An agent earns an A+ grade.",
      unlocked: anyAPlus,
    },
    {
      id: "streak",
      icon: "🔥",
      title: "On a Roll",
      description: "An agent scores 3 A-grades in a row.",
      unlocked: streak3,
    },
    {
      id: "level5",
      icon: "📈",
      title: "Leveled Up",
      description: "An agent reaches Solid tier (skill 50+).",
      unlocked: anyLvl5,
    },
    {
      id: "ace",
      icon: "🏅",
      title: "Ace Employee",
      description: "An agent reaches Ace tier (skill 75+).",
      unlocked: anyAce,
    },
    {
      id: "dream-team",
      icon: "🤝",
      title: "Dream Team",
      description: "Every core agent reaches Solid tier.",
      unlocked: allSolid,
    },
    {
      id: "recruiter",
      icon: "🧬",
      title: "Recruiter",
      description: "Hire your first custom agent.",
      unlocked: customAgents.length >= 1,
    },
    {
      id: "big-office",
      icon: "🏢",
      title: "Growing Company",
      description: "Have 3 or more custom agents.",
      unlocked: customAgents.length >= 3,
    },
    {
      id: "busy-week",
      icon: "🗂️",
      title: "Busy Week",
      description: "Start 5 conversations.",
      unlocked: conversations.length >= 5,
    },
  ];

  return list;
}

export function unlockedCount(list: Achievement[]): number {
  return list.filter((a) => a.unlocked).length;
}

import type { Agent, AgentRole, Grade, Message, Suggestion, Task } from "./types";
import { applyLearning, gradeOutput, planSteps, speak, suggesterPing } from "./mockBrain";

export interface RunCallbacks {
  setAgentStatus: (id: string, status: Agent["status"]) => void;
  applyAgentLearning: (id: string, grade: Grade, score: number) => void;
  addMessage: (msg: Message) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addSuggestion: (s: Suggestion) => void;
  setProgress: (p: number) => void;
  isCancelled: () => boolean;
  getAgent: (id: string) => Agent | undefined;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let mid = 0;
const newId = (p: string) => `${p}-${Date.now()}-${++mid}`;

export async function runOffice(
  goal: string,
  agents: Agent[],
  cb: RunCallbacks,
) {
  const steps = planSteps(goal);
  const totalSteps = steps.length;

  const byRole = (role: AgentRole) => agents.find((a) => a.role === role);

  for (let i = 0; i < steps.length; i++) {
    if (cb.isCancelled()) return;
    const step = steps[i];
    const agent = byRole(step.ownerRole);
    if (!agent) continue;

    const task: Task = {
      id: newId("task"),
      title: step.title,
      ownerId: agent.id,
      status: "queued",
      createdAt: Date.now(),
    };
    cb.addTask(task);

    await wait(300);
    if (cb.isCancelled()) return;

    cb.setAgentStatus(agent.id, "thinking");
    cb.updateTask(task.id, { status: "in_progress" });
    await wait(650);
    if (cb.isCancelled()) return;

    cb.setAgentStatus(agent.id, "working");
    const live = cb.getAgent(agent.id) || agent;
    const text = speak(agent.role, goal, live.skill);
    const { grade, score } = gradeOutput(live.skill);
    cb.applyAgentLearning(agent.id, grade, score);

    cb.addMessage({
      id: newId("msg"),
      agentId: agent.id,
      text,
      ts: Date.now(),
      kind: agent.role === "reviewer" ? "review" : "say",
      grade,
      score,
    });
    await wait(800);
    if (cb.isCancelled()) return;

    cb.updateTask(task.id, { status: "done", output: text });
    cb.setAgentStatus(agent.id, "done");
    cb.setProgress(Math.round(((i + 1) / totalSteps) * 100));

    if ((i === 1 || i === 4) && byRole("suggester")) {
      const s = byRole("suggester")!;
      const liveSage = cb.getAgent(s.id) || s;
      const tier = liveSage.skill >= 75 ? "ace" : liveSage.skill >= 50 ? "solid" : "rookie";
      cb.setAgentStatus(s.id, "working");
      const ping = suggesterPing(goal, tier);
      cb.addMessage({
        id: newId("msg"),
        agentId: s.id,
        text: ping,
        ts: Date.now(),
        kind: "suggest",
      });
      cb.addSuggestion({ id: newId("sg"), text: ping, ts: Date.now() });
      await wait(450);
      cb.setAgentStatus(s.id, "idle");
    }

    await wait(220);
  }

  agents.forEach((a) => cb.setAgentStatus(a.id, "idle"));
}

export function learn(agent: Agent, grade: Grade, score: number): Agent {
  const nextSkill = applyLearning(agent.skill, score);
  const nextGrades = [...agent.recentGrades, grade].slice(-8);
  const nextRuns = agent.runs + 1;
  const totalScore = agent.averageScore * agent.runs + score;
  const avg = totalScore / nextRuns;
  const best = bestGrade(agent.bestGrade, grade);
  return {
    ...agent,
    skill: nextSkill,
    runs: nextRuns,
    recentGrades: nextGrades,
    averageScore: Math.round(avg * 10) / 10,
    bestGrade: best,
  };
}

const GRADE_RANK: Record<Grade, number> = {
  "A+": 8, "A": 7, "A-": 6, "B+": 5, "B": 4, "B-": 3, "C": 2, "D": 1,
};

function bestGrade(prev: Grade | undefined, next: Grade): Grade {
  if (!prev) return next;
  return GRADE_RANK[next] > GRADE_RANK[prev] ? next : prev;
}

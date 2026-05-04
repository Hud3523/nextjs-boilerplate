import type { Agent, AgentRole, Message, Suggestion, Task } from "./types";
import { planSteps, speak, suggesterPing } from "./mockBrain";

export interface RunCallbacks {
  setAgentStatus: (id: string, status: Agent["status"]) => void;
  addMessage: (msg: Message) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addSuggestion: (s: Suggestion) => void;
  setProgress: (p: number) => void;
  isCancelled: () => boolean;
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

    await wait(350);
    if (cb.isCancelled()) return;

    cb.setAgentStatus(agent.id, "thinking");
    cb.updateTask(task.id, { status: "in_progress" });
    await wait(700);
    if (cb.isCancelled()) return;

    cb.setAgentStatus(agent.id, "working");
    const text = speak(agent.role, goal);
    cb.addMessage({
      id: newId("msg"),
      agentId: agent.id,
      text,
      ts: Date.now(),
      kind: agent.role === "reviewer" ? "review" : "say",
    });
    await wait(900);
    if (cb.isCancelled()) return;

    cb.updateTask(task.id, { status: "done", output: text });
    cb.setAgentStatus(agent.id, "done");
    cb.setProgress(Math.round(((i + 1) / totalSteps) * 100));

    if ((i === 1 || i === 4) && byRole("suggester")) {
      const s = byRole("suggester")!;
      cb.setAgentStatus(s.id, "working");
      const ping = suggesterPing(goal);
      cb.addMessage({
        id: newId("msg"),
        agentId: s.id,
        text: ping,
        ts: Date.now(),
        kind: "suggest",
      });
      cb.addSuggestion({ id: newId("sg"), text: ping, ts: Date.now() });
      await wait(500);
      cb.setAgentStatus(s.id, "idle");
    }

    await wait(250);
  }

  agents.forEach((a) => cb.setAgentStatus(a.id, "idle"));
}

export type AgentRole =
  | "planner"
  | "manager"
  | "prompter"
  | "developer"
  | "reviewer"
  | "suggester"
  | "agentmaker"
  | "custom";

export type AgentStatus = "idle" | "thinking" | "working" | "done" | "flagged";

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  emoji: string;
  color: string;
  desk: { x: number; y: number };
  description: string;
  status: AgentStatus;
  custom?: boolean;
}

export type TaskStatus = "queued" | "in_progress" | "done" | "flagged";

export interface Task {
  id: string;
  title: string;
  ownerId: string;
  status: TaskStatus;
  output?: string;
  createdAt: number;
}

export interface Message {
  id: string;
  agentId: string;
  to?: string;
  text: string;
  ts: number;
  kind: "say" | "handoff" | "review" | "suggest";
}

export interface Suggestion {
  id: string;
  text: string;
  ts: number;
}

export interface OfficeState {
  goal: string;
  running: boolean;
  agents: Agent[];
  tasks: Task[];
  messages: Message[];
  suggestions: Suggestion[];
  progress: number;
}

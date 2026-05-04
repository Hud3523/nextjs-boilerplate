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

export type Grade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C"
  | "D";

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
  skill: number;
  runs: number;
  recentGrades: Grade[];
  bestGrade?: Grade;
  averageScore: number;
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
  grade?: Grade;
  score?: number;
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

export interface Conversation {
  id: string;
  title: string;
  goal: string;
  messages: Message[];
  tasks: Task[];
  suggestions: Suggestion[];
  progress: number;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedState {
  agents: Agent[];
  conversations: Conversation[];
  activeId: string | null;
}

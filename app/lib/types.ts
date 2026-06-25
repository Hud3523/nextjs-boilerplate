// Core domain types for the HERMES OMEGA INFINITY AI Company OS.
// Everything is data-driven so new rooms, agents, connectors and providers
// can be added without touching component logic.

export type Vec2 = { x: number; y: number };

export type DepartmentId =
  | "command"
  | "ai-core"
  | "engineering"
  | "marketing"
  | "sales"
  | "finance"
  | "support"
  | "security"
  | "research"
  | "product"
  | "media";

export interface Department {
  id: DepartmentId;
  name: string;
  accent: string; // hex accent color used across the UI
}

export type RoomType =
  | "command"
  | "department"
  | "pod"
  | "meeting"
  | "facility";

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  department?: DepartmentId;
  // Position + size on the deck grid, in grid cells (0..GRID_W / 0..GRID_H).
  x: number;
  y: number;
  w: number;
  h: number;
  icon: string; // emoji glyph used as a quick visual marker
}

export type AgentState = "working" | "walking" | "meeting" | "idle";

export type Grade = "S" | "A" | "B" | "C";

export interface Agent {
  id: string;
  name: string;
  avatar: string; // emoji avatar
  department: DepartmentId;
  role: string;
  skills: string[];
  memory: string[];
  goals: string[];
  personality: string;
  grade: Grade;
  xp: number;
  xpToNext: number;
  revenue: number;
  cost: number;
  currentTask: string;
  homePodId: string; // room the agent calls home
  workQueue: string[];
  learningHistory: string[];
  relationships: string[]; // ids of related agents
  certifications: string[];

  // Live simulation state (mutated by the ship simulation hook).
  pos: Vec2;
  target: Vec2;
  targetRoomId: string;
  state: AgentState;
}

export interface Metric {
  label: string;
  value: number;
  unit?: string;
  // 7-point trend series used for inline sparklines.
  trend: number[];
  format?: "currency" | "number" | "percent";
}

// ---- Connector / Tool Manager types ----

export type ConnectorCategory =
  | "market-data"
  | "agent-runtime"
  | "reasoning"
  | "media"
  | "commerce"
  | "communication"
  | "storage";

export type ConnectorHealth = "healthy" | "degraded" | "offline" | "unconfigured";

export interface ConnectorCredential {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
}

export interface Connector {
  id: string;
  name: string;
  version: string;
  category: ConnectorCategory;
  description: string;
  repo?: string;
  permissions: string[];
  requiredCredentials: ConnectorCredential[];
  health: ConnectorHealth;
  enabled: boolean;
  // Usage metrics (mocked for this slice).
  callsToday: number;
  errorRate: number; // 0..1
  // How the connector physically attaches to the platform.
  integration: "in-process" | "external-service" | "reference";
}

// ---- Model Router types ----

export interface ModelProvider {
  id: string;
  name: string;
  models: string[];
  costPer1k: number; // USD per 1k output tokens
  speed: number; // relative 0..100
  maxContext: number; // tokens
  quality: number; // relative 0..100
  available: boolean;
}

export type RoutingStrategy = "quality" | "cost" | "speed" | "balanced";

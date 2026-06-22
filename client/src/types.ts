// Loose shared shapes mirroring the server payloads.
export interface ReportCard { latest: number | null; letter: string | null; history: { score: number; ts: number }[]; }

export interface Agent {
  id: string; callsign: string; role: string; floorId: string; agencyId: string;
  bay: string; trigger: string; intervalMinutes: number | null; model: string;
  allowedTools: string[]; guardrails: string[]; sandboxed: boolean; permanent: boolean;
  enabled: boolean; status: string; lastAction: string | null; lastRunAt: number | null;
  nextRunAt: number | null; reputationKey: string | null; report?: ReportCard; systemPrompt?: string;
}

export interface Doctrine {
  riskTolerance: number; nicheFocus: string; speedVsQuality: number;
  contentVsCommerce: number; validationThreshold: number; spendAggressiveness: number;
}

export interface Agency {
  id: string; name: string; doctrine: Doctrine; capital_usd: number; status: string;
  is_league: number; generation: number;
  pnl: { spend: number; revenue: number; net: number; roi: number | null }; equity: number;
}

export interface Floor {
  id: string; agency_id: string; parent_floor_id: string | null; name: string; mission: string;
  definition_of_done: string | null; budget_usd: number; status: string; depth: number;
  permanent: number; spend: number; revenue: number;
}

export interface Task {
  id: string; agent_id: string; floor_id: string | null; title: string; input: string;
  output: string | null; status: string; review_status: string | null; review_notes: string | null;
  attempts: number; input_tokens: number; output_tokens: number; cost_usd: number; model: string | null;
  sandboxed: number; structured: number; valid: number | null; raw_prompt: string | null;
  raw_response: string | null; edited: number; created_at: number; updated_at: number;
}

export interface Attention {
  id: string; ts: number; kind: string; severity: string; title: string; body: string | null;
  payload: string | null; task_id: string | null; agent_id: string | null; floor_id: string | null;
  agency_id: string | null; status: string;
}

export interface Opportunity {
  id: string; directive_id: string | null; agency_id: string | null; title: string; thesis: string | null;
  market: string | null; effort: string | null; risk: string | null; projected_return: string | null;
  confidence: number; playbook: string | null; contested: number; claimed_by: string | null;
  status: string; floor_id: string | null;
}

export interface LeaderEntry {
  agencyId: string; name: string; doctrine: Doctrine; capital: number; equity: number; status: string;
  spend: number; revenue: number; net: number; roi: number | null; score: number; rank: number;
}

export interface ActivityRow { id: string; ts: number; agent_id: string | null; task_id: string | null; floor_id: string | null; type: string; message: string; }

export interface Stats {
  revenueUsd: number; fundSpendUsd: number; realSpendTodayUsd: number; masterFundCapUsd: number;
  creditsRemainingUsd: number | null; lowCredit: boolean; model: string; cyclesToday: number;
  nextRunAt: number | null; paused: boolean; emergencyStop: boolean; dryRun: boolean;
  apiKeyConfigured: boolean; tournamentMode: string;
}

export interface Snapshot {
  agencies: Agency[]; floors: Floor[]; agents: Agent[]; leaderboard: LeaderEntry[];
  tasks: Task[]; attention: Attention[]; opportunities: Opportunity[]; directives: any[];
  tools: any[]; activity: ActivityRow[]; memory: any[]; reputation: any[]; season: any;
  seasons: any[]; analytics: any; briefing: any; stats: Stats; settings: any;
}

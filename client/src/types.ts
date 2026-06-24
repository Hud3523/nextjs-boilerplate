// Slim dashboard types — agents come from Hermes, tasks are the dashboard's own.
export interface Agent {
  id: string; name: string; role?: string; status: string; model?: string; parentId?: string | null;
}

export interface Task {
  id: string; agent_id: string; agent_name: string | null; instruction: string; output: string | null;
  status: string; model: string | null; cost_usd: number; tokens_in: number; tokens_out: number;
  edited: number; created_at: number; updated_at: number;
}

export interface ActivityRow {
  id: string; ts: number; agent_id: string | null; task_id: string | null; type: string; message: string;
}

export interface Stats {
  spendUsd: number; budgetCapUsd: number; creditsRemainingUsd: number | null;
  dryRun: boolean; emergencyStop: boolean; hermesMode: string; openRouterConfigured: boolean; needsReview: number;
}

export interface Snapshot {
  agents: Agent[]; tasks: Task[]; activity: ActivityRow[]; stats: Stats;
  hermes: { mode: string; health: { ok: boolean; detail: string } };
  settings: { budgetCapUsd: number; dryRun: boolean; emergencyStop: boolean; openRouterConfigured: boolean };
}

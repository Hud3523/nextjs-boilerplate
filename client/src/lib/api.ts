const J = { "Content-Type": "application/json" };

async function req(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? J : undefined, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
  return data;
}

export const api = {
  authStatus: () => req("GET", "/api/auth"),
  login: (password: string) => req("POST", "/api/login", { password }),
  logout: () => req("POST", "/api/logout"),
  state: () => req("GET", "/api/state"),
  agent: (id: string) => req("GET", `/api/agents/${id}`),
  agency: (id: string) => req("GET", `/api/agencies/${id}`),
  floor: (id: string) => req("GET", `/api/floors/${id}`),
  orgtree: () => req("GET", "/api/orgtree"),

  createTask: (b: { agentId: string; title: string; input: string }) => req("POST", "/api/tasks", b),
  editTask: (id: string, output: string) => req("PATCH", `/api/tasks/${id}`, { output }),
  approveTask: (id: string) => req("POST", `/api/tasks/${id}/approve`),
  rejectTask: (id: string) => req("POST", `/api/tasks/${id}/reject`),

  actAttention: (id: string, action: "approve" | "kill") => req("POST", `/api/attention/${id}/act`, { action }),
  resolveAttention: (id: string) => req("POST", `/api/attention/${id}/resolve`),

  createDirective: (text: string) => req("POST", "/api/directives", { text }),
  approveOpp: (id: string, agencyId?: string) => req("POST", `/api/opportunities/${id}/approve`, { agencyId }),
  killOpp: (id: string) => req("POST", `/api/opportunities/${id}/kill`),

  proposeAgent: (request: string, agencyId?: string, floorId?: string) => req("POST", "/api/factory/agent", { request, agencyId, floorId }),

  setAgentModel: (id: string, model: string | null) => req("POST", `/api/agents/${id}/model`, { model }),
  train: (id: string, mode: "mock" | "dry-run") => req("POST", `/api/agents/${id}/train`, { mode }),
  tests: (id: string) => req("GET", `/api/agents/${id}/tests`),
  feasibility: (id: string, input: string) => req("POST", `/api/agents/${id}/feasibility`, { input }),

  convene: (mode: "meeting" | "training" | "coaching", agentIds: string[], topic?: string) => req("POST", "/api/convene", { mode, agentIds, topic }),
  leaderboard: () => req("GET", "/api/leaderboard"),
  settleSeason: () => req("POST", "/api/league/season/settle"),
  whatIf: (s: unknown) => req("POST", "/api/league/whatif", s),
  promoteAgency: (id: string) => req("POST", `/api/agencies/${id}/promote`),
  disbandAgency: (id: string) => req("POST", `/api/agencies/${id}/disband`),

  emergencyStop: (on: boolean) => req("POST", "/api/control/emergency-stop", { on }),
  pause: (on: boolean) => req("POST", "/api/control/pause", { on }),
  setDryRun: (on: boolean, confirm?: number) => req("POST", "/api/control/dryrun", { on, confirm }),
  saveSettings: (b: unknown) => req("POST", "/api/settings", b),
  audit: () => req("GET", "/api/audit"),
};

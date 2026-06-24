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
  cost: () => req("GET", "/api/cost"),

  createTask: (agentId: string, instruction: string) => req("POST", "/api/tasks", { agentId, instruction }),
  editTask: (id: string, output: string) => req("PATCH", `/api/tasks/${id}`, { output }),
  approveTask: (id: string) => req("POST", `/api/tasks/${id}/approve`),
  rejectTask: (id: string) => req("POST", `/api/tasks/${id}/reject`),

  arm: (on: boolean, confirm?: number) => req("POST", "/api/control/arm", { on, confirm }),
  estop: (on: boolean) => req("POST", "/api/control/estop", { on }),
  saveSettings: (budgetCapUsd: number) => req("POST", "/api/settings", { budgetCapUsd }),
};

/**
 * Hermes adapter — the dashboard's ONLY connection to the agent engine.
 *
 * Hermes Agent (Nous Research) runs on the operator's machine and owns the
 * agents, memory, scheduler, tools, and sub-agents. This dashboard does NOT
 * reimplement any of that — it talks to Hermes through this adapter.
 *
 * Transport is configurable (HERMES_MODE):
 *   - "mock"  → built-in sample data, no Hermes needed (default; runs anywhere).
 *   - "http"  → Hermes's local HTTP gateway (HERMES_BASE_URL + endpoints).
 *   - "cli"   → shell out to the `hermes` CLI (HERMES_CLI).
 *
 * The exact HTTP endpoints / CLI verbs are kept in one place (CONFIG below) so
 * they can be matched to a specific Hermes install without touching the rest
 * of the dashboard. Verify these against hermes-agent.nousresearch.com/docs.
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(exec);

export type HermesStatus = "idle" | "working" | "blocked" | "unknown";

export interface HermesAgentInfo {
  id: string;
  name: string;
  role?: string;
  status: HermesStatus;
  model?: string;
  parentId?: string | null; // sub-agents reference their parent
}

export interface HermesTaskResult {
  id: string;
  agentId: string;
  status: "done" | "error";
  output: string;
  model?: string;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface HermesAdapter {
  mode: string;
  health(): Promise<{ ok: boolean; detail: string }>;
  listAgents(): Promise<HermesAgentInfo[]>;
  /** Send one instruction to an agent; optional token stream callback. */
  sendInstruction(agentId: string, instruction: string, onToken?: (t: string) => void): Promise<HermesTaskResult>;
  recentActivity(): Promise<{ ts: number; text: string }[]>;
}

// ── Endpoint / command config (edit to match your Hermes install) ────────────
const CONFIG = {
  baseUrl: process.env.HERMES_BASE_URL || "http://localhost:8787",
  cli: process.env.HERMES_CLI || "hermes",
  endpoints: {
    health: "/health",
    agents: "/agents",
    // POST { instruction } — adjust to the real Hermes message/run endpoint.
    message: (id: string) => `/agents/${encodeURIComponent(id)}/message`,
    activity: "/activity",
  },
};

// ── HTTP gateway implementation ──────────────────────────────────────────────
class HttpHermes implements HermesAdapter {
  mode = "http";
  private async req(path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(CONFIG.baseUrl + path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    if (!res.ok) throw new Error(`Hermes ${path} → HTTP ${res.status}`);
    return res.json();
  }
  async health() {
    try { await this.req(CONFIG.endpoints.health); return { ok: true, detail: `Hermes gateway reachable at ${CONFIG.baseUrl}` }; }
    catch (e) { return { ok: false, detail: (e as Error).message }; }
  }
  async listAgents(): Promise<HermesAgentInfo[]> {
    const data = await this.req(CONFIG.endpoints.agents);
    const arr = Array.isArray(data) ? data : data.agents ?? [];
    return arr.map((a: Record<string, unknown>) => ({
      id: String(a.id ?? a.name), name: String(a.name ?? a.id), role: a.role as string | undefined,
      status: (a.status as HermesStatus) ?? "unknown", model: a.model as string | undefined, parentId: (a.parentId ?? a.parent_id ?? null) as string | null,
    }));
  }
  async sendInstruction(agentId: string, instruction: string): Promise<HermesTaskResult> {
    const data = await this.req(CONFIG.endpoints.message(agentId), { method: "POST", body: JSON.stringify({ instruction }) });
    return {
      id: String(data.id ?? Date.now()), agentId, status: data.error ? "error" : "done",
      output: String(data.output ?? data.result ?? data.message ?? ""),
      model: data.model, costUsd: data.cost ?? data.total_cost, tokensIn: data.tokens_in, tokensOut: data.tokens_out,
    };
  }
  async recentActivity() {
    try { const d = await this.req(CONFIG.endpoints.activity); const arr = Array.isArray(d) ? d : d.activity ?? []; return arr.map((x: Record<string, unknown>) => ({ ts: Number(x.ts ?? Date.now()), text: String(x.text ?? x.message ?? "") })); }
    catch { return []; }
  }
}

// ── CLI fallback implementation ──────────────────────────────────────────────
class CliHermes implements HermesAdapter {
  mode = "cli";
  async health() {
    try { const { stdout } = await pexec(`${CONFIG.cli} --version`); return { ok: true, detail: stdout.trim() }; }
    catch (e) { return { ok: false, detail: `\`${CONFIG.cli}\` not runnable: ${(e as Error).message}` }; }
  }
  async listAgents(): Promise<HermesAgentInfo[]> {
    try {
      const { stdout } = await pexec(`${CONFIG.cli} agents --json`);
      const arr = JSON.parse(stdout);
      return arr.map((a: Record<string, unknown>) => ({ id: String(a.id ?? a.name), name: String(a.name ?? a.id), role: a.role as string, status: (a.status as HermesStatus) ?? "unknown", model: a.model as string }));
    } catch { return []; }
  }
  async sendInstruction(agentId: string, instruction: string): Promise<HermesTaskResult> {
    const safe = instruction.replace(/"/g, '\\"');
    const { stdout } = await pexec(`${CONFIG.cli} run --agent ${JSON.stringify(agentId)} "${safe}"`, { maxBuffer: 8 * 1024 * 1024 });
    return { id: String(Date.now()), agentId, status: "done", output: stdout.trim() };
  }
  async recentActivity() { return []; }
}

// ── Mock implementation (no Hermes required) ─────────────────────────────────
class MockHermes implements HermesAdapter {
  mode = "mock";
  private agents: HermesAgentInfo[] = [
    { id: "hermes", name: "Hermes", role: "Primary agent", status: "idle", model: "anthropic/claude-sonnet-4", parentId: null },
    { id: "scout", name: "Scout", role: "Research sub-agent", status: "idle", model: "openai/gpt-4o-mini", parentId: "hermes" },
    { id: "scribe", name: "Scribe", role: "Writing sub-agent", status: "idle", model: "anthropic/claude-sonnet-4", parentId: "hermes" },
    { id: "forge", name: "Forge", role: "Commerce sub-agent", status: "idle", model: "openai/gpt-4o", parentId: "hermes" },
  ];
  async health() { return { ok: true, detail: "MOCK Hermes — no engine connected. Set HERMES_MODE=http|cli to use your real install." }; }
  async listAgents() { return this.agents; }
  async sendInstruction(agentId: string, instruction: string, onToken?: (t: string) => void): Promise<HermesTaskResult> {
    const name = this.agents.find((a) => a.id === agentId)?.name ?? agentId;
    const text = `[MOCK Hermes] ${name} received: "${instruction.slice(0, 160)}". This is a simulated result — point HERMES_MODE at your real Hermes to get live output.`;
    if (onToken) for (const w of text.split(/(\s+)/)) { onToken(w); await new Promise((r) => setTimeout(r, 6)); }
    return { id: String(Date.now()), agentId, status: "done", output: text, model: this.agents.find((a) => a.id === agentId)?.model, costUsd: 0 };
  }
  async recentActivity() { return [{ ts: Date.now(), text: "Mock Hermes idle. No real engine connected." }]; }
}

let singleton: HermesAdapter | null = null;
export function hermes(): HermesAdapter {
  if (singleton) return singleton;
  const mode = (process.env.HERMES_MODE || "mock").toLowerCase();
  singleton = mode === "http" ? new HttpHermes() : mode === "cli" ? new CliHermes() : new MockHermes();
  return singleton;
}

/**
 * Tool / Skill Registry.
 *
 * The catalog of safe, named capabilities an agent can be granted. The Agent
 * Factory (Architect) composes new agents ONLY from these keys — it cannot
 * invent capabilities. Internal tools never touch the outside world; external
 * tools are stubbed integrations that ship `configured: false` and surface as
 * blockers until real credentials + code are wired in.
 *
 * To add a capability: add an entry here. To make an external tool real:
 * implement `publish()` and flip `configured` once credentials exist — the
 * approval gate in the engine still authorizes the action.
 */

export interface PublishResult {
  ok: boolean;
  externalUrl?: string;
  message: string;
}

export interface Tool {
  key: string;
  label: string;
  description: string;
  /** external tools can perform outward-facing actions (all stubbed for now). */
  external: boolean;
  configured: boolean;
  setupHint?: string;
  publish?(payload: unknown): Promise<PublishResult>;
}

function externalStub(key: string, label: string, description: string, setupHint: string): Tool {
  return {
    key,
    label,
    description,
    external: true,
    configured: false,
    setupHint,
    async publish() {
      return { ok: false, message: `${label} is not configured — this stub refuses to fake a real action.` };
    },
  };
}

function internal(key: string, label: string, description: string): Tool {
  return { key, label, description, external: false, configured: true };
}

export const TOOL_REGISTRY: Record<string, Tool> = {
  // ── internal capabilities (no external reach, always available) ──────────
  web_research: internal("web_research", "Web Research", "Read-only research and synthesis. Cannot post anything."),
  write_brief: internal("write_brief", "Write Brief", "Draft decision-ready research/strategy briefs."),
  draft_copy: internal("draft_copy", "Draft Copy", "Draft scripts, captions, ad copy, image prompts."),
  draft_listing: internal("draft_listing", "Draft Listing", "Draft product listings, descriptions, pricing."),
  draft_message: internal("draft_message", "Draft Message", "Draft customer replies and outreach messages."),
  run_analysis: internal("run_analysis", "Run Analysis", "Analyse data/options and produce recommendations."),
  plan: internal("plan", "Plan", "Decompose goals into structured, assignable plans."),
  review_qa: internal("review_qa", "Review / QA", "Critique outputs against a spec and return fixes."),
  spawn_floor: internal("spawn_floor", "Spawn Floor", "Author org charts and request new floors (gated)."),
  spawn_agent: internal("spawn_agent", "Spawn Agent", "Author new agent configs from the registry (gated)."),
  manage_budget: internal("manage_budget", "Manage Budget", "Track spend and enforce caps; can halt floors."),

  // ── local computer control (gated by ENABLE_SHELL + per-command approval) ──
  shell: {
    key: "shell",
    label: "Computer / Shell",
    description: "Propose shell commands to run on the operator's computer (per-command approval required).",
    external: true,
    configured: process.env.ENABLE_SHELL === "true",
    setupHint: "Run the app on your computer and set ENABLE_SHELL=true; every command still needs your approval.",
    async publish() {
      return { ok: false, message: "Use the approval queue to run commands — shell does not auto-publish." };
    },
  },

  // ── external integrations (stubbed; gated behind approval + config) ──────
  shopify: externalStub("shopify", "Shopify", "Publish/update store listings.", "Add a Shopify store + Admin API token, then implement publish()."),
  etsy: externalStub("etsy", "Etsy", "Publish Etsy listings.", "Complete Etsy OAuth and add shop credentials."),
  youtube: externalStub("youtube", "YouTube", "Upload/schedule videos.", "Connect a Google account with YouTube Data API scope."),
  tiktok: externalStub("tiktok", "TikTok", "Publish short-form video.", "Complete TikTok OAuth (content.publish scope)."),
  x: externalStub("x", "X / Twitter", "Post to X.", "Add X API v2 credentials with write access."),
  email: externalStub("email", "Email", "Send transactional/outreach email.", "Add an SMTP / transactional email provider."),
};

export function getTool(key: string): Tool | undefined {
  return TOOL_REGISTRY[key];
}

export function listTools() {
  return Object.values(TOOL_REGISTRY).map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    external: t.external,
    configured: t.configured,
    setupHint: t.setupHint ?? null,
  }));
}

/** Valid tool keys, used by the Factory to validate composed agents. */
export function validToolKeys(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

/** External, unconfigured tools among a set — these become blockers. */
export function unconfiguredExternal(keys: string[]): Tool[] {
  return keys
    .map(getTool)
    .filter((t): t is Tool => Boolean(t) && t!.external && !t!.configured);
}

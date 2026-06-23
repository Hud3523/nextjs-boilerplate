import { exec } from "node:child_process";
import { promisify } from "node:util";
import { frozen, gov } from "./governance.js";
import { raiseAttention } from "./attention.js";
import { logActivity } from "./bus.js";
import { audit } from "./audit.js";
import { screenCommand } from "./security.js";
import type { AgentRow } from "./agents.js";

const pexec = promisify(exec);

/**
 * Local command execution — the highest-risk capability in the system.
 *
 * Defence in depth:
 *  1. ENABLE_SHELL must be true on the host (off by default).
 *  2. Agents only PROPOSE commands; nothing runs without per-command operator
 *     approval from the ATTENTION queue.
 *  3. Dry-run shows what *would* run and executes nothing.
 *  4. Emergency stop / pause blocks all execution.
 *  5. Every proposal and execution is written to the audit log.
 *
 * ⚠️ Only enable on a machine you control, behind the operator login. Never on
 * a public host without auth — this runs arbitrary commands as your user.
 */
export function shellEnabled(): boolean {
  return process.env.ENABLE_SHELL === "true";
}
export function shellCwd(): string {
  return process.env.SHELL_CWD || process.cwd();
}

function trunc(s: string | undefined, n = 4000): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + `\n…(${s.length - n} more chars truncated)` : s;
}

/**
 * Queue a command for the operator to approve — after Warden screens it.
 * Destructive commands are blocked here and never reach the approval queue.
 */
export function proposeCommand(agent: AgentRow, cmd: string, why: string) {
  const screen = screenCommand(cmd);

  if (screen.verdict === "block") {
    raiseAttention({
      kind: "escalation",
      severity: "critical",
      title: `🛡️ Warden blocked a dangerous command from ${agent.callsign}`,
      body: `$ ${cmd}\n\nBlocked because it: ${screen.reasons.join("; ")}.\nThis command was NOT offered for approval and cannot run.`,
      agentId: "warden",
      floorId: agent.floor_id,
    });
    audit("warden", "block_command", { cmd, reasons: screen.reasons, from: agent.id });
    logActivity("system", `🛡️ Warden BLOCKED a dangerous command from ${agent.callsign}: ${cmd.slice(0, 90)}`, { agentId: "warden" });
    return;
  }

  const flagged = screen.verdict === "flag";
  raiseAttention({
    kind: "approval",
    severity: flagged ? "critical" : "warn",
    title: `Run on your computer: ${cmd.slice(0, 80)}`,
    body: flagged
      ? `🛡️ Warden FLAGGED this — it ${screen.reasons.join("; ")}. Review extra carefully before approving.`
      : why || "Command proposed by an agent. Review before approving.",
    payload: { kind: "shell_command", cmd, why, cwd: shellCwd(), agentId: agent.id, flagged, reasons: screen.reasons },
    agentId: agent.id,
    floorId: agent.floor_id,
    agencyId: agent.agency_id,
  });
  audit(agent.id, "propose_command", { cmd, verdict: screen.verdict, reasons: screen.reasons });
  logActivity("system", `${agent.callsign} proposes a command (Warden: ${screen.verdict}): ${cmd.slice(0, 90)}`, { agentId: agent.id });
}

export interface RunResult {
  ok: boolean; stdout?: string; stderr?: string; code?: number; error?: string; simulated?: boolean;
}

/** Execute a command — ONLY called after operator approval. */
export async function runCommand(cmd: string): Promise<RunResult> {
  // Defence in depth: re-screen at execution time so a blocked command can
  // never run even if it somehow reached this point.
  const screen = screenCommand(cmd);
  if (screen.verdict === "block") return { ok: false, error: `Blocked by Warden security screen: ${screen.reasons.join("; ")}.` };
  if (frozen()) return { ok: false, error: "Execution frozen (emergency stop / pause active)." };
  if (gov.dryRun()) {
    audit("operator", "run_command_dryrun", { cmd });
    return { ok: true, simulated: true, stdout: `[dry-run] would execute on host:\n$ ${cmd}`, code: 0 };
  }
  if (!shellEnabled()) {
    return { ok: false, error: "Shell execution is disabled. Set ENABLE_SHELL=true on the host (your computer) to allow real commands." };
  }
  audit("operator", "run_command", { cmd, cwd: shellCwd() });
  logActivity("system", `▶ Executing approved command: ${cmd.slice(0, 120)}`);
  try {
    const { stdout, stderr } = await pexec(cmd, { cwd: shellCwd(), timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
    logActivity("info", `Command finished (exit 0): ${cmd.slice(0, 80)}`);
    return { ok: true, stdout: trunc(stdout), stderr: trunc(stderr), code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string; code?: number };
    logActivity("info", `Command exited ${err.code ?? 1}: ${cmd.slice(0, 80)}`);
    return { ok: false, stdout: trunc(err.stdout), stderr: trunc(err.stderr || err.message), code: err.code ?? 1, error: err.message };
  }
}

/** Dry-run stand-in: a couple of harmless example commands for the task. */
export function simulateShellPlan(input: string): { plan: string; commands: { cmd: string; why: string }[] } {
  return {
    plan: `[Dry-run] Plan to accomplish: ${input.slice(0, 120)}`,
    commands: [
      { cmd: "ls -la", why: "Inspect the working directory before acting." },
      { cmd: "echo 'hello from your agent'", why: "Confirm command execution works end-to-end." },
    ],
  };
}

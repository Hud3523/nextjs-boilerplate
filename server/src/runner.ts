import { hermes } from "./hermes/index.js";
import { emit, logActivity } from "./bus.js";
import { frozen, budgetOk } from "./ledger.js";
import { getTask, updateTask } from "./tasks.js";

/** Agents currently executing a dashboard task (overlaid on Hermes's roster). */
export const working = new Set<string>();

/**
 * Send a task's instruction to Hermes, stream the result, and park it in the
 * approval queue (needs_review). The dashboard never fakes the work — Hermes
 * does it; the dashboard routes the job and gates the result.
 */
export async function runTask(taskId: string): Promise<void> {
  const task = getTask(taskId);
  if (!task) return;
  if (frozen()) { updateTask(taskId, { status: "queued" }); logActivity("system", "Run skipped — execution halted.", { taskId }); return; }
  if (!budgetOk()) { updateTask(taskId, { status: "queued" }); return; }

  updateTask(taskId, { status: "running" });
  working.add(task.agent_id);
  emit({ type: "agents", payload: { id: task.agent_id, status: "working" } });
  logActivity("run_start", `${task.agent_name ?? task.agent_id} started: ${task.instruction.slice(0, 80)}`, { agentId: task.agent_id, taskId });

  try {
    const result = await hermes().sendInstruction(task.agent_id, task.instruction, (t) =>
      emit({ type: "token", payload: { taskId, agentId: task.agent_id, text: t } }),
    );
    updateTask(taskId, {
      status: result.status === "error" ? "error" : "needs_review",
      output: result.output,
      model: result.model ?? null,
      cost_usd: result.costUsd ?? 0,
      tokens_in: result.tokensIn ?? 0,
      tokens_out: result.tokensOut ?? 0,
    });
    logActivity("run_end", `${task.agent_name ?? task.agent_id} finished — $${(result.costUsd ?? 0).toFixed(4)}. Awaiting your review.`, { agentId: task.agent_id, taskId });
  } catch (e) {
    updateTask(taskId, { status: "error", output: `Hermes error: ${(e as Error).message}` });
    logActivity("run_end", `${task.agent_name ?? task.agent_id} errored: ${(e as Error).message}`, { agentId: task.agent_id, taskId });
  } finally {
    working.delete(task.agent_id);
    emit({ type: "agents", payload: { id: task.agent_id, status: "idle" } });
  }
}

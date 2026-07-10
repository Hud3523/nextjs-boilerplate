import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { err, ok, type Result } from "@/lib/result";
import {
  metersWithCreditOverage,
  quotaFor,
  UNLIMITED,
  type Meter,
  type Tier,
} from "./matrix";

export interface QuotaError {
  kind: "quota_exceeded";
  meter: Meter;
  quota: number;
}
export interface UsageFailure {
  kind: "usage_failure";
  meter: Meter;
  cause: string;
}

/**
 * Debit usage server-side BEFORE the metered work happens (never client-side,
 * never after). Delegates to the transactional SQL function debit_usage(),
 * which locks the counter row, checks quota + credit balance, records the
 * event, and increments — all atomically (ARCHITECTURE.md §3.3).
 *
 * Returns the usage_event id so a hard failure downstream (model never
 * invoked) can refund via refundUsage().
 */
export async function debitUsage(params: {
  workspaceId: string;
  userId: string | null;
  tier: Tier;
  meter: Meter;
  quantity: number;
  model?: string;
  promptHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<Result<{ usageEventId: string }, QuotaError | UsageFailure>> {
  const quota = quotaFor(params.tier, params.meter);
  const quotaParam = quota === UNLIMITED ? null : quota;
  const allowCredits = metersWithCreditOverage().has(params.meter);

  try {
    const rows = await db().execute<{ debit_usage: string }>(sql`
      select public.debit_usage(
        ${params.workspaceId}::uuid,
        ${params.userId}::uuid,
        ${params.meter},
        ${params.quantity}::bigint,
        ${quotaParam}::bigint,
        ${allowCredits},
        ${params.model ?? null},
        ${params.promptHash ?? null},
        ${JSON.stringify(params.metadata ?? {})}::jsonb
      ) as debit_usage
    `);
    const eventId = rows[0]?.debit_usage;
    if (!eventId) {
      return err({ kind: "usage_failure", meter: params.meter, cause: "no event id returned" });
    }
    return ok({ usageEventId: eventId });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("quota_exceeded")) {
      return err({ kind: "quota_exceeded", meter: params.meter, quota });
    }
    return err({ kind: "usage_failure", meter: params.meter, cause: message });
  }
}

/** Compensate a debit whose metered work never happened. Idempotent per event. */
export async function refundUsage(
  usageEventId: string,
): Promise<Result<void, UsageFailure>> {
  try {
    await db().execute(sql`select public.refund_usage(${usageEventId}::uuid)`);
    return ok(undefined);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err({ kind: "usage_failure", meter: "ai_generations", cause: message });
  }
}

/** Current-period usage for the dashboard. */
export async function getUsage(
  workspaceId: string,
  meter: Meter,
): Promise<number> {
  const rows = await db().execute<{ used: string | number | null }>(sql`
    select used from usage_counters
    where workspace_id = ${workspaceId}::uuid
      and meter = ${meter}
      and period_start = date_trunc('month', now() at time zone 'utc')::date
  `);
  return Number(rows[0]?.used ?? 0);
}

export async function getCreditBalance(workspaceId: string): Promise<number> {
  const rows = await db().execute<{ balance: string | number | null }>(sql`
    select coalesce(sum(delta), 0) as balance
    from credit_ledger where workspace_id = ${workspaceId}::uuid
  `);
  return Number(rows[0]?.balance ?? 0);
}

import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db, schema } from "@/lib/db";
import {
  hasAccess as tierHasAccess,
  resolveTier,
  type Feature,
  type Tier,
} from "@/lib/entitlements/matrix";
import { supabaseServer } from "@/lib/supabase/server";

export type WorkspaceRole = "owner" | "admin" | "editor" | "client";

export interface WorkspaceCtx {
  userId: string;
  email: string | null;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole;
  /** Tier resolved through status + grace — the only tier the app ever sees. */
  tier: Tier;
  stripeCustomerId: string | null;
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled";
  graceUntil: Date | null;
}

/**
 * Resolve the signed-in user's workspace context. Every server action and
 * data read goes through this — it is the tenancy boundary for the service-
 * credential connection (see lib/db). Per-request memoized.
 */
export const getWorkspaceCtx = cache(async (): Promise<WorkspaceCtx | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await db()
    .select({
      workspaceId: schema.workspaceMembers.workspaceId,
      role: schema.workspaceMembers.role,
      name: schema.workspaces.name,
      slug: schema.workspaces.slug,
    })
    .from(schema.workspaceMembers)
    .innerJoin(
      schema.workspaces,
      eq(schema.workspaces.id, schema.workspaceMembers.workspaceId),
    )
    .where(eq(schema.workspaceMembers.userId, user.id))
    .limit(1);

  const first = membership[0];
  if (!first) return null;

  const subRows = await db()
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.workspaceId, first.workspaceId))
    .limit(1);
  const sub = subRows[0] ?? null;

  const tier = resolveTier(
    sub
      ? { tier: sub.tier, status: sub.status, graceUntil: sub.graceUntil }
      : null,
    new Date(),
  );

  return {
    userId: user.id,
    email: user.email ?? null,
    workspaceId: first.workspaceId,
    workspaceName: first.name,
    workspaceSlug: first.slug,
    role: first.role,
    tier,
    stripeCustomerId: sub?.stripeCustomerId ?? null,
    subscriptionStatus: sub?.status ?? "active",
    graceUntil: sub?.graceUntil ?? null,
  };
});

export function hasAccess(ctx: WorkspaceCtx, feature: Feature): boolean {
  return tierHasAccess(ctx.tier, feature);
}

export function canManageBilling(ctx: WorkspaceCtx): boolean {
  return ctx.role === "owner" || ctx.role === "admin";
}

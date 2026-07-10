import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * THE cross-tenant proof (threat T1): user A must not be able to read or
 * write user B's data through the Supabase (PostgREST) surface, where RLS is
 * the enforcement line.
 *
 * Requires a provisioned Supabase project with migrations applied and two
 * password-auth test users (never production users):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   RLS_TEST_USER_A_EMAIL / RLS_TEST_USER_A_PASSWORD
 *   RLS_TEST_USER_B_EMAIL / RLS_TEST_USER_B_PASSWORD
 * Skipped (visibly) when unconfigured.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const USER_A = {
  email: process.env.RLS_TEST_USER_A_EMAIL,
  password: process.env.RLS_TEST_USER_A_PASSWORD,
};
const USER_B = {
  email: process.env.RLS_TEST_USER_B_EMAIL,
  password: process.env.RLS_TEST_USER_B_PASSWORD,
};

const configured = Boolean(
  SUPABASE_URL && ANON_KEY && USER_A.email && USER_A.password && USER_B.email && USER_B.password,
);

async function signedInClient(user: { email?: string; password?: string }): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email!,
    password: user.password!,
  });
  if (error) throw new Error(`test user sign-in failed: ${error.message}`);
  return client;
}

test.describe("row-level security: cross-tenant isolation", () => {
  test.skip(!configured, "RLS e2e env not configured — see file header");

  test("user A cannot read or write user B's workspace data", async () => {
    const a = await signedInClient(USER_A);
    const b = await signedInClient(USER_B);

    // Each user sees exactly their own workspace(s).
    const { data: aWorkspaces } = await a.from("workspaces").select("id");
    const { data: bWorkspaces } = await b.from("workspaces").select("id");
    expect(aWorkspaces?.length).toBeGreaterThan(0);
    expect(bWorkspaces?.length).toBeGreaterThan(0);

    const bWorkspaceId = bWorkspaces![0]!.id as string;
    const aIds = new Set(aWorkspaces!.map((w) => w.id as string));
    expect(aIds.has(bWorkspaceId)).toBe(false);

    // Direct read of B's rows by id → empty, not error (RLS filters silently).
    const { data: crossRead } = await a
      .from("workspaces")
      .select("id, name")
      .eq("id", bWorkspaceId);
    expect(crossRead).toEqual([]);

    for (const table of ["subscriptions", "usage_events", "usage_counters", "credit_ledger", "workspace_members"]) {
      const { data } = await a.from(table).select("workspace_id").eq("workspace_id", bWorkspaceId);
      expect(data, `cross-tenant read of ${table}`).toEqual([]);
    }

    // Cross-tenant write → zero rows affected.
    const { data: updated } = await a
      .from("workspaces")
      .update({ name: "pwned" })
      .eq("id", bWorkspaceId)
      .select("id");
    expect(updated).toEqual([]);

    // Membership injection into B's workspace → rejected.
    const { data: aUser } = await a.auth.getUser();
    const { error: insertError, data: inserted } = await a
      .from("workspace_members")
      .insert({ workspace_id: bWorkspaceId, user_id: aUser.user!.id, role: "owner" })
      .select("workspace_id");
    expect(insertError !== null || inserted?.length === 0).toBe(true);

    // Billing internals are not readable by anyone via PostgREST.
    const { data: events, error: eventsError } = await a.from("stripe_events").select("id");
    expect(eventsError !== null || events?.length === 0).toBe(true);
  });
});

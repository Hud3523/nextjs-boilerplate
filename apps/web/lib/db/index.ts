import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

let instance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Server-side database access with service credentials. This connection
 * bypasses RLS by design: every query MUST be scoped through a WorkspaceCtx
 * (lib/workspaces). RLS guards the Supabase client path (PostgREST) as
 * defense-in-depth — see ARCHITECTURE.md §3.6.
 */
export function db(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    // prepare:false — required behind Supabase's transaction-mode pooler.
    const client = postgres(env.DATABASE_URL, { prepare: false });
    instance = drizzle(client, { schema });
  }
  return instance;
}

export { schema };

-- ============================================================================
-- RLS, membership helper, usage metering functions, signup provisioning.
--
-- RLS is enabled on EVERY table (ARCHITECTURE.md §3.6). The app server talks
-- to Postgres with service credentials and scopes by workspace in code; these
-- policies guard the PostgREST/anon surface as defense-in-depth, and are
-- proven by the cross-tenant Playwright test (e2e/rls.spec.ts).
--
-- Statements touching Supabase-specific objects (auth schema, auth.uid()) are
-- wrapped in existence guards so the migration also applies to plain Postgres
-- (local test databases).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Membership helper. SECURITY DEFINER so policies can consult
-- workspace_members without recursive RLS evaluation.
-- ---------------------------------------------------------------------------
create or replace function public.role_rank(p_role text) returns int
language sql immutable as $$
  select case p_role
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'client' then 1
    else 0
  end;
$$;
--> statement-breakpoint

do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute $fn$
      create or replace function public.is_member(p_workspace_id uuid, p_min_role text)
      returns boolean
      language sql stable security definer
      set search_path = public
      as $body$
        select exists (
          select 1 from workspace_members m
          where m.workspace_id = p_workspace_id
            and m.user_id = auth.uid()
            and public.role_rank(m.role::text) >= public.role_rank(p_min_role)
        );
      $body$;
    $fn$;
    execute 'revoke execute on function public.is_member(uuid, text) from public';
    execute 'grant execute on function public.is_member(uuid, text) to authenticated';
  end if;
end $do$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. Tables with no policies (stripe_events, and all
-- writes to billing/metering tables) are service-role only by construction.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
--> statement-breakpoint
alter table public.workspaces enable row level security;
--> statement-breakpoint
alter table public.workspace_members enable row level security;
--> statement-breakpoint
alter table public.subscriptions enable row level security;
--> statement-breakpoint
alter table public.stripe_events enable row level security;
--> statement-breakpoint
alter table public.usage_counters enable row level security;
--> statement-breakpoint
alter table public.usage_events enable row level security;
--> statement-breakpoint
alter table public.credit_ledger enable row level security;
--> statement-breakpoint

do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    -- profiles: own row only
    execute 'create policy profiles_select on public.profiles for select using (user_id = auth.uid())';
    execute 'create policy profiles_update on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid())';

    -- workspaces
    execute 'create policy workspaces_select on public.workspaces for select using (public.is_member(id, ''client''))';
    execute 'create policy workspaces_update on public.workspaces for update using (public.is_member(id, ''admin''))';
    execute 'create policy workspaces_delete on public.workspaces for delete using (public.is_member(id, ''owner''))';

    -- workspace_members: members see the roster; admins manage it; self-leave allowed
    execute 'create policy members_select on public.workspace_members for select using (public.is_member(workspace_id, ''client''))';
    execute 'create policy members_insert on public.workspace_members for insert with check (public.is_member(workspace_id, ''admin''))';
    execute 'create policy members_update on public.workspace_members for update using (public.is_member(workspace_id, ''admin''))';
    execute 'create policy members_delete on public.workspace_members for delete using (public.is_member(workspace_id, ''admin'') or user_id = auth.uid())';

    -- billing & metering: members may read; nobody but the service role writes
    execute 'create policy subscriptions_select on public.subscriptions for select using (public.is_member(workspace_id, ''client''))';
    execute 'create policy usage_counters_select on public.usage_counters for select using (public.is_member(workspace_id, ''client''))';
    execute 'create policy usage_events_select on public.usage_events for select using (public.is_member(workspace_id, ''client''))';
    execute 'create policy credit_ledger_select on public.credit_ledger for select using (public.is_member(workspace_id, ''client''))';
    -- stripe_events: RLS enabled, zero policies — service role only.
  end if;
end $do$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- debit_usage: THE quota gate. Locks the (workspace, meter, month) counter
-- row, checks quota + credit balance, records the event, increments — one
-- transaction. Called server-side BEFORE metered work; p_quota null =
-- unlimited. Returns the usage_event id for potential refund.
-- ---------------------------------------------------------------------------
create or replace function public.debit_usage(
  p_workspace_id uuid,
  p_user_id uuid,
  p_meter text,
  p_quantity bigint,
  p_quota bigint,
  p_allow_credits boolean default false,
  p_model text default null,
  p_prompt_hash text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_period date := (date_trunc('month', now() at time zone 'utc'))::date;
  v_used bigint;
  v_credits bigint := 0;
  v_over bigint := 0;
  v_event_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  insert into usage_counters (workspace_id, meter, period_start, used)
  values (p_workspace_id, p_meter, v_period, 0)
  on conflict (workspace_id, meter, period_start) do nothing;

  select used into v_used
  from usage_counters
  where workspace_id = p_workspace_id and meter = p_meter and period_start = v_period
  for update;

  if p_quota is not null then
    v_over := greatest(0, v_used + p_quantity - p_quota);
    if v_over > 0 then
      if not p_allow_credits then
        raise exception 'quota_exceeded';
      end if;
      -- Credit reads are serialized by the counter row lock above.
      select coalesce(sum(delta), 0) into v_credits
      from credit_ledger where workspace_id = p_workspace_id;
      if v_credits < v_over then
        raise exception 'quota_exceeded';
      end if;
      insert into credit_ledger (workspace_id, delta, reason)
      values (p_workspace_id, -v_over, 'overage:' || p_meter);
    end if;
  end if;

  update usage_counters
  set used = used + p_quantity
  where workspace_id = p_workspace_id and meter = p_meter and period_start = v_period;

  insert into usage_events (workspace_id, user_id, meter, quantity, model, prompt_hash, metadata)
  values (
    p_workspace_id, p_user_id, p_meter, p_quantity, p_model, p_prompt_hash,
    p_metadata || jsonb_build_object('credits_consumed', v_over, 'period_start', v_period)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- refund_usage: compensate a debit whose work never happened (e.g. the model
-- was never invoked). Idempotent per source event.
-- ---------------------------------------------------------------------------
create or replace function public.refund_usage(p_usage_event_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_event usage_events%rowtype;
  v_period date;
  v_credits_consumed bigint;
begin
  select * into v_event from usage_events where id = p_usage_event_id;
  if not found then
    raise exception 'unknown_usage_event';
  end if;
  if exists (
    select 1 from usage_events
    where metadata ->> 'refund_of' = p_usage_event_id::text
  ) then
    return; -- already refunded
  end if;

  v_period := (v_event.metadata ->> 'period_start')::date;
  v_credits_consumed := coalesce((v_event.metadata ->> 'credits_consumed')::bigint, 0);

  update usage_counters
  set used = greatest(0, used - v_event.quantity)
  where workspace_id = v_event.workspace_id
    and meter = v_event.meter
    and period_start = v_period;

  if v_credits_consumed > 0 then
    insert into credit_ledger (workspace_id, delta, reason)
    values (v_event.workspace_id, v_credits_consumed, 'refund:' || v_event.meter);
  end if;

  insert into usage_events (workspace_id, user_id, meter, quantity, metadata)
  values (
    v_event.workspace_id, v_event.user_id, v_event.meter, -v_event.quantity,
    jsonb_build_object('refund_of', p_usage_event_id, 'period_start', v_period)
  );
end;
$$;
--> statement-breakpoint

-- Metering functions are for the service role only.
revoke execute on function public.debit_usage(uuid, uuid, text, bigint, bigint, boolean, text, text, jsonb) from public;
--> statement-breakpoint
revoke execute on function public.refund_usage(uuid) from public;
--> statement-breakpoint
do $do$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.debit_usage(uuid, uuid, text, bigint, bigint, boolean, text, text, jsonb) to service_role';
    execute 'grant execute on function public.refund_usage(uuid) to service_role';
  end if;
end $do$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Signup provisioning: profile + personal workspace + owner membership +
-- free-tier subscription row, in one transaction with the auth insert.
-- Workspaces exist from day one (DECISIONS #4); Free/Pro users never notice.
-- ---------------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute $fn$
      create or replace function public.handle_new_user() returns trigger
      language plpgsql security definer
      set search_path = public
      as $body$
      declare
        v_workspace_id uuid;
        v_name text;
      begin
        v_name := coalesce(
          nullif(new.raw_user_meta_data ->> 'full_name', ''),
          nullif(new.raw_user_meta_data ->> 'name', ''),
          split_part(coalesce(new.email, 'user'), '@', 1)
        );

        insert into profiles (user_id, name, avatar_url)
        values (new.id, v_name, new.raw_user_meta_data ->> 'avatar_url')
        on conflict (user_id) do nothing;

        insert into workspaces (name, slug, owner_id)
        values (
          'Personal',
          'ws-' || substr(replace(new.id::text, '-', ''), 1, 12),
          new.id
        )
        returning id into v_workspace_id;

        insert into workspace_members (workspace_id, user_id, role)
        values (v_workspace_id, new.id, 'owner');

        insert into subscriptions (workspace_id, tier, status)
        values (v_workspace_id, 'free', 'active');

        return new;
      end;
      $body$;
    $fn$;

    if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
      execute 'create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_user()';
    end if;
  end if;
end $do$;

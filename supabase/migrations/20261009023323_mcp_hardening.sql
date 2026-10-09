-- Step 7b: remote MCP server support.
--
-- 1. mcp_requests: a log of connector requests (also used for rate limiting). Your rows only (RLS).
-- 2. Connector tokens (OAuth tokens carry a client_id claim; your own app session does not) get a
--    narrower set of powers than you do. RESTRICTIVE policies are ANDed with the existing ones, so a
--    connector can read all of your data and add workouts, sets, cardio and check-ins, but it can never
--    delete anything, change your plan, settings or reviews, or delete your account.
-- 3. The account / plan functions refuse connector tokens outright.

create table public.mcp_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id   text,
  method      text not null check (length(method) <= 60),
  tool        text check (length(tool) <= 60),
  ok          boolean not null,
  status      smallint not null,
  ms          integer not null check (ms >= 0),
  created_at  timestamptz not null default now()
);
create index mcp_requests_user_time on public.mcp_requests (user_id, created_at desc);

alter table public.mcp_requests enable row level security;
create policy mcp_requests_own on public.mcp_requests
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.mcp_requests from anon, public;
grant select, insert, delete on public.mcp_requests to authenticated;

-- ---------------------------------------------------------------- connectors cannot delete anything
do $$
declare t text;
begin
  foreach t in array array[
    'sets', 'workouts', 'cardio_entries', 'checkins', 'reviews', 'schedule_overrides',
    'program_state', 'user_exercise_settings', 'program_templates', 'template_days', 'template_exercises'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using ((auth.jwt() ->> ''client_id'') is null)',
      t || '_no_connector_delete', t);
  end loop;

  -- ...and cannot create or change your plan, settings, schedule or reviews.
  foreach t in array array[
    'reviews', 'schedule_overrides', 'program_state', 'user_exercise_settings',
    'program_templates', 'template_days', 'template_exercises'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated with check ((auth.jwt() ->> ''client_id'') is null)',
      t || '_no_connector_insert', t);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using ((auth.jwt() ->> ''client_id'') is null) with check ((auth.jwt() ->> ''client_id'') is null)',
      t || '_no_connector_update', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- functions refuse connector tokens
create or replace function public.clone_template(p_plan_type text) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tid uuid;
  src uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (auth.jwt() ->> 'client_id') is not null then raise exception 'not allowed for connectors'; end if;

  select id into tid from public.program_templates where user_id = uid and plan_type = p_plan_type;
  if tid is not null then return tid; end if;

  select id into src from public.program_templates where user_id is null and plan_type = p_plan_type;
  if src is null then raise exception 'unknown plan type'; end if;

  insert into public.program_templates (user_id, plan_type, name)
  select uid, plan_type, name from public.program_templates where id = src
  returning id into tid;

  insert into public.template_days
    (template_id, weekday, short_name, full_name, is_light, cardio_name, cardio_label, cardio_minutes)
  select tid, weekday, short_name, full_name, is_light, cardio_name, cardio_label, cardio_minutes
  from public.template_days where template_id = src;

  insert into public.template_exercises
    (template_id, weekday, position, exercise_slug, sets, rep_lo, rep_hi)
  select tid, weekday, position, exercise_slug, sets, rep_lo, rep_hi
  from public.template_exercises where template_id = src;

  return tid;
end $$;

create or replace function public.start_program(p_plan_type text, p_start_date date) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (auth.jwt() ->> 'client_id') is not null then raise exception 'not allowed for connectors'; end if;
  perform public.clone_template(p_plan_type);
  insert into public.program_state (user_id, start_date, plan_type)
  values (auth.uid(), p_start_date, p_plan_type)
  on conflict (user_id) do update set plan_type = excluded.plan_type, start_date = excluded.start_date;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (auth.jwt() ->> 'client_id') is not null then raise exception 'not allowed for connectors'; end if;
  delete from auth.users where id = auth.uid();
end $$;

create or replace function public.replace_day_exercises(p_template uuid, p_weekday smallint, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  r jsonb;
  i int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (auth.jwt() ->> 'client_id') is not null then raise exception 'not allowed for connectors'; end if;
  if not exists (select 1 from public.program_templates where id = p_template and user_id = auth.uid()) then
    raise exception 'not your plan';
  end if;
  if not exists (select 1 from public.template_days where template_id = p_template and weekday = p_weekday) then
    raise exception 'unknown day';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 8 then
    raise exception 'bad exercise list';
  end if;

  delete from public.template_exercises where template_id = p_template and weekday = p_weekday;
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    insert into public.template_exercises (template_id, weekday, position, exercise_slug, sets, rep_lo, rep_hi)
    values (p_template, p_weekday, i, r->>'slug', (r->>'sets')::smallint, (r->>'rep_lo')::smallint, (r->>'rep_hi')::smallint);
  end loop;
end $$;

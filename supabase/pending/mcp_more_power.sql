-- NOT APPLIED. Proposed by the owner ("give the connector more power") but blocked by the security check, so it needs
-- an explicit yes before anyone runs it. It would let the Claude connector, which today can only read and add/correct
-- data, also: delete logged sets / workouts / cardio / check-ins, edit the plan's exercises, change per-exercise
-- settings and the weekly schedule, and change alert / bodyweight / deload settings.
-- Still refused for connectors: deleting the account, restarting the programme, switching plan type, reviews,
-- creating or deleting plans / days, and changing program_state's start_date / plan_type (trigger below).
--
-- To apply: review it, then run as a normal migration (Supabase MCP apply_migration or the SQL editor).

do $$
declare t text;
begin
  foreach t in array array['sets','workouts','cardio_entries','checkins','schedule_overrides','template_exercises'] loop
    execute format('drop policy if exists %I on public.%I', t || '_no_connector_delete', t);
  end loop;
  foreach t in array array['schedule_overrides','user_exercise_settings','template_exercises'] loop
    execute format('drop policy if exists %I on public.%I', t || '_no_connector_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_no_connector_update', t);
  end loop;
  drop policy if exists program_state_no_connector_update on public.program_state;
end $$;

create or replace function public.program_state_connector_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (auth.jwt() ->> 'client_id') is not null then
    if new.user_id is distinct from old.user_id or new.start_date is distinct from old.start_date or new.plan_type is distinct from old.plan_type then
      raise exception 'not allowed for connectors';
    end if;
  end if;
  return new;
end $$;
create trigger program_state_connector_guard before update on public.program_state
  for each row execute function public.program_state_connector_guard();

-- replace_day_exercises (see 20261009023323_mcp_hardening.sql) must also drop its client_id check for plan editing.

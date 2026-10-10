-- APPLIED 2026-10-10 on the owner's explicit instruction ("Unlock those powers"). Lets the Claude connector, which today can only read and add/correct
-- data, also: delete logged sets / workouts / cardio / check-ins, edit the plan's exercises, change per-exercise
-- settings and the weekly schedule, and change alert / bodyweight / deload settings.
-- Still refused for connectors: deleting the account, restarting the programme, switching plan type, reviews,
-- creating or deleting plans / days, and changing program_state's start_date / plan_type (trigger below).
--

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

create or replace function public.replace_day_exercises(p_template uuid, p_weekday smallint, p_rows jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  r jsonb;
  i int := 0;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
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

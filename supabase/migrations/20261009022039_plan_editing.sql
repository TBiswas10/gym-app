-- Step 7: plan editing. Replaces one day's exercise list atomically (all or nothing) for the caller's own plan.
-- Runs as the caller, so row-level security applies on top of the checks here.

create function public.replace_day_exercises(p_template uuid, p_weekday smallint, p_rows jsonb) returns void
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

revoke all on function public.replace_day_exercises(uuid, smallint, jsonb) from public, anon;
grant execute on function public.replace_day_exercises(uuid, smallint, jsonb) to authenticated;

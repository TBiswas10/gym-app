-- Step 2c: small server-side helpers. clone_template and start_program run as the caller (RLS applies).
-- delete_my_account is the only SECURITY DEFINER function: it can only ever delete the caller's own account.

-- Copy a built-in template into the caller's own editable copy (once). Returns the template id.
create function public.clone_template(p_plan_type text) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tid uuid;
  src uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;

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

-- First run, restart, or plan switch: sets the plan type and start date and makes sure the user has their copy.
create function public.start_program(p_plan_type text, p_start_date date) returns void
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform public.clone_template(p_plan_type);
  insert into public.program_state (user_id, start_date, plan_type)
  values (auth.uid(), p_start_date, p_plan_type)
  on conflict (user_id) do update set plan_type = excluded.plan_type, start_date = excluded.start_date;
end $$;

-- Account deletion: removes the caller's auth user; every table above cascades from it.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.clone_template(text), public.start_program(text, date), public.delete_my_account()
  from public, anon;
grant execute on function public.clone_template(text), public.start_program(text, date), public.delete_my_account()
  to authenticated;

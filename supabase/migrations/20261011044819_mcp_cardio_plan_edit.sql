-- Owner asked (2026-10-11) for Claude to be able to change a day's cardio (machine text, label, minutes) in the plan.
-- Connectors may update template_days, but ONLY those three columns (guard trigger); names, light flag, ids stay app-only.
drop policy if exists template_days_no_connector_update on public.template_days;

create or replace function public.template_days_connector_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (auth.jwt() ->> 'client_id') is not null then
    if new.template_id is distinct from old.template_id or new.weekday is distinct from old.weekday
       or new.short_name is distinct from old.short_name or new.full_name is distinct from old.full_name
       or new.is_light is distinct from old.is_light then
      raise exception 'not allowed for connectors';
    end if;
    if new.cardio_minutes < 5 or new.cardio_minutes > 60 or length(new.cardio_name) not between 2 and 60 or length(new.cardio_label) not between 1 and 30 then
      raise exception 'bad cardio values';
    end if;
  end if;
  return new;
end $$;
create trigger template_days_connector_guard before update on public.template_days
  for each row execute function public.template_days_connector_guard();

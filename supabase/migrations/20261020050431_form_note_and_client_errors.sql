-- A personal form cue per exercise (what you personally keep getting wrong), and a log of errors your phone hits
-- so they can be read back (by you, or by Claude through the connector) instead of guessed at.
alter table public.user_exercise_settings
  add column form_note text check (form_note is null or length(form_note) between 2 and 140);

create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  message text not null check (length(message) between 1 and 300),
  stack text check (stack is null or length(stack) <= 1500),
  path text not null default '' check (length(path) <= 120),
  build text not null default '' check (length(build) <= 60),
  agent text not null default '' check (length(agent) <= 160)
);
create index client_errors_user_time on public.client_errors (user_id, created_at desc);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, public;
create policy client_errors_select on public.client_errors for select to authenticated using (user_id = (select auth.uid()));
create policy client_errors_insert on public.client_errors for insert to authenticated with check (user_id = (select auth.uid()));
create policy client_errors_delete on public.client_errors for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.client_errors to authenticated;

-- Connectors may read the log (so Claude can diagnose) but not write or delete it.
create policy client_errors_no_connector_insert on public.client_errors as restrictive for insert to authenticated with check ((auth.jwt() ->> 'client_id') is null);
create policy client_errors_no_connector_delete on public.client_errors as restrictive for delete to authenticated using ((auth.jwt() ->> 'client_id') is null);

-- A connector may set the form note like the other per-exercise settings (user_exercise_settings is already open to it).

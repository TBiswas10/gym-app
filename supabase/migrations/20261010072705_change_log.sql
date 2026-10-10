-- A trail of edits and deletes (made by Claude or in the app) with enough of the "before" to undo them.
-- Rows are append-only: owners can read, add, and mark a row undone; nobody can delete or rewrite history.
create table public.change_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  source      text not null check (source in ('app', 'claude')),
  action      text not null check (length(action) <= 40),
  summary     text not null check (length(summary) <= 400),
  before      jsonb,
  after       jsonb,
  undoable    boolean not null default false,
  undone_at   timestamptz
);
create index change_log_user_time on public.change_log (user_id, created_at desc);

alter table public.change_log enable row level security;
create policy change_log_select on public.change_log for select to authenticated using (user_id = (select auth.uid()));
create policy change_log_insert on public.change_log for insert to authenticated with check (user_id = (select auth.uid()));
create policy change_log_mark_undone on public.change_log for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.change_log from anon, public;
grant select, insert, update on public.change_log to authenticated;

-- only undone_at may change on an existing row
create or replace function public.change_log_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
     or new.source is distinct from old.source or new.action is distinct from old.action or new.summary is distinct from old.summary
     or new.before is distinct from old.before or new.after is distinct from old.after or new.undoable is distinct from old.undoable then
    raise exception 'change log entries cannot be rewritten';
  end if;
  return new;
end $$;
create trigger change_log_guard before update on public.change_log for each row execute function public.change_log_guard();

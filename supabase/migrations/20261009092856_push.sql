-- Step 8: web push for the rest-timer alert.
-- push_subscriptions: the phone's push address (one per installed app). rest_timers: one row per rest the phone
-- asks to be told about; the server sends the notification when it ends, unless the row was cancelled.
-- Your rows only (RLS). Connector tokens (OAuth clients) cannot touch either table.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (length(endpoint) <= 600 and endpoint like 'https://%'),
  p256dh      text not null check (length(p256dh) <= 200),
  auth        text not null check (length(auth) <= 100),
  user_agent  text check (length(user_agent) <= 200),
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

create table public.rest_timers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ends_at     timestamptz not null,
  title       text not null check (length(title) <= 100),
  body        text not null default '' check (length(body) <= 160),
  status      text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  created_at  timestamptz not null default now()
);
create index rest_timers_user_status on public.rest_timers (user_id, status);

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions', 'rest_timers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((auth.jwt() ->> ''client_id'') is null) with check ((auth.jwt() ->> ''client_id'') is null)',
      t || '_no_connector', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

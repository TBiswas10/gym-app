-- v2: answers to plan nudges, weekly coach reviews, goals, and read-only share links.

create table public.nudge_responses (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (length(key) between 3 and 80),
  response text not null check (response in ('accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  headline text not null check (length(headline) between 3 and 200),
  wins text[] not null default '{}',
  watch text[] not null default '{}',
  next_week text[] not null default '{}',
  source text not null default 'claude' check (source in ('claude', 'app')),
  created_at timestamptz not null default now(),
  unique (user_id, week_start),
  check (cardinality(wins) <= 6 and cardinality(watch) <= 6 and cardinality(next_week) <= 6)
);
create index coach_reviews_user_week on public.coach_reviews (user_id, week_start desc);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_slug text not null references public.exercises (slug),
  target numeric(7, 1) not null check (target > 0),
  start_value numeric(7, 1) not null default 0 check (start_value >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_slug)
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null unique check (length(token) >= 24),
  label text not null default '' check (length(label) <= 40),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

-- row level security: only the owner
do $$
declare t text;
begin
  foreach t in array array['nudge_responses', 'coach_reviews', 'goals', 'share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;
create policy coach_reviews_delete on public.coach_reviews for delete to authenticated using (user_id = (select auth.uid()));
create policy goals_delete on public.goals for delete to authenticated using (user_id = (select auth.uid()));
create policy nudge_responses_delete on public.nudge_responses for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.nudge_responses, public.coach_reviews, public.goals to authenticated;
grant select, insert, update on public.share_links to authenticated;

-- Claude connectors may write coach reviews and goals (that is the point of them). They cannot touch nudge answers,
-- and cannot even read share links (the link is the secret).
do $$
declare cmd text;
begin
  foreach cmd in array array['insert', 'update', 'delete'] loop
    execute format('create policy %I on public.nudge_responses as restrictive for %s to authenticated %s',
      'nudge_responses_no_connector_' || cmd, cmd,
      case cmd when 'insert' then 'with check ((auth.jwt() ->> ''client_id'') is null)' else 'using ((auth.jwt() ->> ''client_id'') is null)' end);
  end loop;
  foreach cmd in array array['select', 'insert', 'update'] loop
    execute format('create policy %I on public.share_links as restrictive for %s to authenticated %s',
      'share_links_no_connector_' || cmd, cmd,
      case cmd when 'insert' then 'with check ((auth.jwt() ->> ''client_id'') is null)' else 'using ((auth.jwt() ->> ''client_id'') is null)' end);
  end loop;
end $$;

-- The public weekly summary: whoever holds a live token can read ONLY these aggregates (no notes, soreness, bodyweight,
-- weights or email). Expired or revoked tokens return null.
create or replace function public.share_summary(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.share_links%rowtype;
  v_today date := (now() at time zone 'Australia/Sydney')::date;
  v_wk date := date_trunc('week', (now() at time zone 'Australia/Sydney'))::date;
  v_start date;
begin
  select * into l from public.share_links where token = p_token and revoked_at is null and expires_at > now();
  if not found then return null; end if;
  select ps.start_date into v_start from public.program_state ps where ps.user_id = l.user_id;
  return jsonb_build_object(
    'label', l.label,
    'week_start', v_wk,
    'expires_at', l.expires_at,
    'programme_week', case when v_start is null then null else least(12, greatest(1, ((v_today - v_start) / 7) + 1)) end,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('date', w.planned_date, 'name', w.day_name) order by w.planned_date)
      from public.workouts w
      where w.user_id = l.user_id and w.status = 'completed' and not w.is_test and w.planned_date between v_wk and v_wk + 6), '[]'::jsonb),
    'sets', (
      select count(*) from public.sets s join public.workouts w on w.id = s.workout_id and w.user_id = s.user_id
      where w.user_id = l.user_id and w.status = 'completed' and not w.is_test and w.planned_date between v_wk and v_wk + 6),
    'cardio_minutes', coalesce((
      select sum(c.minutes) from public.cardio_entries c
      where c.user_id = l.user_id and c.logged_on between v_wk and v_wk + 6 and c.kind not in ('walk', 'stretch')), 0),
    'total_sessions', (
      select count(*) from public.workouts w where w.user_id = l.user_id and w.status = 'completed' and not w.is_test)
  );
end $$;
revoke all on function public.share_summary(text) from public;
grant execute on function public.share_summary(text) to anon, authenticated;

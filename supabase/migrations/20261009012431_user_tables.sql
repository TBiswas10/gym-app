-- Step 2b: user-owned tables. Every table has RLS: a signed-in user can only touch rows where user_id = their id.
-- Timestamps are timestamptz (UTC). "Date" columns hold the Australia/Sydney local calendar date.
-- Weights are kilograms. Deleting the auth user cascades and removes all of their data.

-- ---------------------------------------------------------------- program_state (one row per user)
create table public.program_state (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  start_date        date not null,                                  -- Sydney date of day 1 (week 1 starts here)
  plan_type         text not null check (plan_type in ('5day', '3day')),
  deload_weeks      smallint[] not null default '{}',               -- weeks (1-12) run as deload (half the sets)
  rest_alerts       boolean not null default true,                  -- "Notify me when rest ends"
  track_bodyweight  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (deload_weeks <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[])
);

-- Current week is derived from start_date and the Sydney date, so it can never drift out of sync.
create view public.program_state_view with (security_invoker = true) as
select
  ps.*,
  least(12, ((now() at time zone 'Australia/Sydney')::date - ps.start_date) / 7 + 1)::smallint as current_week,
  ((now() at time zone 'Australia/Sydney')::date - ps.start_date) >= 84                          as programme_complete
from public.program_state ps;

-- ---------------------------------------------------------------- per-exercise settings
create table public.user_exercise_settings (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_slug    text not null references public.exercises (slug),
  increment_kg     numeric(4,1) check (increment_kg > 0),           -- null = use the exercise default
  start_weight_kg  numeric(5,1) check (start_weight_kg >= 0),       -- from "Find your weight"
  notes            text,                                            -- machine notes (seat height, pad position...)
  primary key (user_id, exercise_slug)
);

-- ---------------------------------------------------------------- skipped / moved / light days
create table public.schedule_overrides (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  planned_date   date not null,                                     -- the day the session was planned for
  action         text not null check (action in ('skipped', 'moved', 'light')),
  moved_to_date  date,
  created_at     timestamptz not null default now(),
  unique (user_id, planned_date),
  check ((action = 'moved') = (moved_to_date is not null))
);

-- ---------------------------------------------------------------- workouts
create table public.workouts (
  id                  uuid primary key default gen_random_uuid(),   -- the app may supply its own id (offline queue)
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  planned_date        date not null,
  week                smallint not null check (week between 1 and 12),
  plan_type           text not null check (plan_type in ('5day', '3day')),
  weekday             smallint not null check (weekday between 1 and 7),
  day_name            text not null,
  is_light            boolean not null default false,
  status              text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  skipped_exercises   text[] not null default '{}',
  notes               text,
  created_at          timestamptz not null default now(),
  unique (id, user_id)                                              -- lets child rows prove they share the owner
);
create index workouts_user_date on public.workouts (user_id, planned_date desc);
create unique index workouts_one_active on public.workouts (user_id) where status = 'in_progress';

-- ---------------------------------------------------------------- sets
create table public.sets (
  id             uuid primary key default gen_random_uuid(),        -- client-generated ids make offline retries idempotent
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id     uuid not null,
  exercise_slug  text not null references public.exercises (slug),
  position       smallint not null default 1,                       -- order of the exercise in the session
  set_number     smallint not null check (set_number between 1 and 2),
  variant        text,                                              -- backup exercise name when swapped
  weight_kg      numeric(6,2) check (weight_kg >= 0 and weight_kg <= 400),
  reps           smallint check (reps between 0 and 100),
  seconds        smallint check (seconds between 0 and 3600),
  logged_at      timestamptz not null default now(),
  source         text not null default 'app' check (source in ('app', 'chat', 'mcp')),
  check (reps is not null or seconds is not null),
  unique (workout_id, exercise_slug, set_number),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);
create index sets_last_time on public.sets (user_id, exercise_slug, logged_at desc);

-- ---------------------------------------------------------------- cardio_entries (also rest-day walk / stretch)
create table public.cardio_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id  uuid,
  kind        text not null check (kind in ('bike', 'treadmill', 'stair', 'rower', 'xtrainer', 'walk', 'stretch')),
  minutes     smallint not null check (minutes between 1 and 180),
  params      jsonb not null default '{}'::jsonb,                    -- resistance, rpm, speed, incline, level, damper, spm
  feel        text check (feel in ('easy', 'moderate', 'hard')),
  logged_on   date not null,
  logged_at   timestamptz not null default now(),
  source      text not null default 'app' check (source in ('app', 'chat', 'mcp')),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);
create index cardio_user_date on public.cardio_entries (user_id, logged_on desc);

-- ---------------------------------------------------------------- checkins (soreness / energy after a session, weekly bodyweight)
create table public.checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id     uuid,
  checked_on     date not null,
  soreness       smallint check (soreness between 1 and 5),
  energy         smallint check (energy between 1 and 5),
  notes          text,
  bodyweight_kg  numeric(5,1) check (bodyweight_kg > 0 and bodyweight_kg < 500),
  created_at     timestamptz not null default now(),
  check (soreness is not null or energy is not null or bodyweight_kg is not null or notes is not null),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete set null (workout_id)
);
create unique index checkins_one_per_workout on public.checkins (workout_id) where workout_id is not null;
create index checkins_user_date on public.checkins (user_id, checked_on desc);

-- ---------------------------------------------------------------- reviews (weeks 4, 8, 12)
create table public.reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week             smallint not null check (week in (4, 8, 12)),
  recommendation   text not null check (recommendation in ('build', 'hold', 'deload')),
  chosen           text check (chosen in ('build', 'hold', 'deload')),   -- what the user picked (may differ)
  applied_at       timestamptz,
  summary          jsonb not null default '{}'::jsonb,                   -- sessions, soreness, energy, strength rows
  created_at       timestamptz not null default now(),
  unique (user_id, week)
);

-- ---------------------------------------------------------------- keep updated_at honest
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger program_state_touch before update on public.program_state
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS: own rows only, on every table
do $$
declare t text;
begin
  foreach t in array array[
    'program_state', 'user_exercise_settings', 'schedule_overrides',
    'workouts', 'sets', 'cardio_entries', 'checkins', 'reviews'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.program_state_view from anon, public;
grant select on public.program_state_view to authenticated;

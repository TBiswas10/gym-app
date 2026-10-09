-- Step 2a: reference tables (exercises, programme templates).
-- Exercises are global and read-only for app users. Templates exist as built-in defaults (user_id is null)
-- and as the signed-in user's own editable copies (user_id = auth.uid()).
-- All timestamps are timestamptz (stored in UTC). Weights are kilograms.

-- ---------------------------------------------------------------- exercises
create table public.exercises (
  slug                  text primary key,
  name                  text not null,
  category              text not null check (category in ('upper', 'lower', 'core')),
  muscle_group          text not null,
  kit                   text not null,
  kind                  text not null check (kind in ('weight', 'timed', 'bodyweight')),
  muscles               text[] not null,
  rep_lo                smallint not null check (rep_lo > 0),
  rep_hi                smallint not null check (rep_hi >= rep_lo),
  weight_step_kg        numeric(4,1) not null check (weight_step_kg > 0),      -- rounding grid (stack / dumbbell step)
  default_increment_kg  numeric(4,1) not null check (default_increment_kg > 0), -- progression jump (seconds for timed)
  setup                 text[] not null default '{}',
  cues                  text[] not null default '{}',
  mistakes              text[] not null default '{}',
  default_notes         text not null default '',
  backup_name           text,
  sort_order            smallint not null
);
comment on table public.exercises is 'The 17 library exercises with form guides. Global, read-only to users.';

alter table public.exercises enable row level security;
create policy exercises_read on public.exercises
  for select to authenticated using (true);

-- ---------------------------------------------------------------- program_templates
create table public.program_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,  -- null = built-in default
  plan_type   text not null check (plan_type in ('5day', '3day')),
  name        text not null,
  created_at  timestamptz not null default now()
);
-- one built-in and at most one personal copy per plan type
create unique index program_templates_owner_plan
  on public.program_templates (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), plan_type);

-- ---------------------------------------------------------------- template_days (lifting days only; other weekdays are rest)
create table public.template_days (
  template_id     uuid not null references public.program_templates (id) on delete cascade,
  weekday         smallint not null check (weekday between 1 and 7),  -- 1 = Monday ... 7 = Sunday
  short_name      text not null,        -- "Push"
  full_name       text not null,        -- "Legs + Core"
  is_light        boolean not null default false,  -- Thursday "Upper (light)"
  cardio_name     text not null,
  cardio_label    text not null,
  cardio_minutes  smallint not null check (cardio_minutes between 0 and 60),
  primary key (template_id, weekday)
);

-- ---------------------------------------------------------------- template_exercises
create table public.template_exercises (
  template_id    uuid not null,
  weekday        smallint not null,
  position       smallint not null check (position > 0),
  exercise_slug  text not null references public.exercises (slug),
  sets           smallint not null default 2 check (sets between 1 and 2),  -- plan fact: 2 sets (1 on a deload)
  rep_lo         smallint not null check (rep_lo > 0),
  rep_hi         smallint not null check (rep_hi >= rep_lo),
  primary key (template_id, weekday, position),
  foreign key (template_id, weekday) references public.template_days (template_id, weekday) on delete cascade
);
create index template_exercises_slug on public.template_exercises (exercise_slug);

-- ---------------------------------------------------------------- RLS: read built-ins + own; write own only
alter table public.program_templates  enable row level security;
alter table public.template_days      enable row level security;
alter table public.template_exercises enable row level security;

create policy templates_read on public.program_templates
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy templates_write on public.program_templates
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy days_read on public.template_days
  for select to authenticated using (exists (
    select 1 from public.program_templates t
    where t.id = template_id and (t.user_id is null or t.user_id = (select auth.uid()))));
create policy days_write on public.template_days
  for all to authenticated
  using (exists (select 1 from public.program_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.program_templates t where t.id = template_id and t.user_id = (select auth.uid())));

create policy tex_read on public.template_exercises
  for select to authenticated using (exists (
    select 1 from public.program_templates t
    where t.id = template_id and (t.user_id is null or t.user_id = (select auth.uid()))));
create policy tex_write on public.template_exercises
  for all to authenticated
  using (exists (select 1 from public.program_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.program_templates t where t.id = template_id and t.user_id = (select auth.uid())));

-- ---------------------------------------------------------------- grants: nothing for anon
revoke all on public.exercises, public.program_templates, public.template_days, public.template_exercises from anon, public;
grant select on public.exercises to authenticated;
grant select, insert, update, delete on public.program_templates, public.template_days, public.template_exercises to authenticated;

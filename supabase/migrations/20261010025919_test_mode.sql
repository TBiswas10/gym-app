-- Test mode: lets the owner start any day's session to try the app. Test workouts are flagged and wiped when test mode ends.
alter table public.workouts add column is_test boolean not null default false;
alter table public.program_state add column test_mode boolean not null default false;
create index workouts_test on public.workouts (user_id) where is_test;

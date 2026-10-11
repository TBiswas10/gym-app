-- Your own substitute for an exercise (what the Swap button offers). Falls back to the built-in backup when null.
alter table public.user_exercise_settings
  add column backup_name text check (backup_name is null or length(backup_name) between 2 and 60);

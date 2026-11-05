alter table public.program_state add column if not exists goal_weight_kg numeric(5,1) check (goal_weight_kg is null or (goal_weight_kg >= 30 and goal_weight_kg <= 300));

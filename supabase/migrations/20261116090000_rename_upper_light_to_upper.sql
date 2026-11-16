-- Thursday is now just "Upper": the plan templates and the sessions already done. The is_light flag is unchanged.
update public.template_days set full_name = 'Upper' where full_name = 'Upper (light)';
update public.workouts set day_name = 'Upper' where day_name = 'Upper (light)';

-- Dumbbells in this gym go up in 1 kg steps (logged: 13, 15, 17, 18, 19, 20 kg incline; 6, 7, 8 kg hammer). The +/- button moves by weight_step_kg; default_increment_kg (the progression jump) is unchanged.
update public.exercises set weight_step_kg = 1 where weight_step_kg = 2;

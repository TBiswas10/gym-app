-- Seed data (idempotent: safe to run more than once). Reference data only; no user data.
-- Source: design handoff (exercise list, form guides, plan templates).

insert into public.exercises
  (slug, name, category, muscle_group, kit, kind, muscles, rep_lo, rep_hi, weight_step_kg, default_increment_kg,
   setup, cues, mistakes, default_notes, backup_name, sort_order)
values
  ('chest', 'Chest press', 'upper', 'Chest', 'Machine', 'weight', array['Chest', 'Shoulders', 'Triceps'], 8, 12, 2.5, 2.5, array['Adjust the seat so the handles line up with the middle of your chest.', 'Sit with your back flat against the pad and feet flat on the floor.', 'Grip the handles with wrists straight above your elbows.'], array['Push the handles away until your arms are almost straight.', 'Keep your shoulder blades pinched back and down.', 'Lower slowly, about 2 seconds, until you feel a light stretch.', 'Breathe out as you press.'], array['Locking your elbows hard at the top.', 'Lifting your back off the pad.', 'Letting the weight stack crash between reps.'], 'Seat 3 · handles at mid-chest', 'Dumbbell bench press', 1),
  ('incline', 'Incline dumbbell press', 'upper', 'Chest', 'Dumbbells', 'weight', array['Upper chest', 'Shoulders', 'Triceps'], 8, 12, 2, 2, array['Set the bench to a low incline, about 30 degrees.', 'Sit back with a dumbbell on each thigh, then kick them up to shoulder height.', 'Plant your feet and keep your head and back on the bench.'], array['Press up and slightly together until your arms are straight.', 'Lower until your elbows are just below the bench.', 'Keep your wrists stacked over your elbows.', 'Control the weight on the way down.'], array['Setting the bench too steep so it becomes a shoulder press.', 'Flaring elbows straight out to the sides.', 'Bouncing the dumbbells at the bottom.'], '', 'Push-up on bench', 2),
  ('shoulder', 'Shoulder press', 'upper', 'Shoulders', 'Machine', 'weight', array['Shoulders', 'Triceps', 'Upper chest'], 8, 12, 2.5, 2.5, array['Set the seat so the handles start at about shoulder height.', 'Sit tall with your back against the pad.', 'Grip the handles with your wrists over your elbows.'], array['Press straight up without shrugging.', 'Stop just short of locking your elbows.', 'Lower until your upper arms are about level with the floor.', 'Keep your ribs down and your core tight.'], array['Arching your lower back to push the weight up.', 'Shrugging your shoulders to your ears.', 'Dropping the handles quickly.'], 'Seat 5', 'Seated dumbbell press', 3),
  ('lateral', 'Lateral raise', 'upper', 'Shoulders', 'Dumbbells', 'weight', array['Side shoulders'], 8, 12, 1, 1, array['Stand tall with a light dumbbell in each hand at your sides.', 'Keep a soft bend in your elbows.', 'Brace your core and keep your feet hip-width apart.'], array['Lift your arms out to the sides up to shoulder height.', 'Lead with your elbows, not your hands.', 'Pause for 1 second at the top.', 'Lower slowly, about 3 seconds.'], array['Using momentum and swinging your body.', 'Lifting above shoulder height.', 'Going too heavy. Light and slow works best.'], '', 'Cable lateral raise', 4),
  ('triceps', 'Triceps pushdown', 'upper', 'Arms', 'Cable', 'weight', array['Triceps'], 8, 12, 2.5, 2.5, array['Attach a rope or bar to the high pulley.', 'Stand close with a slight lean forward and your elbows tucked at your sides.', 'Grip the attachment with your forearms at about 90 degrees.'], array['Push down until your arms are straight.', 'Keep your elbows pinned to your sides.', 'Squeeze your triceps at the bottom.', 'Let the handle rise slowly.'], array['Letting your elbows drift forward.', 'Leaning your whole body over the handle.', 'Using your shoulders to move the weight.'], 'Rope attachment', 'Overhead cable extension', 5),
  ('lat', 'Lat pulldown', 'upper', 'Back', 'Cable', 'weight', array['Lats', 'Upper back', 'Biceps'], 8, 12, 2.5, 2.5, array['Set the thigh pad so your knees are snug underneath.', 'Grip the bar a little wider than your shoulders.', 'Sit tall with a slight lean back, feet flat.'], array['Drive elbows down towards your back pockets.', 'Bring the bar to your upper chest.', 'Keep your chest up and shoulders down.', 'Let it rise slowly, about 2 seconds.'], array['Leaning far back and swinging the weight.', 'Pulling the bar behind your neck.', 'Shrugging your shoulders up to your ears.'], 'Thigh pad notch 5 · wide grip bar', 'Single-arm cable pulldown', 6),
  ('row', 'Seated row', 'upper', 'Back', 'Cable', 'weight', array['Mid back', 'Lats', 'Biceps'], 8, 12, 2.5, 2.5, array['Sit with your feet on the plates and knees slightly bent.', 'Grab the handle with your arms straight and your back tall.', 'Set your chest against the pad if there is one.'], array['Pull the handle to your belly button.', 'Squeeze your shoulder blades together at the end.', 'Keep your chest tall, with no rocking.', 'Return slowly until your arms are straight.'], array['Rocking your torso back and forth.', 'Shrugging your shoulders up.', 'Letting the weight yank your shoulders forward.'], '', 'Chest-supported dumbbell row', 7),
  ('reardelt', 'Rear delt fly', 'upper', 'Shoulders', 'Machine', 'weight', array['Rear shoulders', 'Upper back'], 8, 12, 2.5, 2.5, array['Face the pad and set the seat so the handles are at shoulder height.', 'Sit tall with your chest against the pad.', 'Hold the handles with a soft bend in your elbows.'], array['Open your arms out to the sides in a wide arc.', 'Squeeze your shoulder blades at the back.', 'Keep your shoulders down away from your ears.', 'Return slowly.'], array['Pulling with your biceps and bending your arms a lot.', 'Shrugging your shoulders.', 'Swinging the weight.'], '', 'Reverse dumbbell fly', 8),
  ('hammer', 'Hammer curl', 'upper', 'Arms', 'Dumbbells', 'weight', array['Biceps', 'Forearms'], 8, 12, 1, 1, array['Stand tall with a dumbbell in each hand, palms facing your thighs.', 'Keep your elbows tucked at your sides.', 'Stand with your feet hip-width apart.'], array['Curl up with your thumbs facing the ceiling.', 'Keep your elbows still.', 'Squeeze at the top for 1 second.', 'Lower over about 2 seconds.'], array['Swinging your body to lift the weights.', 'Letting your elbows drift forward.', 'Dropping the weights quickly.'], '', 'Cable rope curl', 9),
  ('cablecurl', 'Cable curl', 'upper', 'Arms', 'Cable', 'weight', array['Biceps'], 8, 12, 2.5, 2.5, array['Attach a straight or EZ bar to the low pulley.', 'Stand close to the stack with your elbows at your sides.', 'Grip the bar with your palms facing up.'], array['Curl the bar up towards your shoulders.', 'Keep your elbows pinned to your sides.', 'Squeeze at the top.', 'Lower slowly to a full stretch.'], array['Leaning back to swing the bar up.', 'Letting your elbows move forward.', 'Rushing the lowering part.'], '', 'Dumbbell curl', 10),
  ('legpress', 'Leg press', 'lower', 'Legs', 'Machine', 'weight', array['Quads', 'Glutes', 'Hamstrings'], 8, 12, 5, 5, array['Sit with your back and hips flat against the pad.', 'Place your feet shoulder-width apart in the middle of the plate.', 'Release the safety handles and hold the side grips.'], array['Push through your whole foot.', 'Lower until your knees are at about 90 degrees.', 'Stop just short of locking your knees.', 'Keep your hips and lower back on the pad.'], array['Letting your lower back lift off the pad at the bottom.', 'Locking your knees hard at the top.', 'Letting your knees cave inwards.'], 'Seat 4 · feet mid-plate', 'Hack squat machine', 11),
  ('legcurl', 'Lying leg curl', 'lower', 'Legs', 'Machine', 'weight', array['Hamstrings'], 10, 12, 2.5, 2.5, array['Lie face down with the pad just above your heels.', 'Line your knees up with the machine''s pivot.', 'Grip the handles and keep your hips pressed down.'], array['Curl your heels towards your glutes.', 'Squeeze your hamstrings at the top.', 'Return slowly, about 2 to 3 seconds.', 'Keep your hips pressed into the pad.'], array['Lifting your hips off the pad.', 'Using momentum to start the rep.', 'Letting the weight stack slam at the bottom.'], 'Pad just above ankles', 'Dumbbell Romanian deadlift', 12),
  ('legext', 'Leg extension', 'lower', 'Legs', 'Machine', 'weight', array['Quads'], 8, 12, 2.5, 5, array['Adjust the back pad so your knees line up with the machine''s pivot.', 'Set the ankle pad just above your feet.', 'Hold the side handles and sit tall.'], array['Straighten your legs until they are almost level.', 'Squeeze your thighs at the top for 1 second.', 'Lower slowly over about 3 seconds.', 'Keep your hips on the seat.'], array['Swinging the weight up with momentum.', 'Locking your knees hard.', 'Lifting your hips off the seat.'], '', 'Sit-to-stand squat', 13),
  ('calf', 'Calf raise', 'lower', 'Legs', 'Machine', 'weight', array['Calves', 'Ankles'], 12, 15, 5, 5, array['Place the balls of your feet on the platform with heels hanging off.', 'Adjust the pad so it sits snugly on your shoulders or thighs, depending on the machine.', 'Keep your knees soft, not locked.'], array['Lower your heels until you feel a stretch.', 'Press up onto your toes as high as you can.', 'Pause for 1 second at the top.', 'Move slowly with no bouncing.'], array['Bouncing at the bottom of the rep.', 'Cutting the range short.', 'Bending your knees to cheat the lift.'], 'Platform position 2 · pad on thighs', 'Single-leg calf raise', 14),
  ('glute', 'Glute bridge / hip thrust', 'lower', 'Legs', 'Machine', 'weight', array['Glutes', 'Hamstrings', 'Core'], 10, 12, 5, 5, array['Sit with your upper back against the pad and the belt or pad across your hips.', 'Set the foot plate so your shins are upright at the top.', 'Start light and brace your core before the first rep.'], array['Push through your heels.', 'Squeeze your glutes at the top and pause for 1 second.', 'Keep your ribs down and chin tucked.', 'Lower slowly, about 2 to 3 seconds.'], array['Arching your lower back at the top.', 'Pushing through your toes.', 'Bouncing the weight to rush the reps.'], 'Pad across hips · foot plate 2', 'Floor glute bridge', 15),
  ('back', 'Back extension', 'lower', 'Back', 'Bench', 'bodyweight', array['Lower back', 'Glutes', 'Hamstrings'], 10, 12, 2.5, 5, array['Set the pad just below your hip bones so you can bend at the hips.', 'Hook your heels under the rollers with feet flat on the plate.', 'Cross your arms over your chest.'], array['Hinge at the hips and keep your spine long.', 'Lower until you feel a stretch in your hamstrings.', 'Rise until your body is in a straight line, then stop.', 'Squeeze your glutes and move slowly.'], array['Over-arching at the top of the rep.', 'Swinging up with momentum.', 'Dropping down fast instead of lowering with control.'], 'Pad just below hip bones · roller 3', 'Superman hold', 16),
  ('plank', 'Plank', 'core', 'Core', 'Bodyweight', 'timed', array['Core', 'Obliques', 'Shoulders'], 20, 40, 5, 5, array['Place forearms on the mat with elbows under your shoulders.', 'Extend your legs behind you, toes on the floor, feet hip-width apart.', 'Look at the floor just ahead of your hands. No machine needed.'], array['Make one straight line from head to heels.', 'Squeeze your glutes and tighten your tummy.', 'Breathe steadily. Don’t hold your breath.', 'End the set when your hips start to sag.'], array['Hips sagging towards the floor.', 'Hips piking up in the air.', 'Holding your breath or looking forward.'], 'On the mat by the cable stack', 'Knee plank', 17)
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, muscle_group = excluded.muscle_group, kit = excluded.kit,
  kind = excluded.kind, muscles = excluded.muscles, rep_lo = excluded.rep_lo, rep_hi = excluded.rep_hi,
  weight_step_kg = excluded.weight_step_kg, default_increment_kg = excluded.default_increment_kg,
  setup = excluded.setup, cues = excluded.cues, mistakes = excluded.mistakes,
  default_notes = excluded.default_notes, backup_name = excluded.backup_name, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------- built-in programme templates (user_id null)
-- Fixed ids so the seed can be re-run safely.
insert into public.program_templates (id, user_id, plan_type, name) values
  ('00000000-0000-4000-8000-000000000005', null, '5day', '5-day split'),
  ('00000000-0000-4000-8000-000000000003', null, '3day', '3-day full body')
on conflict (id) do update set name = excluded.name;

-- 5-day split: Mon Push, Tue Pull, Wed Legs + Core, Thu Upper (light), Sat Lower + Core + Cardio. Fri and Sun rest.
insert into public.template_days (template_id, weekday, short_name, full_name, is_light, cardio_name, cardio_label, cardio_minutes) values
  ('00000000-0000-4000-8000-000000000005', 1, 'Push',  'Push',                  false, 'Bike or cross-trainer',                         '10 min',   10),
  ('00000000-0000-4000-8000-000000000005', 2, 'Pull',  'Pull',                  false, 'Rower or bike',                                 '8–10 min',  9),
  ('00000000-0000-4000-8000-000000000005', 3, 'Legs',  'Legs + Core',           false, 'Easy treadmill walk',                           '10 min',   10),
  ('00000000-0000-4000-8000-000000000005', 4, 'Upper', 'Upper (light)',         true,  'Bike or treadmill',                             '10 min',   10),
  ('00000000-0000-4000-8000-000000000005', 6, 'Lower', 'Lower + Core + Cardio', false, 'Incline treadmill walk or stair machine',       '15 min',   15)
on conflict (template_id, weekday) do update set
  short_name = excluded.short_name, full_name = excluded.full_name, is_light = excluded.is_light,
  cardio_name = excluded.cardio_name, cardio_label = excluded.cardio_label, cardio_minutes = excluded.cardio_minutes;

-- 3-day full body: Mon, Wed, Sat.
insert into public.template_days (template_id, weekday, short_name, full_name, is_light, cardio_name, cardio_label, cardio_minutes) values
  ('00000000-0000-4000-8000-000000000003', 1, 'Full A', 'Full body A', false, 'Bike or cross-trainer',                    '10 min', 10),
  ('00000000-0000-4000-8000-000000000003', 3, 'Full B', 'Full body B', false, 'Easy treadmill walk',                      '10 min', 10),
  ('00000000-0000-4000-8000-000000000003', 6, 'Full C', 'Full body C', false, 'Incline treadmill walk or stair machine',  '15 min', 15)
on conflict (template_id, weekday) do update set
  short_name = excluded.short_name, full_name = excluded.full_name, is_light = excluded.is_light,
  cardio_name = excluded.cardio_name, cardio_label = excluded.cardio_label, cardio_minutes = excluded.cardio_minutes;

-- Exercises per day. Sets are always 2. Rep ranges: 8-12 unless noted (plank = seconds).
insert into public.template_exercises (template_id, weekday, position, exercise_slug, sets, rep_lo, rep_hi) values
  -- 5-day: Mon Push
  ('00000000-0000-4000-8000-000000000005', 1, 1, 'chest',     2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 1, 2, 'incline',   2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 1, 3, 'shoulder',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 1, 4, 'lateral',   2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 1, 5, 'triceps',   2, 8, 12),
  -- 5-day: Tue Pull
  ('00000000-0000-4000-8000-000000000005', 2, 1, 'lat',       2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 2, 2, 'row',       2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 2, 3, 'reardelt',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 2, 4, 'hammer',    2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 2, 5, 'cablecurl', 2, 8, 12),
  -- 5-day: Wed Legs + Core
  ('00000000-0000-4000-8000-000000000005', 3, 1, 'legpress',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 3, 2, 'legcurl',   2, 10, 12),
  ('00000000-0000-4000-8000-000000000005', 3, 3, 'legext',    2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 3, 4, 'calf',      2, 12, 15),
  ('00000000-0000-4000-8000-000000000005', 3, 5, 'plank',     2, 20, 40),
  -- 5-day: Thu Upper (light)
  ('00000000-0000-4000-8000-000000000005', 4, 1, 'chest',     2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 4, 2, 'lat',       2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 4, 3, 'shoulder',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 4, 4, 'row',       2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 4, 5, 'triceps',   2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 4, 6, 'cablecurl', 2, 8, 12),
  -- 5-day: Sat Lower + Core + Cardio
  ('00000000-0000-4000-8000-000000000005', 6, 1, 'legpress',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000005', 6, 2, 'legcurl',   2, 10, 12),
  ('00000000-0000-4000-8000-000000000005', 6, 3, 'back',      2, 10, 12),
  ('00000000-0000-4000-8000-000000000005', 6, 4, 'glute',     2, 10, 12),
  ('00000000-0000-4000-8000-000000000005', 6, 5, 'calf',      2, 12, 15),
  ('00000000-0000-4000-8000-000000000005', 6, 6, 'plank',     2, 20, 40),
  -- 3-day: Full A (Mon)
  ('00000000-0000-4000-8000-000000000003', 1, 1, 'legpress',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 1, 2, 'chest',     2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 1, 3, 'lat',       2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 1, 4, 'shoulder',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 1, 5, 'triceps',   2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 1, 6, 'plank',     2, 20, 40),
  -- 3-day: Full B (Wed)
  ('00000000-0000-4000-8000-000000000003', 3, 1, 'legcurl',   2, 10, 12),
  ('00000000-0000-4000-8000-000000000003', 3, 2, 'incline',   2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 3, 3, 'row',       2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 3, 4, 'lateral',   2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 3, 5, 'hammer',    2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 3, 6, 'calf',      2, 12, 15),
  -- 3-day: Full C (Sat)
  ('00000000-0000-4000-8000-000000000003', 6, 1, 'legext',    2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 6, 2, 'back',      2, 10, 12),
  ('00000000-0000-4000-8000-000000000003', 6, 3, 'glute',     2, 10, 12),
  ('00000000-0000-4000-8000-000000000003', 6, 4, 'reardelt',  2, 8, 12),
  ('00000000-0000-4000-8000-000000000003', 6, 5, 'cablecurl', 2, 8, 12)
on conflict (template_id, weekday, position) do update set
  exercise_slug = excluded.exercise_slug, sets = excluded.sets, rep_lo = excluded.rep_lo, rep_hi = excluded.rep_hi;

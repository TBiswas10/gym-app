"""Generates supabase/seed-more-exercises.sql and downloads the two photos per exercise (free-exercise-db, public domain).
Run once from the repo root:  python scripts/more-exercises.py
Rules: slug is letters only (2-20), muscle_group is one of Legs, Chest, Shoulders, Arms, Back, Core.
"""
import json
import os
import urllib.request

# slug, name, category, group, kit, kind, muscles, rep_lo, rep_hi, step, increment, setup, cues, mistakes, backup, photo id
EX = [
    ("seatedlegpress", "Seated leg press", "lower", "Legs", "Machine", "weight", ["Quads", "Glutes", "Hamstrings"], 8, 12, 5, 5,
     ["Sit back in the seat with your back and hips flat against the pad.", "Place your feet shoulder-width apart on the middle of the plate.", "Set the seat so your knees start at about 90 degrees."],
     ["Press through your whole foot, not your toes.", "Lower under control until your knees reach 90 degrees.", "Stop just short of locking your knees."],
     ["Letting your hips curl up off the seat at the bottom.", "Locking your knees hard at the top.", "Letting your knees fall inwards."],
     "Leg press", "Narrow_Stance_Leg_Press"),
    ("pecdeck", "Pec deck fly", "upper", "Chest", "Machine", "weight", ["Chest", "Front shoulders"], 8, 12, 2.5, 2.5,
     ["Set the seat so the handles sit at chest height.", "Sit with your back flat against the pad.", "Start with your arms open, elbows slightly bent."],
     ["Bring the handles together in a wide hug.", "Squeeze your chest for a beat at the middle.", "Return slowly until you feel a stretch."],
     ["Using your arms to pull instead of your chest.", "Shrugging your shoulders up.", "Letting the weights slam back."],
     "Cable fly", "Butterfly"),
    ("cablefly", "Cable fly", "upper", "Chest", "Cable", "weight", ["Chest", "Front shoulders"], 8, 12, 2.5, 2.5,
     ["Set both pulleys at about shoulder height.", "Stand in the middle with one foot slightly forward.", "Hold a handle in each hand with a soft bend in your elbows."],
     ["Bring your hands together in a hugging arc.", "Keep your chest tall and ribs down.", "Control the return until your chest stretches."],
     ["Turning it into a press by bending your elbows.", "Leaning your whole body into the pull.", "Going so heavy your shoulders roll forward."],
     "Pec deck fly", "Cable_Crossover"),
    ("dbpress", "Dumbbell bench press", "upper", "Chest", "Dumbbells", "weight", ["Chest", "Shoulders", "Triceps"], 8, 12, 2, 2,
     ["Sit on the bench with a dumbbell on each thigh, then lie back and kick them up.", "Plant your feet and keep your shoulder blades pinched back.", "Start with the dumbbells over your chest, palms facing forward."],
     ["Lower until your elbows are just below the bench.", "Press up and slightly in over your chest.", "Keep your wrists straight over your elbows."],
     ["Flaring your elbows out wide.", "Bouncing the weights off your chest.", "Lifting your hips off the bench."],
     "Chest press", "Dumbbell_Bench_Press"),
    ("pushup", "Push-up", "upper", "Chest", "Bodyweight", "bodyweight", ["Chest", "Shoulders", "Triceps"], 8, 15, 2.5, 2.5,
     ["Place your hands slightly wider than your shoulders.", "Make a straight line from your head to your heels.", "Brace your core and squeeze your glutes."],
     ["Lower your chest to a fist's height from the floor.", "Keep your elbows at about 45 degrees from your body.", "Press the floor away and keep your body in one line."],
     ["Letting your hips sag or pike up.", "Flaring your elbows straight out.", "Only going halfway down."],
     "Knee push-up", "Pushups"),
    ("dbshoulder", "Dumbbell shoulder press", "upper", "Shoulders", "Dumbbells", "weight", ["Shoulders", "Triceps"], 8, 12, 2, 2,
     ["Sit on a bench with the back pad upright.", "Hold the dumbbells at shoulder height, palms forward.", "Brace your core and keep your ribs down."],
     ["Press up until your arms are nearly straight.", "Bring the weights together slightly at the top.", "Lower under control to ear height."],
     ["Arching your lower back.", "Shrugging at the top.", "Letting the dumbbells drift out wide."],
     "Shoulder press", "Dumbbell_Shoulder_Press"),
    ("cablelateral", "Cable lateral raise", "upper", "Shoulders", "Cable", "weight", ["Side shoulders"], 8, 12, 2.5, 2.5,
     ["Set the pulley low and stand side-on to the stack.", "Hold the handle with the arm furthest from the stack.", "Stand tall with a soft bend in your elbow."],
     ["Raise your arm out to the side to shoulder height.", "Lead with your elbow, not your hand.", "Lower slowly so the cable stays tight."],
     ["Swinging your body to lift.", "Raising your hand above your elbow.", "Shrugging your shoulder up."],
     "Lateral raise", "Cable_Seated_Lateral_Raise"),
    ("facepull", "Face pull", "upper", "Shoulders", "Cable", "weight", ["Rear shoulders", "Upper back"], 10, 15, 2.5, 2.5,
     ["Set the rope at about face height.", "Take the ends of the rope with your thumbs towards you.", "Step back until the cable is tight with your arms straight."],
     ["Pull the rope towards your forehead, elbows high.", "Pull the ends apart at the end of the pull.", "Squeeze your shoulder blades together."],
     ["Pulling down to your chest.", "Leaning back to cheat the weight.", "Using so much weight your shoulders roll forward."],
     "Rear delt fly", "Face_Pull"),
    ("assistedpull", "Assisted pull-up", "upper", "Back", "Machine", "weight", ["Lats", "Upper back", "Biceps"], 6, 10, 5, 5,
     ["Set the assist weight, more weight means more help.", "Kneel or stand on the pad and take a shoulder-width grip.", "Start with your arms long and chest up."],
     ["Pull your elbows down towards your ribs.", "Get your chin over the bar.", "Lower slowly until your arms are straight."],
     ["Using momentum to swing up.", "Cutting the range short at the bottom.", "Shrugging your shoulders to your ears."],
     "Lat pulldown", "Band_Assisted_Pull-Up"),
    ("straightarm", "Straight-arm pulldown", "upper", "Back", "Cable", "weight", ["Lats"], 8, 12, 2.5, 2.5,
     ["Set the pulley high with a bar or rope.", "Stand a step back with a slight hinge at the hips.", "Hold the bar at shoulder height with straight arms."],
     ["Sweep the bar down to your thighs with straight arms.", "Squeeze your lats at the bottom.", "Let it rise slowly until your lats stretch."],
     ["Bending your elbows into a triceps pushdown.", "Rounding your back.", "Using your body weight to drive it down."],
     "Lat pulldown", "Straight-Arm_Pulldown"),
    ("dbrow", "One-arm dumbbell row", "upper", "Back", "Dumbbells", "weight", ["Lats", "Mid back", "Biceps"], 8, 12, 2, 2,
     ["Put one hand and the same-side knee on a bench.", "Hold a dumbbell in your free hand with your arm hanging straight.", "Keep your back flat and parallel to the floor."],
     ["Pull the dumbbell to your hip, elbow close to your body.", "Pause and squeeze your back.", "Lower until your arm is long again."],
     ["Twisting your torso to lift.", "Pulling towards your shoulder instead of your hip.", "Letting your back round."],
     "Low seated row", "One-Arm_Dumbbell_Row"),
    ("overheadtri", "Overhead triceps extension", "upper", "Arms", "Cable", "weight", ["Triceps"], 8, 12, 2.5, 2.5,
     ["Set the pulley low and attach a rope.", "Face away from the stack, holding the rope behind your head.", "Take a staggered stance with your elbows pointing forward."],
     ["Straighten your arms up and forward.", "Keep your elbows close to your ears.", "Lower until you feel a stretch behind your arms."],
     ["Letting your elbows flare out wide.", "Arching your lower back.", "Using body momentum to push."],
     "Triceps pushdown", "Cable_Rope_Overhead_Triceps_Extension"),
    ("dbcurl", "Dumbbell curl", "upper", "Arms", "Dumbbells", "weight", ["Biceps"], 8, 12, 2, 2,
     ["Stand tall with a dumbbell in each hand, palms forward.", "Keep your elbows tucked at your sides.", "Stand with your feet hip-width apart."],
     ["Curl the weights up towards your shoulders.", "Squeeze your biceps at the top.", "Lower slowly until your arms are straight."],
     ["Swinging your body to lift.", "Letting your elbows drift forward.", "Dropping the weights fast."],
     "Hammer curl", "Dumbbell_Bicep_Curl"),
    ("preacher", "Preacher curl machine", "upper", "Arms", "Machine", "weight", ["Biceps"], 8, 12, 2.5, 2.5,
     ["Set the seat so your armpits rest on top of the pad.", "Grip the handles with your arms extended.", "Sit tall and keep your chest on the pad."],
     ["Curl the handles up towards your shoulders.", "Squeeze at the top.", "Lower slowly until your arms are almost straight."],
     ["Lifting your elbows off the pad.", "Slamming into the bottom.", "Leaning back to cheat the weight."],
     "Dumbbell curl", "Machine_Preacher_Curls"),
    ("tricepsdip", "Triceps dip machine", "upper", "Arms", "Machine", "weight", ["Triceps", "Chest"], 8, 12, 2.5, 2.5,
     ["Adjust the seat so the handles are at your lower ribs.", "Sit tall with your back against the pad.", "Grip the handles with your elbows tucked in."],
     ["Press down until your arms are straight.", "Keep your shoulders down and back.", "Return slowly until your elbows are at 90 degrees."],
     ["Shrugging your shoulders up.", "Letting your elbows flare out.", "Going too deep and pinching your shoulders."],
     "Triceps pushdown", "Dip_Machine"),
    ("hacksquat", "Hack squat", "lower", "Legs", "Machine", "weight", ["Quads", "Glutes"], 8, 12, 5, 5,
     ["Step into the machine with your back and shoulders against the pads.", "Place your feet shoulder-width apart, toes slightly out.", "Release the safety handles."],
     ["Lower until your thighs are about parallel.", "Press through your whole foot.", "Keep your back flat on the pad."],
     ["Letting your heels lift off the plate.", "Letting your knees cave in.", "Locking your knees hard at the top."],
     "Seated leg press", "Hack_Squat"),
    ("goblet", "Goblet squat", "lower", "Legs", "Dumbbells", "weight", ["Quads", "Glutes", "Core"], 8, 12, 2, 2,
     ["Hold one dumbbell upright against your chest with both hands.", "Stand with your feet slightly wider than your shoulders.", "Point your toes out a little."],
     ["Sit straight down between your knees.", "Keep your chest tall and elbows inside your knees.", "Drive up through your whole foot."],
     ["Letting your heels rise.", "Rounding your back at the bottom.", "Letting your knees fall inwards."],
     "Seated leg press", "Goblet_Squat"),
    ("rdl", "Dumbbell Romanian deadlift", "lower", "Legs", "Dumbbells", "weight", ["Hamstrings", "Glutes", "Lower back"], 8, 12, 2, 2,
     ["Stand tall holding a dumbbell in each hand in front of your thighs.", "Soften your knees and keep your chest up.", "Set your feet hip-width apart."],
     ["Push your hips back and slide the weights down your legs.", "Stop when you feel a stretch in your hamstrings.", "Drive your hips forward to stand tall."],
     ["Rounding your lower back.", "Bending your knees into a squat.", "Letting the weights drift away from your legs."],
     "Back extension", "Stiff-Legged_Dumbbell_Deadlift"),
    ("lunge", "Dumbbell lunge", "lower", "Legs", "Dumbbells", "weight", ["Quads", "Glutes"], 8, 12, 2, 2,
     ["Stand tall with a dumbbell in each hand at your sides.", "Take a big step forward.", "Keep your torso upright and core tight."],
     ["Lower until both knees are at about 90 degrees.", "Keep your front knee over your ankle.", "Push through the front heel to stand."],
     ["Letting your front knee dive inwards.", "Taking too short a step.", "Leaning your whole body forward."],
     "Goblet squat", "Dumbbell_Lunges"),
    ("abduct", "Hip abduction machine", "lower", "Legs", "Machine", "weight", ["Glutes", "Outer thighs"], 10, 15, 5, 5,
     ["Sit with your back flat against the pad.", "Place your legs against the outer pads.", "Set the starting width so you feel a small stretch."],
     ["Press your legs apart in a smooth motion.", "Pause when you reach the end.", "Return slowly until the pads nearly touch."],
     ["Using momentum to swing the pads.", "Leaning forward to cheat.", "Letting the weights slam together."],
     "Hip adduction machine", "Thigh_Abductor"),
    ("adduct", "Hip adduction machine", "lower", "Legs", "Machine", "weight", ["Inner thighs"], 10, 15, 5, 5,
     ["Sit with your back flat against the pad.", "Place your legs against the inner pads.", "Set the starting width so you feel a small stretch."],
     ["Squeeze your legs together smoothly.", "Pause when the pads meet.", "Return slowly to the starting width."],
     ["Using momentum.", "Opening too wide and straining your hips.", "Letting the weights slam back."],
     "Hip abduction machine", "Thigh_Adductor"),
    ("standcalf", "Standing calf raise", "lower", "Legs", "Machine", "weight", ["Calves"], 12, 15, 5, 5,
     ["Set the shoulder pads so you can stand tall.", "Place the balls of your feet on the platform.", "Keep your knees almost straight."],
     ["Lift your heels as high as you can.", "Pause at the top for a beat.", "Lower slowly until you feel a stretch."],
     ["Bouncing at the bottom.", "Bending your knees to push.", "Only doing a short range."],
     "Calf raise", "Standing_Calf_Raises"),
    ("lyingcurl", "Lying leg curl", "lower", "Legs", "Machine", "weight", ["Hamstrings"], 10, 12, 2.5, 2.5,
     ["Lie face down with the pad just above your heels.", "Line your knees up with the machine's pivot.", "Grip the handles and keep your hips pressed down."],
     ["Curl your heels towards your glutes.", "Squeeze your hamstrings at the top.", "Lower slowly until your legs are almost straight."],
     ["Lifting your hips off the pad.", "Jerking the weight up.", "Dropping it fast on the way down."],
     "Dumbbell Romanian deadlift", "Lying_Leg_Curls"),
    ("cablecrunch", "Cable crunch", "core", "Core", "Cable", "weight", ["Abs"], 10, 15, 2.5, 2.5,
     ["Attach a rope to the high pulley and kneel facing the stack.", "Hold the rope beside your head.", "Sit your hips back over your heels."],
     ["Curl your ribs towards your hips.", "Breathe out as you crunch.", "Return slowly until your back is long."],
     ["Pulling with your arms.", "Sitting back and bending at the hips.", "Using too much weight and rocking."],
     "Dead bug", "Cable_Crunch"),
    ("kneeraise", "Hanging knee raise", "core", "Core", "Bodyweight", "bodyweight", ["Abs", "Hip flexors"], 8, 15, 2.5, 2.5,
     ["Hang from the bar with a shoulder-width grip.", "Brace your core and keep your legs together.", "Start with your legs straight down."],
     ["Raise your knees towards your chest.", "Curl your pelvis up at the top.", "Lower slowly without swinging."],
     ["Swinging your body.", "Only lifting with your hip flexors.", "Dropping your legs fast."],
     "Dead bug", "Hanging_Leg_Raise"),
    ("sideplank", "Side plank", "core", "Core", "Bodyweight", "timed", ["Obliques", "Core", "Shoulders"], 20, 40, 5, 5,
     ["Lie on your side with your elbow under your shoulder.", "Stack your feet or place one in front of the other.", "Lift your hips so your body is one line."],
     ["Press your forearm into the floor.", "Keep your hips high and ribs down.", "Breathe steadily."],
     ["Letting your hips sag.", "Rolling your chest forward.", "Holding your breath."],
     "Knee side plank", "Side_Bridge"),
    ("deadbug", "Dead bug", "core", "Core", "Bodyweight", "bodyweight", ["Abs", "Core"], 8, 12, 2.5, 2.5,
     ["Lie on your back with your arms up and knees over your hips.", "Press your lower back gently into the floor.", "Brace your core."],
     ["Lower the opposite arm and leg together.", "Keep your lower back pressed down.", "Return and switch sides slowly."],
     ["Letting your back arch off the floor.", "Rushing the movement.", "Holding your breath."],
     "Plank", "Dead_Bug"),
]


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def arr(xs):
    return "array[" + ", ".join(q(x) for x in xs) + "]"


rows = []
for i, e in enumerate(EX):
    slug, name, cat, grp, kit, kind, muscles, lo, hi, step, inc, setup, cues, mistakes, backup, photo = e
    assert slug.isalpha() and 2 <= len(slug) <= 20, slug
    assert grp in {"Legs", "Chest", "Shoulders", "Arms", "Back", "Core"}, grp
    rows.append(
        f"  ({q(slug)}, {q(name)}, {q(cat)}, {q(grp)}, {q(kit)}, {q(kind)}, {arr(muscles)}, {lo}, {hi}, {step}, {inc}, "
        f"{arr(setup)}, {arr(cues)}, {arr(mistakes)}, '', {q(backup)}, {18 + i})"
    )

sql = f"""-- More exercises (idempotent). Applied with execute_sql, same as seed.sql.
insert into public.exercises
  (slug, name, category, muscle_group, kit, kind, muscles, rep_lo, rep_hi, weight_step_kg, default_increment_kg,
   setup, cues, mistakes, default_notes, backup_name, sort_order)
values
{(","+chr(10)).join(rows)}
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, muscle_group = excluded.muscle_group, kit = excluded.kit,
  kind = excluded.kind, muscles = excluded.muscles, rep_lo = excluded.rep_lo, rep_hi = excluded.rep_hi,
  weight_step_kg = excluded.weight_step_kg, default_increment_kg = excluded.default_increment_kg,
  setup = excluded.setup, cues = excluded.cues, mistakes = excluded.mistakes, backup_name = excluded.backup_name,
  sort_order = excluded.sort_order;
"""
os.makedirs("supabase", exist_ok=True)
open("supabase/seed-more-exercises.sql", "w", encoding="utf-8").write(sql)
print("wrote", len(EX), "exercises")

for e in EX:
    slug, photo = e[0], e[-1]
    os.makedirs(f"public/exercises/{slug}", exist_ok=True)
    for i in (0, 1):
        url = f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{photo}/{i}.jpg"
        path = f"public/exercises/{slug}/{i}.jpg"
        if os.path.exists(path):
            continue
        try:
            urllib.request.urlretrieve(url, path)
        except Exception as ex:  # noqa: BLE001
            print("FAILED", slug, i, ex)
print("photos done")

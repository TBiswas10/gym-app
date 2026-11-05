"""Adds the exercises in scripts/new-exercises.json (data written by Haiku, photo ids chosen by hand below).
python scripts/new-exercises.py  -> writes supabase/seed-new-exercises.sql and downloads photos (free-exercise-db, public domain)."""
import json, os, urllib.request

PHOTO = {"seatedcalf": "Seated_Calf_Raise", "inclinelegraise": "Flat_Bench_Lying_Leg_Raise", "verticalraise": "Hanging_Leg_Raise", "abroller": "Ab_Roller",
 "tbarrow": "Lying_T-Bar_Row", "barbellbench": "Barbell_Bench_Press_-_Medium_Grip", "barbellsquat": "Barbell_Squat", "deadlift": "Barbell_Deadlift",
 "ohpress": "Barbell_Shoulder_Press", "pullup": "Pullups", "chinup": "Chin-Up", "dips": "Parallel_Bar_Dip", "bbrow": "Bent_Over_Barbell_Row",
 "bbhipthrust": "Barbell_Hip_Thrust", "bulgarian": "Split_Squat_with_Dumbbells", "seatedlegcurl": "Seated_Leg_Curl", "shrug": "Dumbbell_Shrug",
 "skullcrusher": "EZ-Bar_Skullcrusher", "ezcurl": "EZ-Bar_Curl", "concentration": "Concentration_Curls", "crunchmachine": "Ab_Crunch_Machine",
 "russiantwist": "Russian_Twist", "bicyclecrunch": "Air_Bike", "woodchop": "Standing_Cable_Wood_Chop", "dbreversefly": "Reverse_Flyes",
 "dbfly": "Dumbbell_Flyes", "wristcurl": "Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench", "stepup": "Dumbbell_Step_Ups", "hanglegraise": "Hanging_Leg_Raise",
 "declinesitup": "Decline_Crunch", "inclinebb": "Barbell_Incline_Bench_Press_-_Medium_Grip", "chestsupportedtbar": "Lying_T-Bar_Row"}

q = lambda s: "'" + str(s).replace("'", "''") + "'"
arr = lambda l: "array[" + ", ".join(q(x) for x in l) + "]"
data = json.load(open("scripts/new-exercises.json", encoding="utf-8"))
rows = []
for i, e in enumerate(data):
    rows.append(f"  ({q(e['slug'])}, {q(e['name'])}, {q(e.get('category', 'upper'))}, {q(e['group'])}, {q(e['kit'])}, {q(e['kind'])}, {arr(e['muscles'])}, {e['rep_lo']}, {e['rep_hi']}, {e['step']}, {e['inc']}, "
                f"{arr(e['setup'])}, {arr(e['cues'])}, {arr(e['mistakes'])}, '', {q(e['backup'])}, {60 + i})")
open("supabase/seed-new-exercises.sql", "w", encoding="utf-8").write(
    "-- New exercises (idempotent). Applied with execute_sql.\ninsert into public.exercises\n  (slug, name, category, muscle_group, kit, kind, muscles, rep_lo, rep_hi, weight_step_kg, default_increment_kg, setup, cues, mistakes, default_notes, backup_name, sort_order)\nvalues\n"
    + ",\n".join(rows) + "\non conflict (slug) do update set name = excluded.name, kit = excluded.kit, muscles = excluded.muscles, setup = excluded.setup, cues = excluded.cues, mistakes = excluded.mistakes, backup_name = excluded.backup_name;\n")
for e in data:
    d = f"public/exercises/{e['slug']}"
    os.makedirs(d, exist_ok=True)
    for i in (0, 1):
        p = f"{d}/{i}.jpg"
        if os.path.exists(p): continue
        try:
            urllib.request.urlretrieve(f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{PHOTO[e['slug']]}/{i}.jpg", p)
        except Exception as ex:  # noqa: BLE001
            print("FAILED", e["slug"], PHOTO[e["slug"]], ex)
print("done", len(data))

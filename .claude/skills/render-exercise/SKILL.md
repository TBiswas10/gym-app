---
name: render-exercise
description: Create or fix an exercise animation in scripts/exercise-renders (Blender, headless) and publish it to the app. Use for any new lift, pose fix, equipment or highlight change.
---
# Render an exercise
Blender: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe -b -P scripts/exercise-renders/render.py -- --out _renders --slug <slug> <mode>`; the body needs `HBM_BLEND` (Human Base Meshes CC0 .blend) or the default scratchpad path.
1. Add or edit the lift in `lifts*.py`: `A` (start) and `B` (peak) poses, `arc`, optional `tempo`, props via `props.py`, `highlight` / `secondary` muscle names (see `REGIONS` / `TORSO` in figure.py), camera.
2. Check with `--stills` then `grid.py` for a contact sheet; LOOK at the image. For motion use `--video` and sample frames. Fix before rendering more.
3. Render all with `make_all.sh`; run renders in parallel (about 3 at once, 12 cores), never in the foreground for more than a few minutes.
4. Publish: pack, update `src/lib/rendered-exercises.ts`, run the `ship-gym-app` skill.
Gotchas: hands are relative to the shoulder (`rhand`), feet to the hip (`rank`); keep `FIG_SKIN=lbs` (dual quaternion folded the torso); a loop must start and end on the same pose; the public repo must never contain the base mesh or `_renders/`.

## Token-lean workflow (Blender work is image-heavy; spend tokens only where eyes are needed)
- Run QA by numbers first: `python scripts/exercise-renders/qa.py _renders [slug...]` (moves? loop closes? cut off? glow visible?). Only LOOK at lifts it flags.
- One contact sheet per batch (`grid.py` at 360-420 px, or `vframes.py` for a video), never one image per lift, never full-size frames unless diagnosing a detail; crop to the problem area.
- Never read render logs; `grep -E "DONE|Error|Traceback"` only. Never print vertex arrays or node trees.
- Edit with small Python string-replace patches, not whole-file rewrites; the Write tool for new files only.
- Batch the slow work in the background (`batch.sh`, 4 at a time) and do code work meanwhile; do not poll in a loop.
- Test a change on 2-3 representative lifts (one seated machine, one standing dumbbell, one lying/hanging) before rendering all 39.

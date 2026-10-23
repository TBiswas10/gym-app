# 004 — Our own 3D exercise renders (replaces the free-exercise-db photos)

Status: BUILT (2026-10-23). The mannequin turned out better from a sculpted CC0 base mesh than from primitives (see docs/ASSETS.md and CLAUDE.md). Pilot approved by iteration; all plan lifts plus the swap targets are being rendered.

## Goal
Every one of the 54 library exercises gets a short looping animation of a smooth grey mannequin doing the lift, with the
working muscle lit up, on a transparent background (so it sits on any theme). Same idea as the grey-mannequin-with-a-
highlighted-muscle charts you see on gym machines and in fitness apps: that is a generic convention, and ours is built
from scratch, so no third-party figure, texture or file is copied or traced.

Why: the current photos (free-exercise-db) are Unlicense on the data, but the repo never says where the photos came from,
and this repo is public. Replacing them with assets we generate ourselves makes the provenance clean AND gives a more
consistent, more premium library.

## What is already in place
- Blender 5.2 is installed (`C:\Program Files\Blender Foundation\Blender 5.2`). The Blender MCP addon is NOT running, but we do
  not need it: everything runs headless (`blender -b -P script.py`), so it is repeatable and lives in the repo.
- Pillow 12.1 is installed (assembles animated WebP). No ffmpeg / cwebp needed.
- `ExerciseMedia` (used in Library, guide page, Form check, guide sheet) already takes a slug; it is the single place to change.
- Current photos: 54 folders in `public/exercises`, 7.4 MB.

## Output format (decision)
- One animated WebP per lift with alpha: `public/exercises/<slug>/loop.webp`, 400x400, 24 fps, ~36 frames, ping-pong
  start -> finish -> start with eased ends (a held beat at the hard part of the lift).
- Also `poster.webp` (the finish pose, static) for reduced-motion users and for the small thumbs in the Library list.
- Budget: <= 120 KB per loop, <= 6 MB total (smaller than today's 7.4 MB). Animated WebP plays on iOS 14+.
- Small code change (I said "no code" earlier; that was too strong): `ExerciseMedia` shows `loop.webp` (or `poster.webp` when
  `prefers-reduced-motion`), and falls back to the old `0.jpg`/`1.jpg` crossfade for any slug without a render yet, so we can
  roll out in batches and nothing breaks halfway.
- Highlight colour: v1 bakes ONE colour into the render (the lime accent, which reads well on grey). Themed highlight
  (teal/amber/amethyst) is possible later by also rendering a muscle-mask layer and tinting it with `var(--accent)` via CSS mask.
  Cost: a second small file per lift. Decision for you below.

## Pipeline (all in `scripts/exercise-renders/`, committed)
1. `mannequin.py` — builds the figure.
   - Body: a stick skeleton with the Skin modifier (per-joint radii) + Subdivision, then smooth-shaded. This is the quickest way
     to a clean, organic mannequin from simple shapes. Separate head (sphere + neck), simple hands and feet, dark-grey shorts as
     a second material (as in your screenshot). No face.
   - Rig: an armature with IK on hands and feet, so a pose is "where the hands and feet go + how far the torso leans", not 60
     joint angles. Automatic weights bind the skin to the rig.
   - Muscle highlights: slightly inflated shells for chest, front delt, side delt, rear delt, lats, upper back, biceps, triceps,
     forearms, abs, obliques, glutes, quads, hamstrings, calves, each parented to the right bone and normally hidden. Each lift
     turns on its primary muscles (and optionally a softer tone for secondaries), taken from `exercises.muscles` so it matches
     the Muscle balance logic.
2. `equipment.py` — minimal props only, in dark grey: dumbbell, barbell + plates, bench (flat/incline), cable handle + a simple
   column, machine seat + back pad + handle, pull-up bar, step, mat. Machines are drawn as the parts you touch, not a full
   manufacturer-style machine (that is where cost explodes and where lookalike risk is highest).
3. `poses.json` + `archetypes.py` — the lifts group into about 15 movement patterns (horizontal press, incline press, vertical
   press, lateral raise, row, pulldown/pull-up, curl, triceps extension, squat/leg press, hinge/RDL, lunge, hip thrust, leg
   curl/extension, calf raise, crunch/core hold, cardio). Each pattern has a start and end pose with parameters (grip width,
   torso angle, bench angle, range). So we hand-author about 15 pose pairs plus a small per-lift tweak, not 108 from zero.
4. `render.py` — EEVEE, transparent film, orthographic 3/4 camera, one soft key light + rim light + a subtle ground contact
   shadow baked to alpha, filmic look. Frames to PNG.
5. `pack.py` — Pillow joins frames into the loop WebP + poster, checks the size budget, writes a contact sheet.
6. `make-all.ps1` — one command re-renders everything (`blender -b -P render.py -- --slug benchpress`), so a tweak to the
   mannequin re-renders all 54 consistently.

## Phases and review gates
- Phase 0 (short): prove headless Blender renders a transparent PNG on this machine (GPU or CPU), time one frame.
- Phase 1: mannequin + rig + muscle shells + lighting. Gate: I render 4 still angles; you say "that looks premium" or what to change.
  I can look at the PNGs myself, so I iterate before showing you.
- Phase 2 (PILOT): 3 lifts, one push, one pull, one legs (e.g. chest press, lat pulldown, leg press), full loop WebP, shown in the
  app next to the old photos. Gate: you check it on the phone. This is the point to stop if it is not good enough.
- Phase 3: author the ~15 archetypes and map all 54 lifts; render in batches of ~10, contact-sheet review each batch (pose
  correct? right muscle lit? no limb through the bench? loop seamless?).
- Phase 4: switch `ExerciseMedia`, reduced-motion poster, delete the old photos, update CLAUDE.md, add `docs/ASSETS.md`
  (everything is generated by our scripts, no external models or textures), commit, deploy.

## Risks (honest)
- Look quality is the big one. A mannequin from primitives can look blobby. Mitigation: Skin+Subdivision with careful radii,
  soft lighting, restraint (no face, no fingers), and the Phase 1 gate before any lift is posed.
- Pose accuracy for 54 lifts without a biomechanics expert in the room. Mitigation: archetype poses checked frame by frame
  against the cues already in the guides; you will notice a wrong-looking lift faster than I will, so batches go to you.
- Machines and cables look cheap if over-detailed. Mitigation: minimal props only.
- Effort: this is several sessions of work, not one. The pilot is the cheap way to find out whether it is worth it.
- Render time: ~2,000 frames total; EEVEE is seconds per frame on a GPU, minutes on CPU only. Phase 0 measures it.

## Decisions I need from you
1. Go for the pilot (3 lifts)?
2. One mannequin (male-proportioned like your screenshot, or a neutral build), or both a male and a female version later?
3. Highlight colour: baked lime (simple), or themed via a mask layer (more work, follows your 5 themes)?
4. After the pilot, replace all 54 or only the ones where the old photos are weak?

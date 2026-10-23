#!/bin/bash
# Start and finish stills for the given lifts.  bash stills.sh slug [slug ...]
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
OUT="C:/Users/tirth/Documents/gym-app/_renders"
for sl in "$@"; do
  "$BL" -b -P scripts/exercise-renders/render.py -- --out "$OUT" --slug "$sl" --stills --size 480 2>&1 | grep -E "Error|Traceback|DONE|Exception|line "
done
echo STILLSDONE

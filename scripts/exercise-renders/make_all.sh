#!/bin/bash
# Render loops for the given lifts and pack them.  bash make_all.sh slug [slug ...]
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
OUT="C:/Users/tirth/Documents/gym-app/_renders"
for sl in "$@"; do
  "$BL" -b -P scripts/exercise-renders/render.py -- --out "$OUT" --slug "$sl" --frames 24 --size 640 2>&1 | grep -E "Error|Traceback|DONE|Exception" 
  python scripts/exercise-renders/pack.py _renders "$sl"
done
echo ALLDONE

#!/bin/bash
# Videos + posters for every lift, 4 Blender processes at a time.  bash batch.sh [slug ...]  (no args = all)
cd "$(dirname "$0")/../.."
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
OUT="C:/Users/tirth/Documents/gym-app/_renders"
SLUGS="$@"
[ -z "$SLUGS" ] && SLUGS="chest lat legpress dbcurl shoulder reardelt legext calf row legcurl cablecrunch incline lateral hammer cablecurl triceps chestrow plank glute back assistedpull cablelateral deadbug dbpress dbshoulder dbrow overheadtri preacher facepull goblet hacksquat kneeraise lunge rdl smithincline smithrdl standcalf pushup pecdeck"
one() { s=$1; "$BL" -b -P scripts/exercise-renders/render.py -- --out "$OUT" --slug $s --poster --size 480 --samples 48 2>&1 | grep -E "DONE|Error|Traceback"; "$BL" -b -P scripts/exercise-renders/render.py -- --out "$OUT" --slug $s --video --size 480 --samples 32 2>&1 | grep -E "DONE|Error|Traceback"; }
export -f one; export BL OUT
printf "%s\n" $SLUGS | xargs -P 4 -I{} bash -c 'one {}'
echo BATCHDONE

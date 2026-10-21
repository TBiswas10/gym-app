"""Render each muscle highlight alone on the neutral standing figure: a chart to check the shapes.
blender -b -P calib_muscles.py -- <out dir> [muscle ...]"""
import os, sys, math
import bpy
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure, render

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
names = args[1:] or ["chest", "lats", "midback", "traps", "abs", "obliques", "glutes", "frontdelt", "sidedelt", "reardelt", "biceps", "triceps", "forearms", "quads", "hamstrings", "calves"]
back = {"lats", "midback", "traps", "glutes", "reardelt", "triceps", "hamstrings", "calves"}
os.makedirs(out, exist_ok=True)
for m in names:
    az = 180 if m in back else 0
    cam = dict(center=(0.07, 0, 0.9), scale=2.0, az=0, el=4, shadow=(0.07, 0.6, 0.4))
    sc = render.setup_scene(480, cam)
    fig = figure.Figure(highlight=(m,))
    # face front: camera along +X looking back at the figure; back view: from -X
    cd = sc.camera
    d = Vector((1, 0, 0.05)) if m not in back else Vector((-1, 0, 0.05))
    cd.location = Vector((0.07, 0, 0.9)) + d * 8
    cd.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(out, m + ".png")
    bpy.ops.render.render(write_still=True)
    print("DONE", m)

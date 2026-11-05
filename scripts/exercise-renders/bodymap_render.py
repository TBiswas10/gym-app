"""Renders the body map pieces: blender -b -P bodymap_render.py -- <out dir>
base_front/base_back (the plain figure) and one render per muscle with only that muscle lit, all on transparent background, same camera."""
import os, sys
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure, render

out = sys.argv[sys.argv.index("--") + 1]
os.makedirs(out, exist_ok=True)
FRONT = ["chest", "abs", "obliques", "frontdelt", "sidedelt", "biceps", "forearms", "quads"]
BACK = ["traps", "lats", "midback", "reardelt", "triceps", "glutes", "hamstrings", "calves"]
# Shorter shorts for the map, so the thighs show.
figure.SHORTS = [("pelvis", 0.0, (0.0, 0.0, -0.03), (0.21, 0.25, 0.12)), ("hip", 0.1, (0.0, 0.0, 0.0), (0.16, 0.16, 0.07))]
jobs = [("base", "front", ()), ("base", "back", ())] + [(m, "front", (m,)) for m in FRONT] + [(m, "back", (m,)) for m in BACK]
for name, view, hl in jobs:
    cam = dict(center=(0.07, 0, 0.88), scale=1.95, az=0, el=0, shadow=(0.0, 0.01, 0.01))
    sc = render.setup_scene(900, cam, transparent=True, samples=48)
    for ob in list(sc.objects):                 # no ground shadow in the map
        if ob.type == "MESH" and ob.name.startswith("Plane"):
            bpy.data.objects.remove(ob)
    fig = figure.Figure(highlight=hl)
    d = Vector((1, 0, 0)) if view == "front" else Vector((-1, 0, 0))
    cam_ob = sc.camera
    cam_ob.location = Vector((0.07, 0, 0.88)) + d * 8
    cam_ob.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    for L in [o for o in sc.objects if o.type == "LIGHT"]:   # even, flat studio light for a map
        L.data.energy *= 0.8
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.filepath = os.path.join(out, f"{name}_{view}.png")
    bpy.ops.render.render(write_still=True)
    print("DONE", name, view, flush=True)

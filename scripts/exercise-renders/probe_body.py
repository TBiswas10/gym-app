import bpy, sys, math
from mathutils import Vector
p, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
with bpy.data.libraries.load(p, link=False) as (src, dst):
    dst.collections = ["Body Male - Realistic"]
sc = bpy.context.scene
sc.collection.children.link(dst.collections[0])
body = bpy.data.objects["GEO-body_male_realistic"]; body.location = (0, 0, 0)
print("LOC", tuple(body.location), "DIM", tuple(body.dimensions), "mats", [m.name for m in body.data.materials])
for m in body.modifiers:
    print("MOD", m.type, getattr(m, "levels", None), getattr(m, "render_levels", None), getattr(m, "total_levels", None))
bb = [body.matrix_world @ Vector(c) for c in body.bound_box]
print("BBOX", min(v.x for v in bb), max(v.x for v in bb), min(v.y for v in bb), max(v.y for v in bb), min(v.z for v in bb), max(v.z for v in bb))
mat = bpy.data.materials.new("grey"); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.66, 0.665, 0.68, 1)
mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.42
body.data.materials.clear(); body.data.materials.append(mat)
for o in bpy.data.objects:
    if o.name.startswith("GEO-body_male_realistic.eye"): o.hide_render = True
for pl in body.data.polygons: pl.use_smooth = True
sc.render.engine = "BLENDER_EEVEE"; sc.render.film_transparent = True
sc.render.resolution_x = 800; sc.render.resolution_y = 800
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.62, 0.66, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.35; sc.world = w
cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = 2.1; co = bpy.data.objects.new("c", cd); sc.collection.objects.link(co); sc.camera = co
c = Vector((0, 0, 0.85))
for name, az in (("front", 0), ("side34", 40)):
    a = math.radians(az); d = Vector((-math.cos(a), -math.sin(a), 0.1)) if False else Vector((math.sin(a) * 0 + 0, -1, 0.12))
    d = Vector((math.sin(a), -math.cos(a), 0.12)).normalized()
    co.location = c + d * 8; co.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    for i, (loc, e) in enumerate((((2, -3, 4), 600), ((-3, -2, 1.5), 200), ((0, 3, 3), 300))):
        ld = bpy.data.lights.new("l%d" % i, "AREA"); ld.energy = e; ld.size = 3; lo = bpy.data.objects.new("l%d" % i, ld); sc.collection.objects.link(lo); lo.location = loc
        lo.rotation_euler = (c - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = out + "_" + name + ".png"; bpy.ops.render.render(write_still=True)
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]: bpy.data.objects.remove(o)

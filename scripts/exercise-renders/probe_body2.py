import bpy, sys, os, math
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import body

out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
ob, V = body.load_mesh()
LM = body.landmarks(V)
print("VERTS", len(V), "H", round(LM["H"], 3))
for k, v in LM.items():
    if isinstance(v, Vector):
        print("LM", k, tuple(round(c, 3) for c in v))
mat = bpy.data.materials.new("g"); mat.use_nodes = True
b = mat.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (0.66, 0.665, 0.68, 1); b.inputs["Roughness"].default_value = 0.42; b.inputs["Alpha"].default_value = 0.55
mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else None
ob.data.materials.append(mat)
mk = bpy.data.materials.new("m"); mk.use_nodes = True; mk.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 0.1, 0.0, 1); mk.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, 0.1, 0, 1); mk.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 3
for k, v in LM.items():
    if isinstance(v, Vector):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.018, location=v)
        bpy.context.active_object.data.materials.append(mk)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"; sc.render.film_transparent = True
sc.render.resolution_x = 700; sc.render.resolution_y = 700
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[1].default_value = 0.6; sc.world = w
cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = 2.0; co = bpy.data.objects.new("c", cd); sc.collection.objects.link(co); sc.camera = co
c = Vector((0, 0, 0.88))
for name, d in (("front", Vector((1, 0, 0.0))), ("side", Vector((0, -1, 0)))):
    co.location = c + d * 8; co.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    ld = bpy.data.lights.new("k", "SUN"); ld.energy = 3; lo = bpy.data.objects.new("k", ld); sc.collection.objects.link(lo); lo.rotation_euler = (math.radians(50), 0, math.radians(30))
    sc.render.filepath = out + "_" + name + ".png"; bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(lo)

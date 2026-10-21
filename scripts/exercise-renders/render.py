"""Render frames for one or more lifts.  blender -b -P render.py -- --out _renders --slug chest [--stills] [--frames 30] [--size 400]
--stills renders only the start and finish pose. Otherwise a ping-pong loop: start -> finish -> start.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure  # noqa: E402
import lifts  # noqa: E402


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {"out": "_renders", "slug": [], "stills": False, "frames": 30, "size": 400}
    i = 0
    while i < len(a):
        if a[i] == "--stills":
            o["stills"] = True
        elif a[i] == "--slug":
            o["slug"].append(a[i + 1]); i += 1
        elif a[i] in ("--out",):
            o["out"] = a[i + 1]; i += 1
        elif a[i] in ("--frames", "--size"):
            o[a[i][2:]] = int(a[i + 1]); i += 1
        i += 1
    return o


def setup_scene(size, cam):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    try:
        sc.eevee.taa_render_samples = 48
    except Exception:
        pass
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    try:
        sc.view_settings.view_transform = "Standard"
    except Exception:
        pass
    # soft, even studio light from the world, plus a key, a fill and a rim
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.62, 0.64, 0.68, 1)
    bg.inputs[1].default_value = 0.4
    sc.world = w
    az, el = math.radians(cam["az"]), math.radians(cam["el"])
    c = Vector(cam["center"])
    d = Vector((math.cos(az) * math.cos(el), -math.sin(az) * math.cos(el), math.sin(el)))
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cd.ortho_scale = cam["scale"]
    co = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(co)
    co.location = c + d * 8
    co.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    sc.camera = co
    # a soft contact shadow under the figure and machine: a black disc that fades to transparent (so it survives the alpha channel)
    sh = cam.get("shadow", (0.12, 0.95, 0.6))
    bpy.ops.mesh.primitive_plane_add(size=2, location=(sh[0], 0, 0.002))
    gp = bpy.context.active_object
    gp.scale = (sh[1], sh[2], 1)
    gm = bpy.data.materials.new("shadow")
    gm.use_nodes = True
    nt = gm.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ln = nt.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"; mr.clamp = True
    mr.inputs["From Min"].default_value = 0.15; mr.inputs["From Max"].default_value = 1.0
    mr.inputs["To Min"].default_value = 0.55; mr.inputs["To Max"].default_value = 0.0
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    dk = nt.nodes.new("ShaderNodeBsdfDiffuse"); dk.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1)
    mx = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tc.outputs["Object"], ln.inputs[0]); nt.links.new(ln.outputs["Value"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], mx.inputs["Fac"]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(dk.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    gp.data.materials.append(gm)
    gp.visible_shadow = False

    def light(name, kind, energy, loc, size_m, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, kind)
        ld.energy = energy
        ld.color = color
        if kind == "AREA":
            ld.size = size_m
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (c - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    right = Vector((-d.y, d.x, 0)).normalized()  # screen-right on the floor
    light("key", "AREA", 480, c + d * 4 - right * 3 + Vector((0, 0, 3.5)), 3.2)
    light("fill", "AREA", 90, c + d * 4 + right * 3.5 + Vector((0, 0, 1.2)), 4.0, (0.9, 0.95, 1.0))
    light("rim", "AREA", 220, c - d * 4 + right * 2.5 + Vector((0, 0, 2.5)), 2.0, (1.0, 0.97, 0.92))
    return sc


def ease(u):
    return u * u * (3 - 2 * u)


def main():
    o = args()
    for slug in o["slug"]:
        L = lifts.LIFTS[slug]
        sc = setup_scene(o["size"], L["cam"])
        fig = figure.Figure(highlight=L["highlight"], secondary=L.get("secondary", ()))
        update = L["props"]()
        A = L["A"]
        B = dict(A)
        B.update(L["B"])
        out = os.path.join(o["out"], slug)
        os.makedirs(out, exist_ok=True)
        for f in os.listdir(out):
            if f.endswith(".png"):
                os.remove(os.path.join(out, f))
        if o["stills"]:
            seq = [("a", A), ("b", B)]
        else:
            n = o["frames"]
            half = n // 2
            us = [ease(i / half) for i in range(half)] + [ease(1 - i / half) for i in range(half)]
            seq = [("f%03d" % i, figure.lerp_pose(A, B, u)) for i, u in enumerate(us)]
        for name, pose in seq:
            fig.pose(pose)
            update(pose, fig)
            sc.render.filepath = os.path.join(out, name + ".png")
            bpy.ops.render.render(write_still=True)
        print("DONE", slug, len(seq))


if __name__ == "__main__":
    main()

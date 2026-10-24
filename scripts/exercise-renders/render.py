"""Render lifts.  blender -b -P render.py -- --out _renders --slug chest [--video | --poster | --stills] [--size 480] [--fps 30]
--video   a looping MP4 (one rep: lift, hold, lower, rest) on the app's dark background
--poster  a transparent PNG of the peak of the rep (the Library thumbnails and reduced motion)
--stills  start and finish pose, for checking a lift
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figure  # noqa: E402
import lifts  # noqa: E402
import lifts2  # noqa: E402
import lifts3  # noqa: E402
import motion  # noqa: E402

ALL = {**lifts.LIFTS, **lifts2.LIFTS2, **lifts3.LIFTS3}
BG = (11 / 255, 12 / 255, 14 / 255)   # the app's --bg


def srgb_to_linear(c):
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {"out": "_renders", "slug": [], "mode": "video", "size": 480, "fps": 30, "samples": 40, "view": 0, "limit": 0}
    i = 0
    while i < len(a):
        if a[i] in ("--video", "--poster", "--stills"):
            o["mode"] = a[i][2:]
        elif a[i] == "--slug":
            o["slug"].append(a[i + 1]); i += 1
        elif a[i] == "--out":
            o["out"] = a[i + 1]; i += 1
        elif a[i] in ("--size", "--fps", "--samples", "--view", "--limit"):
            o[a[i][2:]] = int(a[i + 1]); i += 1
        i += 1
    return o


def setup_scene(size, cam, transparent=False, samples=40):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    try:
        sc.eevee.taa_render_samples = samples
    except Exception:
        pass
    sc.render.film_transparent = transparent
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    try:
        sc.view_settings.view_transform = "Standard"
    except Exception:
        pass
    # World: lights the scene softly, but the camera sees the app's dark background (not a grey sky)
    w = bpy.data.worlds.new("w")
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    lit = nt.nodes.new("ShaderNodeBackground")
    lit.inputs[0].default_value = (0.55, 0.6, 0.68, 1)
    lit.inputs[1].default_value = 0.34
    dark = nt.nodes.new("ShaderNodeBackground")
    dark.inputs[0].default_value = (*srgb_to_linear(BG), 1)
    dark.inputs[1].default_value = 1.0
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs["Fac"])
    nt.links.new(lit.outputs[0], mx.inputs[1])
    nt.links.new(dark.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
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
    # a soft contact shadow under the figure and machine (a dark disc that fades out)
    sh = cam.get("shadow", (0.12, 0.95, 0.6))
    bpy.ops.mesh.primitive_plane_add(size=2, location=(sh[0], 0, 0.002))
    gp = bpy.context.active_object
    gp.scale = (sh[1], sh[2], 1)
    gm = bpy.data.materials.new("shadow")
    gm.use_nodes = True
    g = gm.node_tree
    for n in list(g.nodes):
        g.nodes.remove(n)
    tc = g.nodes.new("ShaderNodeTexCoord")
    ln = g.nodes.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
    mr = g.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"; mr.clamp = True
    mr.inputs["From Min"].default_value = 0.12; mr.inputs["From Max"].default_value = 1.0
    mr.inputs["To Min"].default_value = 0.7; mr.inputs["To Max"].default_value = 0.0
    tr = g.nodes.new("ShaderNodeBsdfTransparent")
    dk = g.nodes.new("ShaderNodeBsdfDiffuse"); dk.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1)
    sm = g.nodes.new("ShaderNodeMixShader")
    go = g.nodes.new("ShaderNodeOutputMaterial")
    g.links.new(tc.outputs["Object"], ln.inputs[0]); g.links.new(ln.outputs["Value"], mr.inputs["Value"])
    g.links.new(mr.outputs["Result"], sm.inputs["Fac"]); g.links.new(tr.outputs[0], sm.inputs[1]); g.links.new(dk.outputs[0], sm.inputs[2])
    g.links.new(sm.outputs[0], go.inputs["Surface"])
    gp.data.materials.append(gm)
    gp.visible_shadow = False

    def light(name, kind, energy, loc, size_m, color):
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
    light("key", "AREA", 560, c + d * 4 - right * 3 + Vector((0, 0, 3.5)), 3.4, (1.0, 0.92, 0.82))      # warm, from the front-left, high
    light("fill", "AREA", 110, c + d * 4 + right * 3.5 + Vector((0, 0, 1.2)), 4.2, (0.74, 0.87, 1.0))    # cool, soft, opposite
    light("rim", "AREA", 520, c - d * 4 + right * 2.8 + Vector((0, 0, 2.6)), 2.0, (0.78, 0.94, 1.0))     # cool kick from behind to lift the silhouette off the dark
    light("rim2", "AREA", 260, c - d * 3 - right * 3.0 + Vector((0, 0, 1.6)), 2.0, (0.85, 0.95, 1.0))
    return sc


def fit_camera(sc, fig, lift, update, margin=1.2):
    """Frame the figure (and the dumbbells and bars it holds) over the whole rep: centre it and set the ortho scale."""
    cam = sc.camera
    cam_inv = cam.matrix_world.inverted()
    A = lift["A"]
    B = dict(A)
    B.update(lift["B"])
    tempo = lift.get("tempo", motion.TEMPO)
    pts = []
    for t in (0.0, tempo[0] * 0.5, tempo[0] + 0.1):
        P, pulse, u = motion.pose_at(lift, A, B, t)
        fig.pose(P)
        update(P, fig)
        bpy.context.view_layer.update()
        V = np.empty(len(fig.ob.data.vertices) * 3)
        fig.ob.data.vertices.foreach_get("co", V)
        V = V.reshape(-1, 3)[::60]
        pts.extend(Vector(v) for v in V)
        for ob in sc.objects:
            if ob.type == "MESH" and ob is not fig.ob and ob.name.split(".")[0].startswith(("db", "bb", "grip", "bar", "vbar", "rope", "handle", "rail", "plate", "backpad", "seatpad")):
                pts.extend(ob.matrix_world @ Vector(c) for c in ob.bound_box)
    cs = [cam_inv @ p for p in pts]
    xs, ys = [c.x for c in cs], [c.y for c in cs]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    cam.location = cam.matrix_world.to_3x3() @ Vector((cx, cy, 0)) + cam.location
    cam.data.ortho_scale = max(max(xs) - min(xs), max(ys) - min(ys)) * margin


class Drift:
    """A slow, loop-safe orbit of the camera about the vertical axis through the lift's centre, so the figure has depth."""

    def __init__(self, cam, centre, amount_deg=5.0):
        self.cam = cam
        self.c = Vector(centre)
        self.rel = cam.location - self.c
        self.rot = cam.matrix_world.to_3x3().copy()
        self.amount = math.radians(amount_deg)

    def at(self, phase):
        Rz = Matrix.Rotation(self.amount * math.sin(phase), 3, "Z")
        self.cam.location = self.c + Rz @ self.rel
        self.cam.rotation_euler = (Rz @ self.rot).to_euler()


def main():
    o = args()
    for slug in o["slug"]:
        L = ALL[slug]
        mode = o["mode"]
        cam_cfg = dict(L["cam"])
        if o["view"]:                              # the second angle: a quarter turn round
            cam_cfg["az"] = cam_cfg["az"] + L.get("view2", 70)
        sc = setup_scene(o["size"], cam_cfg, transparent=(mode in ("poster", "stills")), samples=o["samples"])
        fig = figure.Figure(highlight=L["highlight"], secondary=L.get("secondary", ()))
        update = L["props"]()
        A = L["A"]
        B = dict(A)
        B.update(L["B"])
        fit_camera(sc, fig, L, update)
        out = os.path.join(o["out"], slug)
        os.makedirs(out, exist_ok=True)
        suffix = "_v2" if o["view"] else ""
        if mode in ("stills", "poster"):
            sc.render.image_settings.file_format = "PNG"
            sc.render.image_settings.color_mode = "RGBA"
            seq = [("a", A, 0.0), ("b", B, 1.0)] if mode == "stills" else [("poster" + suffix, B, 1.0)]
            for name, pose, pulse in seq:
                fig.pose(pose)
                update(pose, fig)
                fig.pulse_node.outputs[0].default_value = pulse
                sc.render.filepath = os.path.join(out, name + ".png")
                bpy.ops.render.render(write_still=True)
            print("DONE", slug, mode)
            continue
        # ---- video
        tempo = L.get("tempo", motion.TEMPO)
        T = motion.duration(tempo)
        fps = o["fps"]
        n = int(round(T * fps))
        sc.render.fps = fps
        sc.frame_start, sc.frame_end = 1, (min(n, o['limit']) if o['limit'] else n)
        drift = Drift(sc.camera, cam_cfg["center"], 5.0)
        try:
            sc.render.image_settings.media_type = "VIDEO"
        except Exception:
            pass
        sc.render.image_settings.file_format = "FFMPEG"
        sc.render.ffmpeg.format = "MPEG4"
        sc.render.ffmpeg.codec = "H264"
        sc.render.ffmpeg.constant_rate_factor = "MEDIUM"
        sc.render.ffmpeg.ffmpeg_preset = "GOOD"
        sc.render.ffmpeg.gopsize = fps
        sc.render.image_settings.color_mode = "RGB"

        def on_frame(scene, *_):
            t = (scene.frame_current - 1) / fps
            pose, pulse, u = motion.pose_at(L, A, B, t)
            fig.pose(pose)
            update(pose, fig)
            fig.pulse_node.outputs[0].default_value = pulse
            drift.at(2 * math.pi * t / T)
            if o['limit']:
                print('FRAME', scene.frame_current, round(t, 2), round(u, 2), tuple(round(c, 3) for c in fig.pos('wristL')), flush=True)

        bpy.app.handlers.frame_change_pre.append(on_frame)
        sc.render.filepath = os.path.join(out, "loop" + suffix)
        bpy.ops.render.render(animation=True)
        bpy.app.handlers.frame_change_pre.remove(on_frame)
        print("DONE", slug, mode, n, "frames")


if __name__ == "__main__":
    main()

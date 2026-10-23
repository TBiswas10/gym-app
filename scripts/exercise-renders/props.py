"""Props: materials and the equipment pieces the lifts need (dark graphite, rounded edges). World: +X forward, +Y left, +Z up."""
import math

import bpy
from mathutils import Euler, Matrix, Vector

from figure import make_mat

_mats = {}


def _pbr(name, base, metallic, rough, bump=None, aniso=0.0, strength=0.15):
    """A physically based material, with a procedural bump so surfaces are not perfectly smooth:
    pad = vinyl grain, chrome = knurling along the bar, frame = brushed streaks."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if aniso and "Anisotropic" in b.inputs:
        b.inputs["Anisotropic"].default_value = aniso
    tc = nt.nodes.new("ShaderNodeTexCoord")
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = 0.003
    if bump == "grain":
        t = nt.nodes.new("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = 160.0
        t.inputs["Detail"].default_value = 6.0
        nt.links.new(tc.outputs["Object"], t.inputs["Vector"])
        nt.links.new(t.outputs["Fac"], bp.inputs["Height"])
    elif bump == "knurl":
        t = nt.nodes.new("ShaderNodeTexWave")
        t.wave_type = "BANDS"
        t.bands_direction = "Z"
        t.inputs["Scale"].default_value = 220.0
        t.inputs["Distortion"].default_value = 0.0
        nt.links.new(tc.outputs["Object"], t.inputs["Vector"])
        nt.links.new(t.outputs["Fac"], bp.inputs["Height"])
    elif bump == "brushed":
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0, 1.0, 90.0)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        t = nt.nodes.new("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = 40.0
        t.inputs["Detail"].default_value = 4.0
        nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        nt.links.new(t.outputs["Fac"], bp.inputs["Height"])
    if bump:
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m


def _mat(kind):
    if kind not in _mats:
        _mats[kind] = {
            "frame": _pbr("frame", (0.16, 0.168, 0.185), 0.92, 0.36, "brushed", 0.5, 0.25),          # anodised aluminium
            "pad": _pbr("pad", (0.042, 0.044, 0.05), 0.0, 0.58, "grain", 0.0, 0.2),                    # vinyl pads
            "chrome": _pbr("chrome", (0.86, 0.88, 0.9), 1.0, 0.14, "knurl", 0.0, 0.35),               # polished steel, knurled
            "plate": _pbr("plate", (0.03, 0.032, 0.037), 0.6, 0.4, "grain", 0.0, 0.08),               # cast iron plates
        }[kind]
    return _mats[kind]


class Cable:
    """A cable that hangs between two points with a little slack, as a chain of thin cylinders re-placed every frame.
    If the far end is a weight-stack pulley, the plates above the pin rise as the cable is pulled out."""

    def __init__(self, name="cable", r=0.0055, n=18, mat="chrome"):
        self.r = r
        self.segs = [cyl_between(f"{name}{i}", (0, 0, 0), (0, 0, 1), r, mat) for i in range(n)]
        self.sag = 0.025
        self.base = None

    def set(self, p0, p1, sag=None):
        p0, p1 = Vector(p0), Vector(p1)
        sag = self.sag if sag is None else sag
        n = len(self.segs)
        pts = [p0 + (p1 - p0) * (i / n) - Vector((0, 0, 4 * sag * (i / n) * (1 - i / n))) for i in range(n + 1)]
        for i, s in enumerate(self.segs):
            place_cyl(s, pts[i], pts[i + 1], self.r)
        L = (p1 - p0).length
        if self.base is None:
            self.base = L
        stack_rise(p1, max(0.0, (L - self.base) * 0.5))


_STACKS = []


def stack_rise(near, r):
    """Lift the plates above the selector pin by r, if a weight stack's pulley is near this point."""
    for st in _STACKS:
        if (st["pulley"] - near).length < 0.25:
            r = min(r, 0.5)
            for i, pl in enumerate(st["plates"]):
                if i >= st["pin"]:
                    pl.location.z = st["z"][i] + r
            if st["vcable"] is not None:
                st["vcable"].set(st["pulley"], Vector((st["pulley"].x, st["pulley"].y, st["plates"][-1].location.z + 0.03)), 0.0)
            return


def box(name, size, loc, rot=(0, 0, 0), mat="frame"):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.dimensions = size
    o.location = loc
    o.rotation_euler = Euler([math.radians(a) for a in rot])
    o.data.materials.append(_mat(mat))
    bpy.ops.object.shade_smooth()
    bv = o.modifiers.new("bevel", "BEVEL")
    bv.width = 0.012
    bv.segments = 3
    return o


def cyl_between(name, p0, p1, r, mat="chrome"):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=1, vertices=24)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(_mat(mat))
    bpy.ops.object.shade_smooth()
    place_cyl(o, p0, p1, r)
    return o


def place_cyl(o, p0, p1, r):
    if isinstance(o, Cable):
        return o.set(p0, p1)
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o.location = (p0 + p1) / 2
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.scale = (r / 1.0 * 1.0, r / 1.0 * 1.0, d.length)
    o.dimensions = (2 * r, 2 * r, d.length)


def grip(fig, s):
    """Where the hand actually holds: a little past the wrist along the forearm."""
    w, e = fig.pos("wrist" + s), fig.pos("elbow" + s)
    return w + (w - e).normalized() * 0.085


def mid(a, b):
    return tuple((a[i] + b[i]) / 2 for i in range(3))



def box_dir(name, size, center, xdir, up=(0, 0, 1), mat="pad", bevel=0.012):
    """A box whose long (local X) side points along xdir."""
    o = box(name, size, center, mat=mat)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector(xdir).to_track_quat("X", "Z")
    return o


def tube(name, p0, p1, r=0.018, mat="frame"):
    return cyl_between(name, p0, p1, r, mat)


def _disc(name, center, r, thick, mat, axis="Y"):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=thick, vertices=40)
    o = bpy.context.active_object
    o.name = name
    o.location = center
    if axis == "Y":
        o.rotation_euler = (math.radians(90), 0, 0)
    elif axis == "X":
        o.rotation_euler = (0, math.radians(90), 0)
    o.data.materials.append(_mat(mat))
    bpy.ops.object.shade_smooth()
    bv = o.modifiers.new("bevel", "BEVEL")
    bv.width = 0.004
    bv.segments = 2
    return o


class Dumbbell:
    """A round-plate dumbbell. Its handle runs along local Y; move it with .place(point, yaw_deg)."""

    def __init__(self, name="db", plate_r=0.092):
        self.root = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(self.root)
        parts = [_disc(name + "_handle", (0, 0, 0), 0.0165, 0.16, "chrome")]
        for s in (-1, 1):
            parts.append(_disc(name + "_collar", (0, s * 0.085, 0), 0.026, 0.02, "chrome"))
            parts.append(_disc(name + "_plate1", (0, s * 0.11, 0), plate_r, 0.034, "plate"))
            parts.append(_disc(name + "_plate2", (0, s * 0.146, 0), plate_r * 0.93, 0.03, "plate"))
            parts.append(_disc(name + "_bolt", (0, s * 0.172, 0), 0.016, 0.022, "chrome"))
        for p in parts:
            p.parent = self.root

    def place(self, point, yaw=0.0, roll=0.0):
        self.root.location = point
        self.root.rotation_euler = (math.radians(roll), 0, math.radians(yaw))


class Barbell:
    """A barbell with round plates; the bar runs along Y. Move with .place(point)."""

    def __init__(self, name="bb", plate_r=0.2, half=0.62):
        self.root = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(self.root)
        parts = [_disc(name + "_bar", (0, 0, 0), 0.014, half * 2 + 0.3, "chrome")]
        for s in (-1, 1):
            parts.append(_disc(name + "_p1", (0, s * (half - 0.05), 0), plate_r, 0.034, "plate"))
            parts.append(_disc(name + "_p2", (0, s * (half - 0.09), 0), plate_r * 0.9, 0.03, "plate"))
            parts.append(_disc(name + "_collar", (0, s * (half - 0.13), 0), 0.03, 0.03, "chrome"))
        for q in parts:
            q.parent = self.root

    def place(self, point):
        self.root.location = point


def cable_tower(x, y=0.0, height=2.15, pulley_z=None):
    """A cable station: uprights, a weight stack of plates on two guide rods with a selector pin, and a pulley at pulley_z. Returns the pulley point."""
    box("tower_post", (0.12, 0.34, height), (x, y, height / 2), mat="frame")
    box("tower_foot", (0.45, 0.46, 0.05), (x - 0.12, y, 0.025), mat="frame")
    plates, zs = [], []
    n_pl, z0, h = 14, 0.12, 0.074
    for i in range(n_pl):
        z = z0 + i * h
        plates.append(box("stack_plate", (0.1, 0.2, 0.062), (x - 0.05, y, z), mat="plate"))
        zs.append(z)
    for sy in (-0.085, 0.085):
        tube("stack_rod", (x - 0.05, y + sy, 0.08), (x - 0.05, y + sy, z0 + n_pl * h), 0.011, "chrome")
    pin = 5
    tube("stack_pin", (x - 0.12, y, zs[pin]), (x + 0.02, y, zs[pin]), 0.012, "chrome")
    pz = pulley_z if pulley_z is not None else height - 0.08
    _disc("pulley", (x - 0.1, y, pz), 0.05, 0.03, "chrome")
    pul = Vector((x - 0.1, y, pz))
    vc = None
    if pz > 1.0:
        vc = Cable("stackcable", 0.004, 6)
        vc.set(pul, Vector((pul.x, pul.y, zs[-1] + 0.03)), 0.0)
        vc.base = 1e9                        # the stack cable does not drive the stack
    _STACKS.append({"pulley": pul, "plates": plates, "z": zs, "pin": pin, "vcable": vc})
    return pul


def line(name, r=0.005, mat="chrome"):
    """A cable you re-aim each frame with place_cyl(obj, p0, p1, r): it hangs with a little slack, and drives a weight stack's plates if it ends at one."""
    return Cable(name, r + 0.0005)

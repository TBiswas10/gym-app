"""Props: materials and the equipment pieces the lifts need (dark graphite, rounded edges). World: +X forward, +Y left, +Z up."""
import math

import bpy
from mathutils import Euler, Matrix, Vector

from figure import make_mat

_mats = {}


def _mat(kind):
    if kind not in _mats:
        _mats[kind] = {
            "frame": make_mat("frame", (0.085, 0.09, 0.1), rough=0.55, metallic=0.2),
            "pad": make_mat("pad", (0.045, 0.047, 0.052), rough=0.8),
            "chrome": make_mat("chrome", (0.5, 0.52, 0.55), rough=0.28, metallic=0.9),
            "plate": make_mat("plate", (0.035, 0.037, 0.042), rough=0.45, metallic=0.5),
        }[kind]
    return _mats[kind]


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
    """A cable station standing at x: two uprights, a weight stack and a pulley at pulley_z (the cable runs from there). Returns the pulley point."""
    box("tower_post", (0.12, 0.30, height), (x, y, height / 2), mat="frame")
    box("tower_stack", (0.10, 0.24, height * 0.62), (x - 0.02, y, height * 0.34), mat="plate")
    box("tower_foot", (0.45, 0.4, 0.05), (x - 0.12, y, 0.025), mat="frame")
    pz = pulley_z if pulley_z is not None else height - 0.08
    wheel = _disc("pulley", (x - 0.1, y, pz), 0.05, 0.03, "chrome")
    return Vector((x - 0.1, y, pz))


def line(name, r=0.005, mat="frame"):
    """A thin cylinder you re-aim each frame with place_cyl(obj, p0, p1, r)."""
    return cyl_between(name, (0, 0, 0), (0, 0, 1), r, mat)

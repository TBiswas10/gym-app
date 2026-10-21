"""The mannequin: a smooth grey figure built from lathed segments on a joint tree (no rig, no weights, no assets).
Everything is made in code, so it is original and repeatable. Runs inside Blender (bpy / bmesh / mathutils).

World axes: +X is the way the figure faces, +Y is its left, +Z is up. The floor is z = 0.
A pose is a plain dict of numbers (see POSE_KEYS); arms and legs are solved with a two-bone IK to the wrist / ankle targets.
"""
import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

# ------------------------------------------------------------------ materials
def make_mat(name, color, rough=0.5, metallic=0.0, emit=None, emit_strength=0.0, spec=0.35):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    for k in ("Specular IOR Level", "Specular"):
        if k in b.inputs:
            b.inputs[k].default_value = spec
    if emit:
        for k in ("Emission Color", "Emission"):
            if k in b.inputs:
                b.inputs[k].default_value = (*emit, 1)
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = emit_strength
    return m


# ------------------------------------------------------------------ lathe (a tapered capsule with elliptical cross-sections)
def _interp(profile, t):
    for i in range(len(profile) - 1):
        t0, *a = profile[i]
        t1, *b = profile[i + 1]
        if t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            u = u * u * (3 - 2 * u)
            return [a[k] + (b[k] - a[k]) * u for k in range(2)]
    return list(profile[-1][1:])


def lathe(name, length, profile, dirsign=-1, seg=48, rings=36, cap=10, keep=None, push=0.0, shift=(0, 0, 0), rot=None, side=1, hot=None):
    """A capsule along local Z (dirsign -1 hangs down from the joint, +1 grows up). Rounded caps overhang each end, so two
    segments that meet at a joint share a ball. `keep(x, y, t, side)` + `push` build a surface patch instead of a whole body."""
    bm = bmesh.new()
    rx0, ry0 = profile[0][1:]
    rx1, ry1 = profile[-1][1:]
    ext0, ext1 = (rx0 + ry0) / 2, (rx1 + ry1) / 2
    stations = []  # (s along axis, radius scale, t)
    for k in range(cap, 0, -1):
        a = k / cap * math.pi / 2
        stations.append((-math.sin(a) * ext0, math.cos(a), 0.0))
    for i in range(rings + 1):
        stations.append((length * i / rings, 1.0, i / rings))
    for k in range(1, cap + 1):
        a = k / cap * math.pi / 2
        stations.append((length + math.sin(a) * ext1, math.cos(a), 1.0))
    rows = []
    for s, sc, t in stations:
        rx, ry = _interp(profile, t)
        if sc < 1e-6:
            v = bm.verts.new((0, 0, dirsign * s))
            rows.append(([v] * seg, t, s))
            continue
        ring = []
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            ring.append(bm.verts.new((rx * sc * math.cos(ph), ry * sc * math.sin(ph), dirsign * s)))
        rows.append((ring, t, s))
    for (r0, t0, s0), (r1, t1, s1) in zip(rows, rows[1:]):
        for j in range(seg):
            j2 = (j + 1) % seg
            vs = [r0[j], r0[j2], r1[j2], r1[j]]
            u = []
            for v in vs:
                if not u or u[-1] is not v:
                    u.append(v)
            if len(u) > 1 and u[0] is u[-1]:
                u.pop()
            if len(u) < 3:
                continue
            try:
                f = bm.faces.new(u)
            except ValueError:
                continue
            f.smooth = True
    if dirsign < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    bm.normal_update()
    if keep is not None:
        drop = []
        for f in bm.faces:
            c = f.calc_center_median()
            t = (c.z * dirsign) / length if length else 0.0
            if keep(c.x, c.y, t, side) < 0.03:
                drop.append(f)
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        for v in [v for v in bm.verts if not v.link_faces]:
            bm.verts.remove(v)
        bm.normal_update()
        for v in bm.verts:
            w = keep(v.co.x, v.co.y, (v.co.z * dirsign) / length if length else 0.0, side)
            v.co += v.normal * (0.0012 + push * max(0.0, min(1.0, w)) ** 0.5)
    if hot:
        layer = bm.verts.layers.float.new("hot")
        for v in bm.verts:
            t = (v.co.z * dirsign) / length if length else 0.0
            v[layer] = max(min(1.0, max(f(v.co.x, v.co.y, t, side) * k for f, k in hot)), 0.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if rot is not None:
        me.transform(rot)
    if shift != (0, 0, 0):
        me.transform(Matrix.Translation(shift))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------ muscles: surface regions on each segment (x forward, y lateral, t 0..1 along the segment)
# keep(x, y, t, side): side is +1 for the left limb, -1 for the right; outward = y * side > 0.
def blob(ang, t, aw, tw, sym=False):
    """Soft elliptical patch: weight 1 at its centre fading to 0 at the edge. ang = degrees around the segment axis
    (0 front, 90 outward, 180 back); sym mirrors it left and right (for the torso)."""
    def w(x, y, tt, side):
        a = math.degrees(math.atan2(y if sym else y * side, x))
        if sym:
            a = abs(a)
        da = (a - ang + 180) % 360 - 180
        r = (da / aw) ** 2 + ((tt - t) / tw) ** 2
        return 1.0 - r if r < 1 else 0.0
    return w


def anyof(*fs):
    return lambda x, y, t, s: max(f(x, y, t, s) for f in fs)


def always(x0=None, x1=None):
    return lambda x, y, t, s: 1.0


MUSCLES = {
    "chest": [("chest", blob(36, 0.6, 50, 0.42, sym=True))],
    "lats": [("chest", blob(112, 0.32, 58, 0.42, sym=True))],
    "midback": [("chest", blob(180, 0.66, 52, 0.36, sym=True))],
    "traps": [("chest", blob(180, 0.97, 60, 0.16, sym=True))],
    "abs": [("lumbar", blob(0, 0.5, 30, 0.55, sym=True)), ("chest", blob(0, 0.08, 30, 0.2, sym=True))],
    "obliques": [("lumbar", blob(80, 0.5, 26, 0.5, sym=True))],
    "glutes": [("pelvis", blob(150, 0.4, 44, 0.5, sym=True))],
    "frontdelt": [("uarm", blob(25, 0.16, 62, 0.3))],
    "sidedelt": [("uarm", blob(90, 0.16, 62, 0.3))],
    "reardelt": [("uarm", blob(155, 0.16, 62, 0.3))],
    "biceps": [("uarm", blob(10, 0.55, 60, 0.4))],
    "triceps": [("uarm", blob(175, 0.55, 70, 0.4))],
    "forearms": [("farm", blob(40, 0.38, 80, 0.42))],
    "quads": [("thigh", blob(0, 0.5, 75, 0.55))],
    "hamstrings": [("thigh", blob(180, 0.5, 72, 0.55))],
    "calves": [("shin", blob(180, 0.3, 55, 0.3))],
}

# segment shapes (length, profile=(t, rx front-back, ry side-side), dirsign)
SEG = {
    "pelvis": dict(length=0.17, dirsign=1, shift=(0, 0, -0.095), profile=[(0, 0.10, 0.145), (0.5, 0.118, 0.165), (1, 0.108, 0.15)]),
    "lumbar": dict(length=0.17, dirsign=1, profile=[(0, 0.1, 0.125), (0.5, 0.09, 0.114), (1, 0.104, 0.14)]),
    "chest": dict(length=0.30, dirsign=1, profile=[(0, 0.104, 0.14), (0.3, 0.13, 0.19), (0.7, 0.124, 0.226), (1, 0.082, 0.13)]),
    "neck": dict(length=0.08, dirsign=1, profile=[(0, 0.062, 0.066), (1, 0.05, 0.05)]),
    "head": dict(length=0.11, dirsign=1, profile=[(0, 0.05, 0.046), (0.3, 0.095, 0.08), (0.7, 0.1, 0.085), (1, 0.085, 0.072)]),
    "uarm": dict(length=0.29, dirsign=-1, profile=[(0, 0.062, 0.062), (0.15, 0.068, 0.066), (0.5, 0.054, 0.05), (1, 0.043, 0.043)]),
    "farm": dict(length=0.26, dirsign=-1, profile=[(0, 0.043, 0.043), (0.2, 0.052, 0.05), (1, 0.032, 0.032)]),
    "hand": dict(length=0.09, dirsign=-1, profile=[(0, 0.03, 0.04), (0.5, 0.022, 0.046), (1, 0.014, 0.03)]),
    "thigh": dict(length=0.43, dirsign=-1, profile=[(0, 0.1, 0.095), (0.3, 0.104, 0.097), (1, 0.064, 0.062)]),
    "shin": dict(length=0.42, dirsign=-1, profile=[(0, 0.064, 0.062), (0.25, 0.078, 0.07), (1, 0.037, 0.037)]),
}
FOOT = dict(length=0.2, dirsign=1, profile=[(0, 0.036, 0.046), (0.5, 0.032, 0.052), (1, 0.026, 0.044)])

JOINTS = {  # name: (parent, local offset)
    "pelvis": (None, (0, 0, 0)),
    "lumbar": ("pelvis", (0, 0, 0.07)),
    "chest": ("lumbar", (0, 0, 0.17)),
    "neck": ("chest", (0, 0, 0.30)),
    "head": ("neck", (0, 0, 0.075)),
    "shoulderL": ("chest", (0, 0.222, 0.255)),
    "shoulderR": ("chest", (0, -0.222, 0.255)),
    "elbowL": ("shoulderL", (0, 0, -0.29)),
    "elbowR": ("shoulderR", (0, 0, -0.29)),
    "wristL": ("elbowL", (0, 0, -0.26)),
    "wristR": ("elbowR", (0, 0, -0.26)),
    "hipL": ("pelvis", (0, 0.095, -0.025)),
    "hipR": ("pelvis", (0, -0.095, -0.025)),
    "kneeL": ("hipL", (0, 0, -0.43)),
    "kneeR": ("hipR", (0, 0, -0.43)),
    "ankleL": ("kneeL", (0, 0, -0.42)),
    "ankleR": ("kneeR", (0, 0, -0.42)),
}
UARM, FARM, THIGH, SHIN = 0.29, 0.26, 0.43, 0.42


def _empty(name):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.02
    bpy.context.scene.collection.objects.link(e)
    e.rotation_mode = "QUATERNION"
    return e


def _two_bone(S, T, a, b, pole):
    """Elbow / knee position for a limb from S to T with segment lengths a, b, bending toward `pole`."""
    d = T - S
    dist = max(abs(a - b) + 1e-4, min(a + b - 1e-4, d.length))
    u = d.normalized()
    n = pole - u * pole.dot(u)
    n = n.normalized() if n.length > 1e-6 else Vector((0, 0, 1))
    ca = (a * a + dist * dist - b * b) / (2 * a * dist)
    ang = math.acos(max(-1.0, min(1.0, ca)))
    E = S + u * (a * math.cos(ang)) + n * (a * math.sin(ang))
    Tc = S + u * dist
    return E, Tc


class Figure:
    def __init__(self, highlight=(), secondary=(), skin=(0.66, 0.665, 0.68), hot=(1.0, 0.36, 0.04)):
        self.mat_skin = self._skin_mat(skin, hot)
        self.mat_shorts = make_mat("shorts", (0.055, 0.058, 0.065), rough=0.7)
        self.hot = {}
        for names, k in ((secondary, 0.55), (highlight, 1.0)):
            for m in names:
                for key, fn in MUSCLES[m]:
                    self.hot.setdefault(key, []).append((fn, k))
        self.j = {}
        for n, (p, off) in JOINTS.items():
            e = _empty("j_" + n)
            if p:
                e.parent = self.j[p]
                e.location = off
            self.j[n] = e
        self._body()

    @staticmethod
    def _skin_mat(skin, hot):
        m = bpy.data.materials.new("skin")
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes["Principled BSDF"]
        b.inputs["Roughness"].default_value = 0.46
        for k in ("Specular IOR Level", "Specular"):
            if k in b.inputs:
                b.inputs[k].default_value = 0.45
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_type = "GEOMETRY"
        at.attribute_name = "hot"
        rng = nt.nodes.new("ShaderNodeMapRange")
        rng.interpolation_type = "SMOOTHSTEP"
        rng.inputs["From Min"].default_value = 0.06
        rng.inputs["From Max"].default_value = 0.7
        rng.clamp = True
        nt.links.new(at.outputs["Fac"], rng.inputs["Value"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["A"].default_value = (*skin, 1)
        mix.inputs["B"].default_value = (*hot, 1)
        nt.links.new(rng.outputs["Result"], mix.inputs["Factor"])
        nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
        for k in ("Emission Color", "Emission"):
            if k in b.inputs:
                nt.links.new(mix.outputs["Result"], b.inputs[k])
                break
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = 0.16
        nt.links.new(rng.outputs["Result"], mul.inputs[0])
        if "Emission Strength" in b.inputs:
            nt.links.new(mul.outputs["Value"], b.inputs["Emission Strength"])
        return m

    # -------- geometry
    def _attach(self, ob, joint, mat):
        ob.parent = self.j[joint]
        ob.data.materials.append(mat)
        for p in ob.data.polygons:
            p.use_smooth = True
        return ob

    def _body(self):
        def seg(key, joint, side=1):
            c = dict(SEG[key])
            c["hot"] = self.hot.get(key)
            ob = lathe(key, side=side, **c)
            self._attach(ob, joint, self.mat_skin)
        seg("pelvis", "pelvis")
        seg("lumbar", "lumbar")
        seg("chest", "chest")
        seg("neck", "neck")
        seg("head", "head")
        rot = Matrix.Rotation(math.radians(90), 4, "Y")
        for s, sd in (("L", 1), ("R", -1)):
            seg("uarm", "shoulder" + s, sd)
            seg("farm", "elbow" + s, sd)
            seg("hand", "wrist" + s, sd)
            seg("thigh", "hip" + s, sd)
            seg("shin", "knee" + s, sd)
            foot = lathe("foot", rot=rot, shift=(-0.05, 0, -0.04), **FOOT)
            self._attach(foot, "ankle" + s, self.mat_skin)
            # shorts: a dark skin over the pelvis and the top of each thigh
            if s == "L":
                sh = lathe("shorts_p", keep=lambda x, y, t, s_: 1.0 if t < 0.8 else 0.0, push=0.007, **SEG["pelvis"])
                self._attach(sh, "pelvis", self.mat_shorts)
            th = lathe("shorts_t", keep=lambda x, y, t, s_: 1.0 if t < 0.4 else 0.0, push=0.007, **SEG["thigh"])
            self._attach(th, "hip" + s, self.mat_shorts)

    # -------- posing
    def _upd(self):
        bpy.context.view_layer.update()

    def _world_dir(self, joint, vec, up=Vector((0, 1, 0))):
        """Rotate `joint` so its local -Z points along world `vec` (roll keeps local Y near `up`)."""
        z = (-vec).normalized()
        x = up.cross(z)
        if x.length < 1e-6:
            x = Vector((1, 0, 0))
        x.normalize()
        y = z.cross(x)
        w = Matrix(((x.x, y.x, z.x), (x.y, y.y, z.y), (x.z, y.z, z.z)))
        par = self.j[joint].parent.matrix_world.to_3x3().normalized()
        self.j[joint].rotation_quaternion = (par.inverted() @ w).to_quaternion()
        self._upd()

    def _world_euler(self, joint, eul):
        w = Euler(eul).to_matrix()
        par = self.j[joint].parent.matrix_world.to_3x3().normalized()
        self.j[joint].rotation_quaternion = (par.inverted() @ w).to_quaternion()
        self._upd()

    def pos(self, joint):
        return self.j[joint].matrix_world.translation.copy()

    def pose(self, P):
        j = self.j
        j["pelvis"].location = Vector(P["pelvis"])
        j["pelvis"].rotation_quaternion = Euler((0, math.radians(P.get("pelvis_pitch", 0)), 0)).to_quaternion()
        for n in ("lumbar", "chest", "neck", "head"):
            j[n].rotation_quaternion = Euler((0, math.radians(P.get(n, 0)), 0)).to_quaternion()
        self._upd()
        for s, sd in (("L", 1), ("R", -1)):
            # arm
            S = self.pos("shoulder" + s)
            T = Vector(P["hand" + s])
            pole = Vector(P.get("arm_pole", (-0.5, 0.3, -0.8)))
            pole = Vector((pole.x, pole.y * sd, pole.z))
            E, Tc = _two_bone(S, T, UARM, FARM, pole)
            self._world_dir("shoulder" + s, E - S)
            self._world_dir("elbow" + s, Tc - E)
            self._world_dir("wrist" + s, Tc - E)
            # leg
            H = self.pos("hip" + s)
            A = Vector(P["ankle" + s])
            lp = Vector(P.get("leg_pole", (1.0, 0.15, 0.0)))
            lp = Vector((lp.x, lp.y * sd, lp.z))
            K, Ac = _two_bone(H, A, THIGH, SHIN, lp)
            self._world_dir("hip" + s, K - H)
            self._world_dir("knee" + s, Ac - K)
            self._world_euler("ankle" + s, (0, math.radians(P.get("foot", 0)), 0))
        self._upd()


POSE_KEYS = ("pelvis", "pelvis_pitch", "lumbar", "chest", "neck", "head", "handL", "handR", "ankleL", "ankleR", "foot", "arm_pole", "leg_pole")


def lerp_pose(A, B, u):
    out = {}
    for k in A:
        a, b = A[k], B.get(k, A[k])
        if isinstance(a, (tuple, list)):
            out[k] = tuple(a[i] + (b[i] - a[i]) * u for i in range(len(a)))
        else:
            out[k] = a + (b - a) * u
    return out

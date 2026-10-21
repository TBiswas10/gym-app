"""The mannequin: the sculpted male base mesh (Blender Studio "Human Base Meshes", CC0) skinned to our joint tree.

World axes: +X is the way the figure faces, +Y is its left, +Z is up. The floor is z = 0.
A pose is a plain dict of numbers (see POSE_KEYS); arms and legs are solved with a two-bone IK to the wrist / ankle targets.

Skinning is done here, not with a Blender armature: every mesh vertex has weights for a few bones, and each frame the vertices are
blended from the joint empties' matrices (linear blend skinning in numpy). Weights come from the distance to each bone's
segments, smoothed over the mesh. The material paints the shorts and the working muscle with ellipsoid "region" empties.
"""
import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

import body as bodymod

BONES = ["pelvis", "lumbar", "chest", "neck", "head",
         "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR",
         "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"]
PARENT = {"lumbar": "pelvis", "chest": "lumbar", "neck": "chest", "head": "neck",
          "shoulderL": "chest", "shoulderR": "chest", "elbowL": "shoulderL", "elbowR": "shoulderR",
          "wristL": "elbowL", "wristR": "elbowR", "hipL": "pelvis", "hipR": "pelvis",
          "kneeL": "hipL", "kneeR": "hipR", "ankleL": "kneeL", "ankleR": "kneeR"}
NEXT = {"pelvis": "lumbar", "lumbar": "chest", "chest": "neck", "neck": "head", "head": "head",
        "shoulderL": "elbowL", "shoulderR": "elbowR", "elbowL": "wristL", "elbowR": "wristR", "wristL": "wristL", "wristR": "wristR",
        "hipL": "kneeL", "hipR": "kneeR", "kneeL": "ankleL", "kneeR": "ankleR", "ankleL": "ankleL", "ankleR": "ankleR"}

# Highlight regions: where a glow ellipsoid meets the skin, the skin lights up.
# (bone, t along the bone, world offset in the rest pose, half-extents in the bone's axes). "Y" in the lateral offset = both sides, mirrored; "S" = outward on the limb's own side.
REGIONS = {
    # (bone, t along the bone, rest-pose world offset, half-extents, tilt in degrees about the bone's X axis (mirrored on the right side))
    "frontdelt": [("shoulder", 0.1, (0.055, 0.0, 0.0), (0.055, 0.06, 0.08), 0)],
    "sidedelt": [("shoulder", 0.1, (0.0, "S0.07", 0.0), (0.055, 0.055, 0.08), 0)],
    "reardelt": [("shoulder", 0.1, (-0.06, 0.0, 0.0), (0.055, 0.06, 0.08), 0)],
    "biceps": [("shoulder", 0.55, (0.06, 0.0, 0.0), (0.05, 0.06, 0.1), 0)],
    "triceps": [("shoulder", 0.55, (-0.06, 0.0, 0.0), (0.05, 0.06, 0.11), 0)],
    "forearms": [("elbow", 0.4, (0.0, 0.0, 0.0), (0.065, 0.065, 0.15), 0)],
    "quads": [("hip", 0.5, (0.085, 0.0, 0.0), (0.08, 0.1, 0.19), 0)],
    "hamstrings": [("hip", 0.5, (-0.09, 0.0, 0.0), (0.075, 0.1, 0.19), 0)],
    "calves": [("knee", 0.3, (-0.075, 0.0, 0.0), (0.065, 0.08, 0.13), 0)],
}
# Torso muscles are anchored to the mesh surface: (bone, face, y, z, inset, half-extents (depth, lateral, vertical), tilt about the bone's X axis, mirrored left/right)
# face "front" / "back" finds the skin at that (y, z); the glow ellipsoid is centred `inset` below the skin.
TORSO = {
    "chest": [("chest", "front", 0.1, 1.3, 0.03, (0.07, 0.115, 0.08), 22, True)],
    "lats": [("chest", "back", 0.16, 1.2, 0.03, (0.07, 0.085, 0.17), -14, True)],
    "midback": [("chest", "back", 0.0, 1.28, 0.03, (0.06, 0.12, 0.1), 0, False)],
    "traps": [("chest", "back", 0.0, 1.42, 0.03, (0.06, 0.15, 0.07), 0, False), ("chest", "back", 0.0, 1.32, 0.03, (0.06, 0.07, 0.11), 0, False)],
    "abs": [("lumbar", "front", 0.0, 1.12, 0.03, (0.05, 0.075, 0.15), 0, False)],
    "obliques": [("lumbar", "side", 0.0, 1.07, 0.03, (0.07, 0.04, 0.11), 0, True)],
    "glutes": [("pelvis", "back", 0.095, 0.93, 0.035, (0.07, 0.095, 0.1), 0, True)],
}
# Shorts: ellipsoids that cover the pelvis and the top of each thigh.
SHORTS = [("pelvis", 0.0, (0.0, 0.0, -0.03), (0.21, 0.25, 0.12)), ("hip", 0.3, (0.0, 0.0, 0.0), (0.16, 0.16, 0.17))]


def _y(v, side):
    return float(v[1:]) * side if isinstance(v, str) else v


def _empty(name, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.02
    bpy.context.scene.collection.objects.link(e)
    e.rotation_mode = "QUATERNION"
    if parent is not None:
        e.parent = parent
    return e


def _two_bone(S, T, a, b, pole):
    d = T - S
    dist = max(abs(a - b) + 1e-4, min(a + b - 1e-4, d.length))
    u = d.normalized()
    n = pole - u * pole.dot(u)
    n = n.normalized() if n.length > 1e-6 else Vector((0, 0, 1))
    ca = (a * a + dist * dist - b * b) / (2 * a * dist)
    ang = math.acos(max(-1.0, min(1.0, ca)))
    E = S + u * (a * math.cos(ang)) + n * (a * math.sin(ang))
    return E, S + u * dist


def _seg_dist(V, a, b):
    ab = b - a
    t = np.clip(((V - a) @ ab) / max(float(ab @ ab), 1e-9), 0.0, 1.0)
    return np.linalg.norm(V - (a + t[:, None] * ab), axis=1)


class Figure:
    def __init__(self, highlight=(), secondary=(), skin=(0.6, 0.605, 0.62), hot=(0.95, 0.31, 0.04), shorts=(0.05, 0.053, 0.06)):
        self.ob, self.V0 = bodymod.load_mesh()
        LM = bodymod.landmarks(self.V0)
        LM["shoulderL"] = Vector((0.015, 0.192, 1.392))
        LM["shoulderR"] = Vector((0.015, -0.192, 1.392))
        LM["head"] = Vector((LM["head"].x - 0.01, 0.0, 1.515))
        pos = {b: Vector(LM[b]) for b in BONES}
        top = Vector((LM["head"].x + 0.01, 0, LM["z0"] + LM["H"]))
        self.rest_pos = pos
        self.UARM = (pos["elbowL"] - pos["shoulderL"]).length
        self.FARM = (pos["wristL"] - pos["elbowL"]).length
        self.THIGH = (pos["kneeL"] - pos["hipL"]).length
        self.SHIN = (pos["ankleL"] - pos["kneeL"]).length
        self.j = {b: _empty("j_" + b) for b in BONES}
        for b, p in PARENT.items():
            self.j[b].parent = self.j[p]
        self._rest_pose(pos)
        self.Rinv = {b: np.array(self.j[b].matrix_world.inverted()) for b in BONES}
        self._weights(pos, top)
        self._regions = []
        for names, k in ((secondary, 0.5), (highlight, 1.0)):
            for m in names:
                for bone, t, off, hs, tilt in REGIONS.get(m, []):
                    for jn, sd in self._places(bone, off[1]):
                        self._regions.append((self._region(f"r_{m}_{jn}_{sd}", jn, t, off, hs, sd, tilt), k))
                for bone, face, y, z, inset, hs, tilt, mirror in TORSO.get(m, []):
                    for sd in ((1, -1) if mirror else (1,)):
                        self._regions.append((self._torso_region(f"r_{m}_{bone}_{sd}", bone, face, y * sd, z, inset, hs, tilt * sd), k))
        self._shorts = []
        for bone, t, off, hs in SHORTS:
            for jn, sd in self._places(bone, off[1]):
                self._shorts.append(self._region(f"sh_{jn}_{sd}", jn, t, off, hs, sd))
        self.ob.data.materials.append(self._material(skin, hot, shorts))

    # ------------------------------------------------------------ rest pose and weights
    def _rest_pose(self, pos):
        j = self.j
        up = bpy.context.view_layer.update
        j["pelvis"].location = pos["pelvis"]
        for b in ("lumbar", "chest", "neck", "head"):
            j[b].location = pos[b] - pos[PARENT[b]]
        for s in "LR":
            j["shoulder" + s].location = pos["shoulder" + s] - pos["chest"]
            j["hip" + s].location = pos["hip" + s] - pos["pelvis"]
        up()
        for s in "LR":
            self._world_dir("shoulder" + s, pos["elbow" + s] - pos["shoulder" + s])
            j["elbow" + s].location = (0, 0, -(pos["elbow" + s] - pos["shoulder" + s]).length)
            up()
            self._world_dir("elbow" + s, pos["wrist" + s] - pos["elbow" + s])
            j["wrist" + s].location = (0, 0, -(pos["wrist" + s] - pos["elbow" + s]).length)
            up()
            self._world_dir("wrist" + s, pos["wrist" + s] - pos["elbow" + s])
            self._world_dir("hip" + s, pos["knee" + s] - pos["hip" + s])
            j["knee" + s].location = (0, 0, -(pos["knee" + s] - pos["hip" + s]).length)
            up()
            self._world_dir("knee" + s, pos["ankle" + s] - pos["knee" + s])
            j["ankle" + s].location = (0, 0, -(pos["ankle" + s] - pos["knee" + s]).length)
            up()
        up()

    def _weights(self, pos, top):
        V = self.V0
        P = {b: np.array(pos[b]) for b in BONES}
        T = np.array(top)
        toe = {s: P["ankle" + s] + np.array([0.2, 0.0, -0.05]) for s in "LR"}
        segs = {
            "pelvis": [(P["pelvis"], P["lumbar"]), (P["pelvis"], P["hipL"]), (P["pelvis"], P["hipR"])],
            "lumbar": [(P["lumbar"], P["chest"])],
            "chest": [(P["chest"], P["neck"]), (P["chest"], P["shoulderL"]), (P["chest"], P["shoulderR"])],
            "neck": [(P["neck"], P["head"])],
            "head": [(P["head"], T)],
        }
        for s in "LR":
            segs["shoulder" + s] = [(P["shoulder" + s], P["elbow" + s])]
            segs["elbow" + s] = [(P["elbow" + s], P["wrist" + s])]
            segs["wrist" + s] = [(P["wrist" + s], P["wrist" + s] + (P["wrist" + s] - P["elbow" + s]) * 0.8)]
            segs["hip" + s] = [(P["hip" + s], P["knee" + s])]
            segs["knee" + s] = [(P["knee" + s], P["ankle" + s])]
            segs["ankle" + s] = [(P["ankle" + s], toe[s])]
        D = np.stack([np.minimum.reduce([_seg_dist(V, a, b) for a, b in segs[b]]) for b in BONES], axis=1)
        dmin = D.min(axis=1, keepdims=True)
        W = 1.0 / (D + 0.012) ** 5
        W[D > dmin * 1.8 + 0.03] = 0.0
        W /= W.sum(axis=1, keepdims=True)
        me = self.ob.data
        ne = len(me.edges)
        ed = np.empty(ne * 2, dtype=np.int64)
        me.edges.foreach_get("vertices", ed)
        ed = ed.reshape(ne, 2)
        deg = np.bincount(ed.ravel(), minlength=len(V)).astype(np.float64)[:, None]
        for _ in range(6):
            S = np.zeros_like(W)
            np.add.at(S, ed[:, 0], W[ed[:, 1]])
            np.add.at(S, ed[:, 1], W[ed[:, 0]])
            W = 0.5 * W + 0.5 * S / np.maximum(deg, 1)
        W /= np.maximum(W.sum(axis=1, keepdims=True), 1e-9)
        W[W < 0.01] = 0.0
        W /= W.sum(axis=1, keepdims=True)
        self.W = W
        self.active = [i for i in range(len(BONES)) if W[:, i].max() > 0]

    def _skin(self):
        V = self.V0
        out = np.zeros_like(V)
        for i in self.active:
            b = BONES[i]
            A = np.array(self.j[b].matrix_world) @ self.Rinv[b]
            out += self.W[:, i:i + 1] * (V @ A[:3, :3].T + A[:3, 3])
        self.ob.data.vertices.foreach_set("co", out.ravel())
        self.ob.data.update()

    # ------------------------------------------------------------ regions and material
    @staticmethod
    def _places(bone, y):
        if bone in BONES:
            return [(bone, 1), (bone, -1)] if isinstance(y, str) and y[0] == "Y" else [(bone, 1)]
        return [(bone + "L", 1), (bone + "R", -1)]

    def _region(self, name, joint, t, off, hs, side, tilt=0):
        """An empty at a point on the bone (t along it) plus a world-axis offset in the REST pose, fixed to the bone so it moves with it."""
        a = self.rest_pos[joint]
        b = self.rest_pos[NEXT[joint]]
        world = a + (b - a) * t + Vector((off[0], _y(off[1], side), off[2]))
        e = _empty(name, self.j[joint])
        e.location = self.j[joint].matrix_world.inverted() @ world
        e.rotation_mode = "XYZ"
        e.rotation_euler = (math.radians(tilt * side), 0, 0)
        e.scale = hs
        return e

    def _surface(self, face, y, z):
        """The skin position at lateral y and height z on the front, the back or the side of the torso (rest pose)."""
        V = self.V0
        if face == "side":
            m = (np.abs(V[:, 1] - 0) < 9) & (np.abs(V[:, 2] - z) < 0.02) & (np.abs(V[:, 0] - self.rest_pos["lumbar"].x) < 0.04) & (V[:, 1] * (1 if y >= 0 else -1) > 0.05) & (np.abs(V[:, 1]) < 0.235)
            P = V[m]
            i = np.argmax(np.abs(P[:, 1]))
            return Vector(P[i]), Vector((0, 1 if y >= 0 else -1, 0))
        m = (np.abs(V[:, 1] - y) < 0.02) & (np.abs(V[:, 2] - z) < 0.02)
        P = V[m]
        if len(P) == 0:
            raise RuntimeError(f"no skin near y={y} z={z}")
        if face == "front":
            i = np.argmax(P[:, 0]); n = Vector((1, 0, 0))
        else:
            i = np.argmin(P[:, 0]); n = Vector((-1, 0, 0))
        return Vector(P[i]), n

    def _torso_region(self, name, joint, face, y, z, inset, hs, tilt):
        p, n = self._surface(face, y, z)
        world = p - n * inset
        e = _empty(name, self.j[joint])
        e.location = self.j[joint].matrix_world.inverted() @ world
        e.rotation_mode = "XYZ"
        e.rotation_euler = (math.radians(tilt), 0, 0)
        e.scale = hs
        return e

    def _material(self, skin, hot, shorts):
        m = bpy.data.materials.new("skin")
        m.use_nodes = True
        nt = m.node_tree
        N, L = nt.nodes, nt.links
        b = N["Principled BSDF"]
        b.inputs["Roughness"].default_value = 0.55
        for k in ("Specular IOR Level", "Specular"):
            if k in b.inputs:
                b.inputs[k].default_value = 0.22
        for k in ("Coat Weight", "Clearcoat"):
            if k in b.inputs:
                b.inputs[k].default_value = 0.0

        def region_w(empty, level, inner, outer):
            tc = N.new("ShaderNodeTexCoord")
            tc.object = empty
            ln = N.new("ShaderNodeVectorMath")
            ln.operation = "LENGTH"
            L.new(tc.outputs["Object"], ln.inputs[0])
            rg = N.new("ShaderNodeMapRange")
            rg.clamp = True
            rg.interpolation_type = "SMOOTHSTEP"
            rg.inputs["From Min"].default_value = inner
            rg.inputs["From Max"].default_value = outer
            rg.inputs["To Min"].default_value = level
            rg.inputs["To Max"].default_value = 0.0
            L.new(ln.outputs["Value"], rg.inputs["Value"])
            return rg.outputs["Result"]

        def combine(outs):
            if not outs:
                return None
            cur = outs[0]
            for o in outs[1:]:
                mx = N.new("ShaderNodeMath")
                mx.operation = "MAXIMUM"
                L.new(cur, mx.inputs[0])
                L.new(o, mx.inputs[1])
                cur = mx.outputs["Value"]
            return cur

        sh_w = combine([region_w(e, 1.0, 0.92, 1.0) for e in self._shorts])
        hot_w = combine([region_w(e, k, 0.84, 1.0) for e, k in self._regions])
        col = N.new("ShaderNodeRGB")
        col.outputs[0].default_value = (*skin, 1)
        cur = col.outputs[0]
        if sh_w is not None:
            mix = N.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.inputs["B"].default_value = (*shorts, 1)
            L.new(cur, mix.inputs["A"])
            L.new(sh_w, mix.inputs["Factor"])
            cur = mix.outputs["Result"]
        if hot_w is not None:
            mix = N.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.inputs["B"].default_value = (*hot, 1)
            L.new(cur, mix.inputs["A"])
            L.new(hot_w, mix.inputs["Factor"])
            cur = mix.outputs["Result"]
            mul = N.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            mul.inputs[1].default_value = 0.22
            L.new(hot_w, mul.inputs[0])
            for k in ("Emission Color", "Emission"):
                if k in b.inputs:
                    L.new(mix.outputs["Result"], b.inputs[k])
                    break
            if "Emission Strength" in b.inputs:
                L.new(mul.outputs["Value"], b.inputs["Emission Strength"])
        ao = N.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.09
        ao.samples = 8
        ramp = N.new("ShaderNodeMapRange")
        ramp.clamp = True
        ramp.inputs["From Min"].default_value = 0.0
        ramp.inputs["From Max"].default_value = 1.0
        ramp.inputs["To Min"].default_value = 0.55
        ramp.inputs["To Max"].default_value = 1.0
        L.new(ao.outputs["AO"], ramp.inputs["Value"])
        dim = N.new("ShaderNodeMix")
        dim.data_type = "RGBA"
        dim.blend_type = "MULTIPLY"
        dim.inputs["Factor"].default_value = 1.0
        L.new(cur, dim.inputs["A"])
        L.new(ramp.outputs["Result"], dim.inputs["B"])
        L.new(dim.outputs["Result"], b.inputs["Base Color"])
        return m

    # ------------------------------------------------------------ posing
    def _upd(self):
        bpy.context.view_layer.update()

    def _world_dir(self, joint, vec, up=Vector((0, 1, 0))):
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
            S = self.pos("shoulder" + s)
            T = Vector(P["hand" + s])
            pole = Vector(P.get("arm_pole", (-0.5, 0.3, -0.8)))
            pole = Vector((pole.x, pole.y * sd, pole.z))
            E, Tc = _two_bone(S, T, self.UARM, self.FARM, pole)
            self._world_dir("shoulder" + s, E - S)
            self._world_dir("elbow" + s, Tc - E)
            self._world_dir("wrist" + s, Tc - E)
            H = self.pos("hip" + s)
            A = Vector(P["ankle" + s])
            lp = Vector(P.get("leg_pole", (1.0, 0.15, 0.0)))
            lp = Vector((lp.x, lp.y * sd, lp.z))
            K_, Ac = _two_bone(H, A, self.THIGH, self.SHIN, lp)
            self._world_dir("hip" + s, K_ - H)
            self._world_dir("knee" + s, Ac - K_)
            self._world_euler("ankle" + s, (0, math.radians(P.get("foot", 0)), 0))
        self._upd()
        self._skin()


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


def make_mat(name, color, rough=0.5, metallic=0.0, spec=0.35):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    for k in ("Specular IOR Level", "Specular"):
        if k in b.inputs:
            b.inputs[k].default_value = spec
    return m

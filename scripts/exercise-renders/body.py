"""Loads the sculpted male base mesh (Blender Studio "Human Base Meshes", CC0), puts it in our world and finds its joints.

World: +X forward, +Y the figure's left, +Z up, feet at z = 0. The bundle is NOT in the repo; set HBM_BLEND (env) or pass the path.
"""
import math
import os

import bpy
import numpy as np
from mathutils import Matrix, Vector

BLEND = os.environ.get("HBM_BLEND", r"C:\Users\tirth\AppData\Local\Temp\claude\C--Users-tirth-Documents-gym-app\ab47a978-1f8c-4f0b-b59d-fe0592d41fb9\scratchpad\hbm\x\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend")
SCALE = 1.04          # the mesh is 1.69 m; props are built for about 1.76 m
SUBDIV_LEVEL = 3      # of the mesh's 3 multires levels (all of them: this is where the muscle detail is)


def load_mesh():
    """The body as a plain mesh object in our world (faces +X, feet on the floor). Returns (object, verts as an (N, 3) array)."""
    with bpy.data.libraries.load(BLEND, link=False) as (src, dst):
        dst.collections = ["Body Male - Realistic"]
    coll = dst.collections[0]
    src_ob = bpy.data.objects["GEO-body_male_realistic"]
    src_ob.location = (0, 0, 0)
    for m in src_ob.modifiers:
        if m.type == "MULTIRES":
            m.levels = SUBDIV_LEVEL
            m.render_levels = SUBDIV_LEVEL
    tmp = bpy.context.scene.collection
    tmp.children.link(coll)
    bpy.context.view_layer.update()
    ev = src_ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    me = bpy.data.meshes.new_from_object(ev)
    me.transform(Matrix.Scale(SCALE, 4) @ Matrix.Rotation(math.radians(90), 4, "Z"))
    _swap_head(me)
    n0 = len(me.vertices)
    arr0 = np.empty(n0 * 3)
    me.vertices.foreach_get("co", arr0)
    if os.path.exists(CACHE) and np.load(CACHE).shape == (n0, 3):
        V1 = np.load(CACHE)
    else:
        V1 = _shape(me, arr0.reshape(n0, 3).copy())
        np.save(CACHE, V1)
    me.vertices.foreach_set("co", V1.ravel())
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("BodyMesh", me)
    bpy.context.scene.collection.objects.link(ob)
    for o in list(coll.all_objects):
        bpy.data.objects.remove(o)
    tmp.children.unlink(coll)
    n = len(me.vertices)
    arr = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get("co", arr)
    arr = arr.reshape(n, 3)
    return ob, arr


CACHE = os.environ.get("HBM_CACHE", os.path.join(os.path.dirname(BLEND), "body_v7.npy"))


HEAD_CUT = 1.5


def _swap_head(me):
    """Cut the sculpted face off at the jaw line and grow a smooth, faceless head out of the real neck: one seamless surface that starts
    exactly as wide as the neck and flares out to an egg. (Built from rings, so there are no seams and no stray pieces.)"""
    import bmesh
    n = len(me.vertices)
    arr = np.empty(n * 3)
    me.vertices.foreach_get("co", arr)
    V = arr.reshape(n, 3)
    top = float(V[:, 2].max())
    ring = V[(np.abs(V[:, 2] - HEAD_CUT) < 0.012) & (np.abs(V[:, 1]) < 0.075)]
    rcx, rcy = float(ring[:, 0].mean()), float(ring[:, 1].mean())
    rrx = float(np.percentile(np.abs(ring[:, 0] - rcx), 92))
    rry = float(np.percentile(np.abs(ring[:, 1] - rcy), 92))
    bm = bmesh.new()
    bm.from_mesh(me)
    drop = [f for f in bm.faces if f.calc_center_median().z > HEAD_CUT]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    for v in [v for v in bm.verts if not v.link_faces]:
        bm.verts.remove(v)
    # profile: (height, half-width front-back, half-width side-side, forward shift of the centre)
    hx, hy = 0.1, 0.082
    prof = [
        (HEAD_CUT - 0.035, rrx * 0.9, rry * 0.9, 0.0),
        (HEAD_CUT, rrx * 1.06, rry * 1.06, 0.0),
        (HEAD_CUT + 0.03, 0.078, 0.07, 0.012),
        (HEAD_CUT + 0.065, 0.094, 0.079, 0.022),
        (HEAD_CUT + 0.11, hx, hy, 0.028),
        (HEAD_CUT + 0.16, 0.098, 0.081, 0.028),
        (HEAD_CUT + 0.2, 0.086, 0.072, 0.026),
        (HEAD_CUT + 0.235, 0.06, 0.05, 0.022),
        (top - 0.006, 0.026, 0.022, 0.02),
        (top, 0.0, 0.0, 0.02),
    ]
    zs = np.array([p[0] for p in prof])
    cols = np.array([[p[1], p[2], p[3]] for p in prof])
    ring_n = 64
    levels = np.linspace(zs[0], zs[-1], 56)
    dense = np.stack([np.interp(levels, zs, cols[:, k]) for k in range(3)], axis=1)
    for k in range(3):                                     # round off the corners of the piecewise-linear profile
        for _ in range(3):
            dense[1:-1, k] = (dense[:-2, k] + 2 * dense[1:-1, k] + dense[2:, k]) / 4
    rows = []
    for z, (rx, ry, sh) in zip(levels, dense):
        if rx < 1e-4:
            rows.append([bm.verts.new((rcx + sh, rcy, z))] * ring_n)
            continue
        rows.append([bm.verts.new((rcx + sh + rx * math.cos(2 * math.pi * j / ring_n), rcy + ry * math.sin(2 * math.pi * j / ring_n), z)) for j in range(ring_n)])
    for r0, r1 in zip(rows, rows[1:]):
        for j in range(ring_n):
            j2 = (j + 1) % ring_n
            vs = []
            for v in (r0[j], r0[j2], r1[j2], r1[j]):
                if not vs or vs[-1] is not v:
                    vs.append(v)
            if len(vs) > 1 and vs[0] is vs[-1]:
                vs.pop()
            if len(vs) >= 3:
                try:
                    bm.faces.new(vs)
                except ValueError:
                    pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()


def _edges(me):
    ne = len(me.edges)
    ed = np.empty(ne * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", ed)
    return ed.reshape(ne, 2)


def _taubin(V, ed, w, iters=40, lam=0.5, mu=-0.53):
    """Smooth the vertices weighted by w (0..1) without shrinking: the face features melt into one smooth surface, the neck and jaw stay."""
    deg = np.maximum(np.bincount(ed.ravel(), minlength=len(V)).astype(np.float64), 1)[:, None]
    for _ in range(iters):
        for f in (lam, mu):
            S = np.zeros_like(V)
            np.add.at(S, ed[:, 0], V[ed[:, 1]])
            np.add.at(S, ed[:, 1], V[ed[:, 0]])
            V = V + f * w[:, None] * (S / deg - V)
    return V


def _shape(me, V):
    """Curl the fingers into fists (they hold the handles)."""
    L = landmarks(V)
    for s, sgn in (("L", -1.0), ("R", 1.0)):
        wr, el = np.array(L["wrist" + s]), np.array(L["elbow" + s])
        u = (wr - el) / np.linalg.norm(wr - el)
        rel = V - wr
        along = rel @ u
        perp = np.linalg.norm(rel - np.outer(along, u), axis=1)
        hand = (along > -0.01) & (perp < 0.075) & (np.abs(V[:, 1]) > 0.3)
        pivot = wr + u * 0.03
        t = np.clip((along - 0.03) / 0.06, 0.0, 1.0)
        phi = sgn * 1.75 * t
        idx = np.where(hand & (t > 0))[0]
        r = V[idx] - pivot
        c, sn = np.cos(phi[idx]), np.sin(phi[idx])
        y2 = r[:, 1] * c - r[:, 2] * sn
        z2 = r[:, 1] * sn + r[:, 2] * c
        V[idx] = pivot + np.stack([r[:, 0], y2, z2], axis=1)
    return V


def _centroid(V, zc, xlo, xhi, half=0.012, side=1):
    """Centre of the part of the figure near height zc whose lateral position (y, after rotation) lies in [xlo, xhi]."""
    m = (np.abs(V[:, 2] - zc) < half) & (V[:, 1] * side >= xlo) & (V[:, 1] * side <= xhi)
    return V[m].mean(axis=0)


def landmarks(V):
    """Joint positions (world, left side listed as L; right mirrored) from the rest pose. Heights are anthropometric
    ratios of the figure's height; lateral positions come from cross-sections of the mesh."""
    H = V[:, 2].max() - V[:, 2].min()
    z0 = V[:, 2].min()
    def z(r):
        return z0 + H * r
    L = {}
    L["hip"] = Vector(_centroid(V, z(0.515), 0.04, 0.2))
    L["knee"] = Vector(_centroid(V, z(0.285), 0.04, 0.2))
    L["ankle"] = Vector(_centroid(V, z(0.045), 0.04, 0.2))
    L["shoulder"] = Vector(_centroid(V, z(0.805), 0.12, 0.3, 0.02))
    L["elbow"] = Vector(_centroid(V, z(0.63), 0.2, 0.7, 0.015))
    L["wrist"] = Vector(_centroid(V, z(0.475), 0.2, 0.8, 0.012))
    L["hip"].y = max(L["hip"].y, 0.085)
    mid = V[(np.abs(V[:, 2] - z(0.515)) < 0.01)].mean(axis=0)
    out = {"H": H, "z0": z0}
    out["pelvis"] = Vector((mid[0], 0.0, z(0.525)))
    out["lumbar"] = Vector((mid[0], 0.0, z(0.585)))
    out["chest"] = Vector((mid[0], 0.0, z(0.665)))
    out["neck"] = Vector((mid[0], 0.0, z(0.835)))
    out["head"] = Vector((mid[0] + 0.01, 0.0, z(0.875)))
    for k, v in L.items():
        out[k + "L"] = Vector((v.x, abs(v.y), v.z))
        out[k + "R"] = Vector((v.x, -abs(v.y), v.z))
    return out

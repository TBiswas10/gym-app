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
    _faceless_head(me)
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


HEAD_CUT = 1.5   # below the chin: everything above is replaced by a smooth, faceless head


def _faceless_head(me):
    """Cut the sculpted face off at the jaw line and put a smooth egg-shaped mannequin head on the real neck."""
    import bmesh
    n = len(me.vertices)
    arr = np.empty(n * 3)
    me.vertices.foreach_get("co", arr)
    V = arr.reshape(n, 3)
    top = V[:, 2].max()
    hv = V[V[:, 2] > 1.6]
    cy = float(hv[:, 1].mean())
    ring = V[(np.abs(V[:, 2] - HEAD_CUT) < 0.012) & (np.abs(V[:, 1]) < 0.075)]
    rcx, rcy = float(ring[:, 0].mean()), float(ring[:, 1].mean())
    rrx, rry = float(np.percentile(np.abs(ring[:, 0] - rcx), 90)), float(np.percentile(np.abs(ring[:, 1] - rcy), 90))
    print('NECKRING', len(ring), rcx, rcy, rrx, rry)
    cx = rcx + 0.028
    bm = bmesh.new()
    bm.from_mesh(me)
    drop = [f for f in bm.faces if f.calc_center_median().z > HEAD_CUT]
    bmesh.ops.delete(bm, geom=drop, context="FACES")
    for v in [v for v in bm.verts if not v.link_faces]:
        bm.verts.remove(v)
    hz = 0.118
    zc = top - hz
    sph = bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=40, radius=1.0)
    for v in sph["verts"]:
        x, y, z = v.co
        taper = 1.0 - 0.08 * max(0.0, -z)          # narrower toward the chin
        v.co = (cx + x * 0.098 * taper, cy + y * 0.079 * taper, zc + z * hz)
    # the neck carries on up into the head, the same size as the cut ring
    cyl = bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=1.0, radius2=0.8, depth=0.1)
    for v in cyl["verts"]:
        v.co = (rcx + v.co.x * rrx * 0.97, rcy + v.co.y * rry * 0.97, HEAD_CUT + 0.02 + v.co.z)
    bm.to_mesh(me)
    bm.free()


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

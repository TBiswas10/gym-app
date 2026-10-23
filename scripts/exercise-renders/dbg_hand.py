import bpy, sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import body
bpy.ops.wm.read_factory_settings(use_empty=True)
# raw geometry without our shaping
body.CACHE = "nonexistent.npy"
ob, V = body.load_mesh()
L = body.landmarks(V)
for s in "LR":
    wr, el = np.array(L["wrist" + s]), np.array(L["elbow" + s])
    u = (wr - el) / np.linalg.norm(wr - el)
    rel = V - wr
    along = rel @ u
    perp = np.linalg.norm(rel - np.outer(along, u), axis=1)
    hand = (along > -0.01) & (perp < 0.075) & (np.abs(V[:, 1]) > 0.3)
    print("HAND", s, int(hand.sum()), "along max", float(along[hand].max()) if hand.any() else None, "wrist", wr, "u", u)
print("ZMAX", V[:,2].max(), "head verts", int((V[:,2]>1.6).sum()))

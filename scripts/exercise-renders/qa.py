"""Numeric QA of rendered videos, so you do not have to look at every frame (saves tokens).
python qa.py <renders dir> [slug ...]   one line per lift: OK or the problems found.
Checks: it moves, the loop closes (first and last frame match), nothing is cut off at the edges, the muscle glow is visible and not flooding the body."""
import glob, os, sys
import cv2, numpy as np

BG = np.array([14, 12, 11])  # BGR of the app background (11, 12, 14)
root = sys.argv[1]
slugs = sys.argv[2:] or sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(root, "*", "loop0001-*.mp4")))
bad = 0
for s in slugs:
    v = glob.glob(os.path.join(root, s, "loop0001-*.mp4"))
    if not v:
        print(f"{s}: NO VIDEO"); bad += 1; continue
    cap = cv2.VideoCapture(v[0]); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); fr = []
    while True:
        ok, f = cap.read()
        if not ok: break
        fr.append(f.astype(np.int16))
    probs = []
    if len(fr) < 30: probs.append(f"only {len(fr)} frames")
    else:
        motion = float(np.mean([np.abs(fr[i] - fr[0]).mean() for i in range(0, len(fr), 6)]))
        seam = float(np.abs(fr[-1] - fr[0]).mean())
        if motion < 0.8: probs.append(f"barely moves ({motion:.2f})")
        if seam > 2.5: probs.append(f"loop does not close ({seam:.1f})")
        edge = 0
        for f in fr[::10]:
            fg = np.abs(f - BG).sum(axis=2) > 40
            edge = max(edge, int(fg[:3].sum() + fg[-3:].sum() + fg[:, :3].sum() + fg[:, -3:].sum()))
        if edge > 700: probs.append(f"cut off at the frame edge ({edge} px)")
        peak = fr[min(len(fr) - 1, int(1.2 * 30))].astype(np.uint8)
        hsv = cv2.cvtColor(peak, cv2.COLOR_BGR2HSV)
        glow = float((((hsv[..., 0] <= 22) | (hsv[..., 0] >= 170)) & (hsv[..., 1] > 150) & (hsv[..., 2] > 170)).mean() * 100)
        if glow < 0.02: probs.append(f"glow barely visible ({glow:.2f}%)")
        if glow > 9: probs.append(f"glow floods the body ({glow:.1f}%)")
    print(f"{s}: " + ("OK" if not probs else "; ".join(probs)))
    bad += bool(probs)
print("QA", "clean" if not bad else f"{bad} with problems")

"""python vframes.py video.mp4 out.png [t1 t2 ...] : contact sheet of frames at the given seconds (default 6 spread across the clip)."""
import sys, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
ts = [float(x) for x in sys.argv[3:]] or [n / fps * k / 6 for k in range(6)]
tiles = []
for t in ts:
    cap.set(cv2.CAP_PROP_POS_FRAMES, min(n - 1, int(t * fps))); ok, f = cap.read()
    tiles.append(cv2.resize(f, (360, 360)) if ok else np.zeros((360, 360, 3), np.uint8))
cv2.imwrite(out, np.hstack(tiles)); print(n, fps)

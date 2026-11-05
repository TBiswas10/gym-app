"""Turns the body map renders into the app's files: public/bodymap/{front,back}.webp and one mask per muscle (white with alpha).
python bodymap_pack.py [renders dir]   (default _renders/bodymap)"""
import os, sys
import numpy as np
from PIL import Image

d = sys.argv[1] if len(sys.argv) > 1 else "_renders/bodymap"
out = "public/bodymap"
os.makedirs(out, exist_ok=True)
box = (225, 35, 675, 870)
size = (420, 780)
FRONT = ["chest", "abs", "obliques", "frontdelt", "sidedelt", "biceps", "forearms", "quads"]
BACK = ["traps", "lats", "midback", "reardelt", "triceps", "glutes", "hamstrings", "calves"]
for v, ms in (("front", FRONT), ("back", BACK)):
    base = Image.open(f"{d}/base_{v}.png").convert("RGBA")
    b = np.array(base).astype(np.int16)
    base.crop(box).resize(size, Image.LANCZOS).save(f"{out}/{v}.webp", quality=84, alpha_quality=90, method=6)
    for m in ms:
        im = np.array(Image.open(f"{d}/{m}_{v}.png").convert("RGBA")).astype(np.int16)
        diff = np.abs(im[..., :3] - b[..., :3]).sum(axis=2)
        a = np.clip((diff - 70) / 80.0, 0, 1) * (b[..., 3] / 255.0)
        mask = np.zeros(im.shape, np.uint8)
        mask[..., :3] = 255
        mask[..., 3] = (a * 255).astype(np.uint8)
        Image.fromarray(mask, "RGBA").crop(box).resize(size, Image.LANCZOS).save(f"{out}/{m}.webp", quality=80, alpha_quality=85, method=6)
print("packed", len(os.listdir(out)), "files")

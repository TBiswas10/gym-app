"""python grid.py out.png size slug [slug ...]  : start/finish stills of several lifts in one sheet (2 columns per lift)."""
import sys
from PIL import Image
out, size, slugs = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
cols = 3
rows = (len(slugs) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * size * 2, rows * size), (11, 12, 14, 255))
for i, s in enumerate(slugs):
    for j, n in enumerate("ab"):
        im = Image.open(f"_renders/{s}/{n}.png").convert("RGBA").resize((size, size), Image.LANCZOS)
        sheet.alpha_composite(im, ((i % cols) * size * 2 + j * size, (i // cols) * size))
sheet.convert("RGB").save(out)

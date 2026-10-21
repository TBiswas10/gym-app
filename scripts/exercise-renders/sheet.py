"""Contact sheet: python sheet.py out.png a.png b.png ... (frames on the app's dark background)."""
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGBA") for f in files]
w, h = ims[0].size
sheet = Image.new("RGBA", (w * len(ims), h), (11, 12, 14, 255))
for i, im in enumerate(ims):
    sheet.alpha_composite(im, (i * w, 0))
sheet.convert("RGB").save(out)

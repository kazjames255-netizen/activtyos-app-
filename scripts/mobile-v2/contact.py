#!/usr/bin/env python3
"""contact.py <in.png> <out_prefix> [seg_h=2400] [cols=4] -> tiles a tall full-page shot into contact sheets (cols side by side)."""
import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, out = sys.argv[1], sys.argv[2]
seg = int(sys.argv[3]) if len(sys.argv) > 3 else 2400
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
im = Image.open(src).convert('RGB')
w, h = im.size
segs = [im.crop((0, y, w, min(y + seg, h))) for y in range(0, h, seg)]
n = 0
for i in range(0, len(segs), cols):
    grp = segs[i:i + cols]
    sheet = Image.new('RGB', (w * len(grp) + 12 * (len(grp) - 1), seg), (90, 90, 90))
    for j, s in enumerate(grp):
        sheet.paste(s, (j * (w + 12), 0))
    sheet.save(f'{out}_{n}.png')
    n += 1
print(n, 'sheets', w, h)

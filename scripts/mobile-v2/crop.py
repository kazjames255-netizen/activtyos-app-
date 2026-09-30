#!/usr/bin/env python3
"""crop.py <a.png> <b.png> x0 y0 x1 y1 <out.png> : side-by-side crop"""
import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
a, b, x0, y0, x1, y1, out = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7]), sys.argv[7]
ia, ib = Image.open(a).convert('RGB').crop((x0, y0, x1, y1)), Image.open(b).convert('RGB').crop((x0, y0, x1, y1))
w, h = ia.size
s = Image.new('RGB', (w * 2 + 10, h), (255, 0, 0))
s.paste(ia, (0, 0)); s.paste(ib, (w + 10, 0))
s = s.resize((s.width * 3, s.height * 3), Image.NEAREST)
s.save(out)

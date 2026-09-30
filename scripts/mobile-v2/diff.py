#!/usr/bin/env python3
"""diff.py <dirA> <dirB> <vp,...> : pixel-diff every page shot between two run dirs (same file names)."""
import sys, os
from PIL import Image, ImageChops
Image.MAX_IMAGE_PIXELS = None
a, b = sys.argv[1], sys.argv[2]
vps = sys.argv[3].split(',')
bad = 0
for f in sorted(os.listdir(a)):
    if not any(f.endswith('__%s.png' % v) for v in vps): continue
    pb = os.path.join(b, f)
    if not os.path.exists(pb): continue
    ia, ib = Image.open(os.path.join(a, f)).convert('RGB'), Image.open(pb).convert('RGB')
    if ia.size != ib.size:
        print('SIZE DIFF', f, ia.size, ib.size); bad += 1; continue
    d = ImageChops.difference(ia, ib)
    bbox = d.getbbox()
    if bbox:
        n = sum(1 for p in d.getdata() if p != (0, 0, 0)) if d.size[0]*d.size[1] < 40_000_000 else -1
        print('DIFF', f, bbox, 'px=', n); bad += 1
    else:
        print('same', f)
print('total differing:', bad)

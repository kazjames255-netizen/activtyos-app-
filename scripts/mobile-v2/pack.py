#!/usr/bin/env python3
"""pack.py <before_dir> <after_dir> <dest_dir> : JPEG-compress selected shots into docs/mobile/shots (size budget < 40MB)."""
import sys, os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
b, a, dest = sys.argv[1:4]
PAGES = ['activly','parents','companies','franchises','freelancers','schools','pricing','tour','safeguarding','security','platform-bookings','platform-comms','platform-finance','platform-safeguarding','platform-staff','privacy','terms','dpa']
TAB = ['activly','pricing','companies','parents','platform-staff']
total = 0
for state, src in (('before', b), ('after', a)):
    os.makedirs(os.path.join(dest, state), exist_ok=True)
    for p in PAGES:
        for vp in ['p390'] + (['ipad820'] if p in TAB else []):
            f = os.path.join(src, f'{p}__{vp}.png')
            if not os.path.exists(f): continue
            im = Image.open(f).convert('RGB')
            if im.height > 16000:  # JPEG max 65535; keep lighter
                im = im.resize((im.width * 3 // 4, im.height * 3 // 4))
            o = os.path.join(dest, state, f'{p}__{vp}.jpg')
            im.save(o, 'JPEG', quality=50, optimize=True)
            total += os.path.getsize(o)
print('total MB', round(total / 1e6, 1))

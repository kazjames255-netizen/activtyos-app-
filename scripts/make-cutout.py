#!/usr/bin/env python3
"""Prepare the breakout-hero assets.

The effect is two copies of the SAME photo at pixel-identical geometry, stacked
either side of the phone frame. That is what makes the seam invisible for free:
the pixels under the feather are the same pixels, so there is nothing to align.

This script produces the second copy — an alpha cutout of the subject — WITHOUT
resizing or cropping. Same canvas dimensions as the source is the whole trick;
same canvas means same coordinates means automatic alignment at every viewport.

Pipeline
    1. rembg gives us a raw alpha matte of the subject.
    2. Erase back to a crossing line, so we keep the subject only from roughly
       where it crosses the bezel outward. Keeping the WHOLE subject is wrong —
       the parts that should sit behind the frame would float above it.
    3. Feather that inner edge (default 12px). Invisible, because the pixels
       underneath are identical.
    4. Decontaminate: erode the alpha 1px then blur it slightly, to kill the
       pale fringe rembg leaves from the original background.
    5. Export AVIF + WebP with alpha, plus a PNG fallback.

Usage
    python3 scripts/make-cutout.py \
        --src public/images/company-3.jpg \
        --out public/hero \
        --name climbing \
        --crossing 0.46 --feather 12

--crossing is a fraction of the image width: everything to its LEFT is erased.
Tune it so the cut lands inside the phone's screen rectangle, not on the bezel.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageFilter
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required:  pip install pillow")

try:  # Pillow < 11 needs a plugin before it can write AVIF
    import pillow_avif  # type: ignore # noqa: F401
except ImportError:
    pass


# ── step 1 ────────────────────────────────────────────────────────────────────
def remove_background(src: Path, raw: Path, matting: bool = True) -> None:
    """Run rembg. Prefer the library; fall back to the CLI on PATH.

    u2net computes its mask at low internal resolution and upscales it, which
    leaves a soft halo — outside the card that halo reads as a hazy smear of
    background. isnet-general-use plus alpha matting gives a tight edge.
    """
    if raw.exists():
        print(f"  · reusing existing matte {raw.name}")
        return
    import_err: Exception | None = None
    try:
        from rembg import new_session, remove  # type: ignore

        print("  · rembg (isnet-general-use, alpha matting)…")
        session = new_session("isnet-general-use")
        with Image.open(src) as im:
            cut = remove(
                im.convert("RGBA"), session=session,
                alpha_matting=matting,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=8,
                alpha_matting_erode_size=12,
            )
        cut.save(raw)
        return
    except ImportError as exc:
        # rembg 2.0.6x leaves onnxruntime as an extra, so a missing backend
        # surfaces here as "No module named 'onnxruntime'", not as a missing
        # rembg. Report what actually failed.
        import_err = exc

    exe = shutil.which("rembg")
    if not exe:
        sys.exit(
            f"could not import rembg: {import_err}\n"
            "  pip install 'rembg[cli]' onnxruntime pillow\n"
            "then re-run. The first run downloads a ~180MB model."
        )
    print("  · rembg CLI…")
    subprocess.run([exe, "i", str(src), str(raw)], check=True)


# ── steps 2–4 ─────────────────────────────────────────────────────────────────
def crossing_mask(size: tuple[int, int], crossing: float, feather: int,
                  lean: int, invert: bool = False) -> Image.Image:
    """A soft left-to-right ramp: 0 left of the crossing line, 255 right of it.

    `lean` shifts the bottom of the line relative to the top, so the cut can
    follow a body leaning into frame instead of being dead vertical.
    """
    w, h = size
    ramp = Image.new("L", (w, h), 0)
    px = ramp.load()
    band = max(feather * 2, 2)
    x_top = crossing * w
    for y in range(h):
        # linear interpolation of the line position down the canvas
        x_at = x_top + lean * (y / max(h - 1, 1))
        start = x_at - band / 2
        for x in range(w):
            t = (x - start) / band
            v = 0 if t <= 0 else (255 if t >= 1 else int(t * 255))
            px[x, y] = 255 - v if invert else v
    return ramp.filter(ImageFilter.GaussianBlur(feather / 2))


def drop_islands(alpha: Image.Image, min_area: int) -> Image.Image:
    """Delete disconnected specks the matte kept — chunks of climbing wall and
    ground that read as debris floating beside the subject once it is over the
    bezel. Keeps every blob of >= min_area px."""
    try:
        import numpy as np
        from scipy import ndimage
    except ImportError:
        print("      (scipy/numpy absent — skipping island removal)")
        return alpha

    arr = np.array(alpha)
    labels, n = ndimage.label(arr > 24)
    if n == 0:
        return alpha
    areas = ndimage.sum(arr > 24, labels, range(1, n + 1))
    keep = np.zeros(n + 1, dtype=bool)
    keep[1:] = areas >= min_area
    dropped = int((~keep[1:]).sum())
    if dropped:
        print(f"      dropped {dropped} island(s) under {min_area}px")
    return Image.fromarray((arr * keep[labels]).astype("uint8"), "L")


def fade_edges(alpha: Image.Image, top: int, right: int, bottom: int,
               left: int = 0) -> Image.Image:
    """Ramp the alpha to zero over the last N px of the given edges."""
    w, h = alpha.size
    if top <= 0 and right <= 0 and bottom <= 0 and left <= 0:
        return alpha
    ramp = Image.new("L", (w, h), 255)
    px = ramp.load()
    for y in range(h):
        fy = 255
        if top > 0 and y < top:
            fy = min(fy, int(255 * y / top))
        if bottom > 0 and y >= h - bottom:
            fy = min(fy, int(255 * (h - y) / bottom))
        for x in range(w):
            v = fy
            if right > 0 and x >= w - right:
                v = min(v, int(255 * (w - x) / right))
            if left > 0 and x < left:
                v = min(v, int(255 * x / left))
            px[x, y] = v
    return ImageChops.multiply(alpha, ramp)


def finish(src: Path, raw: Path, crossing: float, feather: int, lean: int,
           min_area: int, wall: float | None, wall_lean: int,
           wall_feather: int, fade_top: int, fade_right: int,
           fade_bottom: int, fade_left: int, invert: bool,
           clamp: int) -> Image.Image:
    # Take ALPHA from the matte but RGB from the original. rembg writes black
    # into fully-transparent pixels, so anything we later make opaque (the wall
    # wedge) would come back as a black slab if we reused its colour.
    with Image.open(raw) as im:
        alpha = im.convert("RGBA").getchannel("A")
    with Image.open(src) as im:
        cut = im.convert("RGB").convert("RGBA")

    # Clamp the soft tail to zero. Anything under ~12% alpha is halo, and once
    # it is outside the card it shows as haze. Then erode 1px to pull the matte
    # inside the original edge. NO global blur — his back, shoulder, arm and cap
    # sit against open space, and softness there reads as a mistake. The only
    # feather is along the crossing line, applied by crossing_mask().
    alpha = alpha.point(lambda v: 0 if v < clamp else v)
    alpha = alpha.filter(ImageFilter.MinFilter(3))

    # erase back to the crossing line
    alpha = ImageChops.multiply(
        alpha, crossing_mask(cut.size, crossing, feather, lean, invert)
    )

    # and lose whatever is left floating on its own
    alpha = drop_islands(alpha, min_area)

    # rembg reads the climbing wall as background, so the climber comes out with
    # nothing to climb. Add it back as a wedge that follows the rock's own
    # leaning edge — a real boundary in the photo, not an arbitrary fade.
    if wall is not None:
        wedge = crossing_mask(cut.size, wall, wall_feather, wall_lean)
        alpha = ImageChops.lighter(alpha, wedge)

    # Wherever the SOURCE frame cuts through the subject or the wall, the cutout
    # would otherwise end on a hard guillotine once it is over the page. The
    # coach is cropped at the ankles by the bottom edge; the wall is cropped by
    # the top and right edges. Dissolve those bands instead.
    alpha = fade_edges(alpha, fade_top, fade_right, fade_bottom, fade_left)

    cut.putalpha(alpha)
    return cut


# ── step 5 ────────────────────────────────────────────────────────────────────
def export(img: Image.Image, out: Path, stem: str, *, alpha: bool,
           quality: int = 65) -> list[str]:
    # the cutout is compared side by side with the in-card copy, so it carries
    # a higher quality than the full photo — any softness reads as a mismatch
    written: list[str] = []
    out.mkdir(parents=True, exist_ok=True)

    if alpha:
        png = out / f"{stem}.png"
        img.save(png, optimize=True)
        written.append(png.name)
    else:
        jpg = out / f"{stem}.jpg"
        img.convert("RGB").save(jpg, quality=82, optimize=True, progressive=True)
        written.append(jpg.name)

    for fmt, ext in (("WEBP", "webp"), ("AVIF", "avif")):
        try:
            p = out / f"{stem}.{ext}"
            img.save(p, fmt, quality=quality)
            written.append(p.name)
        except Exception as exc:  # AVIF needs Pillow >= 11 or pillow-avif-plugin
            print(f"    ! {ext} skipped ({type(exc).__name__}) — "
                  f"pip install pillow-avif-plugin to enable")
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("public/hero"))
    ap.add_argument("--name", default="climbing")
    ap.add_argument("--crossing", type=float, default=0.46,
                    help="fraction of width; everything left of it is erased")
    ap.add_argument("--feather", type=int, default=12)
    ap.add_argument("--lean", type=int, default=0,
                    help="px the crossing line shifts from top to bottom")
    ap.add_argument("--min-area", type=int, default=4000,
                    help="drop disconnected blobs smaller than this many px")
    ap.add_argument("--wall", type=float, default=None,
                    help="fraction of width; keep everything right of it (the "
                         "climbing wall, which rembg reads as background)")
    ap.add_argument("--wall-lean", type=int, default=0,
                    help="px the wall edge shifts from top to bottom")
    ap.add_argument("--wall-feather", type=int, default=6)
    ap.add_argument("--fade-top", type=int, default=0,
                    help="px of soft fade at the top edge")
    ap.add_argument("--fade-right", type=int, default=0,
                    help="px of soft fade at the right edge")
    ap.add_argument("--fade-left", type=int, default=0,
                    help="px of soft fade at the left edge")
    ap.add_argument("--clamp", type=int, default=31,
                    help="alpha below this (0-255) is forced to zero; 31 ~= 12%%")
    ap.add_argument("--no-matting", action="store_true",
                    help="skip alpha matting (faster, softer edge)")
    ap.add_argument("--invert", action="store_true",
                    help="keep the LEFT of the crossing line instead of the right "
                         "(for subjects that break out leftward)")
    ap.add_argument("--fade-bottom", type=int, default=0,
                    help="px of soft fade at the bottom, for subjects the "
                         "source photo crops mid-limb")
    args = ap.parse_args()

    if not args.src.exists():
        sys.exit(f"source not found: {args.src}")

    args.out.mkdir(parents=True, exist_ok=True)
    raw = args.out / f"{args.name}-cutout-raw.png"

    with Image.open(args.src) as im:
        w, h = im.size
    print(f"source {args.src}  {w}x{h}")

    print("1/3  removing background")
    remove_background(args.src, raw, matting=not args.no_matting)

    print("2/3  erasing to the crossing line, feathering, decontaminating")
    cut = finish(args.src, raw, args.crossing, args.feather, args.lean, args.min_area,
                 args.wall, args.wall_lean, args.wall_feather,
                 args.fade_top, args.fade_right, args.fade_bottom,
                 args.fade_left, args.invert, args.clamp)
    if cut.size != (w, h):
        sys.exit(f"canvas changed ({cut.size} != {(w, h)}) — alignment would break")

    print("3/3  exporting")
    full = export(Image.open(args.src).convert("RGB"), args.out, args.name, alpha=False)
    cuts = export(cut, args.out, f"{args.name}-cutout", alpha=True, quality=88)

    print(f"\n  full photo : {', '.join(full)}")
    print(f"  cutout     : {', '.join(cuts)}")
    for name in cuts:
        kb = (args.out / name).stat().st_size / 1024
        print(f"      {name:<28} {kb:7.1f} KB")
    print(f"\ncanvas preserved at {w}x{h} — the two layers cannot drift.")


if __name__ == "__main__":
    main()

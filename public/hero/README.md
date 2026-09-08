# Breakout hero — do not flatten this into one image

The climbing coach appears to step out of the phone on the companies page
("The booking and the day" slide). It is **not** a pre-composited JPEG, and it
is **not** a `clip-path` trick. Both were tried and both look wrong — the
clip-path attempt dragged a blob of forest out with her, because the boundary
between a person and the trees behind them is a per-pixel alpha matte, not a
shape you can describe with coordinates.

## How it actually works

**Two copies of the same photo, at pixel-identical geometry, stacked either
side of the phone frame.**

| layer | z | what |
|---|---|---|
| `.bh-media` | 1 | full photo, clipped to the screen rectangle |
| `.bh-ui` | 2 | the live DOM booking card — real text, not baked in |
| `.bh-shell` / `.bh-notch` | 3 | bezel and notch, `pointer-events:none` |
| `.bh-media--breakout` | 4 | alpha cutout of the **same** photo, over the frame |

Because layers 1 and 4 are the same image at the same coordinates, the seam is
invisible for free. There is nothing to align by hand, and nothing to re-align
when the viewport changes. Only the part of layer 4 that falls outside the
screen rectangle reads as "breaking out".

Everything is positioned in a fixed design space (620×420 design px) held in
CSS custom properties on `.bh-scaler`, and the whole composition is scaled by a
single `transform` driven by a container query. **Never scale the layers
individually** — that is the one thing that can make the two copies drift.

## The cutout

`scripts/make-cutout.py` produces it. The important part is that it does **not**
resize or crop: same canvas as the source (1600×1073) means same coordinates
means automatic alignment.

```bash
python3 scripts/make-cutout.py \
    --src public/images/company-3.jpg \
    --out public/hero --name climbing \
    --crossing 0.55 --feather 12 --min-area 6000
```

* `--crossing 0.55` erases everything left of 55% of the width. This is not
  cosmetic: the cut has to land **inside the screen rectangle**, so the
  feathered inner edge is hidden by identical pixels underneath. Move
  `--bh-media-x` in the CSS and you will expose it.
* `--min-area 6000` drops disconnected islands. rembg kept 42 fragments of
  climbing wall and ground that read as debris floating beside her.
* rembg matted the belay rope cleanly, which was the expected weak point.

Requires `rembg[cli]`, `onnxruntime` (an *extra* in rembg 2.0.6x, not a
dependency), `pillow`, and `pillow-avif-plugin` for AVIF on Pillow < 11.

## Verified

* Two layers pixel-identical — Δx, Δy, Δw, Δh all **0.000px** at 340/420/600/
  768/900/1024/1100px container widths.
* No horizontal scroll at 320px; the breakout layer drops below 400px and it
  reads as an ordinary mockup.
* `drop-shadow` (not `box-shadow`) follows the alpha channel, so the shadow
  falls from her actual silhouette across the bezel. That one declaration does
  most of the depth.
* Entrance animation only. **Do not add scroll parallax to the breakout layer**
  unless you apply the identical transform to the screen-clipped copy — any
  transform on one and not the other breaks the seam.

## Still outstanding

* **Licence.** `public/images/company-3.jpg` needs its licence confirmed before
  this ships publicly.
* The PNG fallback is 1.4MB. AVIF (101KB) and WebP (77KB) are what actually get
  served; the PNG only reaches browsers that support neither, which is
  effectively nothing. Quantise it if that matters.
* This is implemented as static HTML + CSS because `public/v2/` is a static
  site — there is no `components/marketing/` and no React route for it. The
  geometry system is framework-agnostic; porting `breakout-hero.css` into a
  `BreakoutHero.tsx` is a markup copy and a `ResizeObserver` in place of the
  container query.

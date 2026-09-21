import type { CSSProperties } from "react";
import type { CanvasBlock, CanvasEl, CanvasRun, CanvasText } from "./types";

// The render-time THEME layer of a canvas slide (an imported real deck, server/src/oak/deckConvert.ts). A deck arrives in its publisher's
// palette and type; this maps it — at DRAW time, so it applies to every lesson, past and future, with no re-import — onto the provider's
// own brand: `themeBlock(block)` looks at the slide's colours and roles and returns a plan ({ bg, per-element treatment }), and
// CanvasSlide applies it. Nothing is rewritten in the saved slide, and NO PICTURE IS EVER TOUCHED (pictures are drawn exactly as stored).
//
// What is mapped (by colour cluster and role):
//   • the publisher's four accents (purple / teal / blue / magenta title bands, pills, rings, outlines) → four analogue shades of the
//     provider's brand colour (`--sb-a..d`, hue-shifted, each deep enough for white text);
//   • the pale slide backgrounds (white, lavender, teal-tint, blue-tint, pink-tint, yellow, cover green) → brand-tinted paper;
//   • text: their near-black / grey ink → the brand-tinted ink; accent-coloured words → the matching brand shade; bold key words → brand;
//   • fonts (three Google faces) → the app's body font, and the display font for headings;
//   • body paragraphs standing alone get a soft rounded card; the wavy band edge and the white "blob" panel behind a paragraph are redrawn
//     as a clean band edge / card (they are decoration, not content).
// What is NEVER mapped (colour matters there): anything not in that publisher palette (reds, greens, yellows of colour-coded pictures,
// towers, cubes, traffic lights), and any text that sits on a picture or on such a colour (car labels 'BLACK / YELLOW / BLUE', bubbles).
// Escape hatch: `block.theme = "original"` draws the slide in its own colours (tutor toggle "Original colours").

// ── colour helpers ────────────────────────────────────────────────────────
type RGB = [number, number, number];
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export function hexToRgb(h: string): RGB | null {
  const m = /^#?([0-9a-f]{6})/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = ([r, g, b]: RGB) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lum = ([r, g, b]: RGB) => { const c = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b); };
const contrastWhite = (c: RGB) => 1.05 / (lum(c) + 0.05);
/** Darken (keeping the hue) until white text on it reads (WCAG AA). */
function deepen(c: RGB): RGB {
  let [h, s, l] = toHsl(c);
  for (let i = 0; i < 30 && contrastWhite(fromHsl(h, s, l)) < 4.6; i++) l = Math.max(0.08, l - 0.025);
  return fromHsl(h, s, l);
}
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];

// ── the provider's palette as CSS custom properties on the slide ──────────
export type Fam = "a" | "b" | "c" | "d";
const SHIFT: Record<Fam, number> = { a: 0, b: 34, c: -34, d: 74 };
export const DEFAULT_BRAND = "#2f6bd8";

/** `--sb-*` variables for a provider colour (any #rrggbb; a bad one falls back to the app's default blue). */
export function brandVars(base: string | undefined): CSSProperties {
  const b = (base && hexToRgb(base)) || hexToRgb(DEFAULT_BRAND)!;
  const [h, s, l] = toHsl(b);
  const v: Record<string, string> = { "--sb": toHex(b) };
  for (const f of ["a", "b", "c", "d"] as const) {
    const shifted = fromHsl(h + SHIFT[f], Math.max(0.28, s), clamp(l, 0.35, 0.6));
    const deep = deepen(shifted);
    v[`--sb-${f}`] = toHex(deep);
    v[`--sb-${f}-dk`] = toHex(mixRgb(deep, BLACK, 0.3));
    v[`--sb-${f}-tint`] = toHex(mixRgb(fromHsl(h + SHIFT[f], Math.max(0.3, s), 0.62), WHITE, 0.9));
    v[`--sb-${f}-line`] = toHex(mixRgb(fromHsl(h + SHIFT[f], Math.max(0.3, s), 0.62), WHITE, 0.72));
  }
  const hs = Math.min(s, 0.45);
  v["--sb-ink"] = toHex(fromHsl(h, hs, 0.14));
  v["--sb-ink2"] = toHex(fromHsl(h, hs * 0.6, 0.34));
  v["--sb-rule"] = toHex(fromHsl(h, hs * 0.35, 0.72));
  v["--sb-rule2"] = toHex(fromHsl(h, hs * 0.5, 0.5));
  v["--sb-paper"] = toHex(mixRgb(b, WHITE, 0.975));
  v["--sb-card"] = toHex(mixRgb(b, WHITE, 0.94));
  v["--sb-soft"] = toHex(mixRgb(b, WHITE, 0.9));
  v["--sb-glow"] = `rgba(${b.map(Math.round).join(",")},.18)`;
  v["--sb-glow2"] = `rgba(${b.map(Math.round).join(",")},.34)`;
  return v as CSSProperties;
}

// ── fonts ─────────────────────────────────────────────────────────────────
/** The publisher's three faces all become the app's own: body font, or the display font for headings. */
export const fontStack = (_f: CanvasRun["f"], display: boolean): string => (display ? "var(--ff-display), var(--ff), system-ui, sans-serif" : "var(--ff), system-ui, sans-serif");

// ── colour clusters ───────────────────────────────────────────────────────
const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
type Kind = "paper" | "tint" | "hero" | "accent" | "keep";
interface Cluster { kind: Kind; fam: Fam }
const P = (hex: string) => hexToRgb(hex)!;
const ACCENTS: [RGB, Fam][] = [[P("#845ad9"), "a"], [P("#037b7d"), "b"], [P("#374cf1"), "c"], [P("#d02aa7"), "d"]];
const TINTS: [RGB, Fam][] = [[P("#f3eefb"), "a"], [P("#e6f2f2"), "b"], [P("#e5f2f2"), "b"], [P("#ebedfe"), "c"], [P("#ececfd"), "c"], [P("#faeaf6"), "d"], [P("#fceaf5"), "d"], [P("#fff7cc"), "a"], [P("#cfe2f3"), "c"]];
const HERO = P("#bef2bd");
const INKS = ["#000000", "#222222", "#282828", "#333333", "#3a3838", "#1b1b1b", "#212121", "#000000ff"];

/** Which of the publisher's colour clusters a fill belongs to (`keep` = not theirs, so it is left alone). */
export function clusterOf(hex: string | undefined): Cluster {
  const c = hex ? hexToRgb(hex) : null;
  if (!c) return { kind: "keep", fam: "a" };
  if (hex!.length === 9 && parseInt(hex!.slice(7), 16) < 250) return { kind: "keep", fam: "a" }; // translucent: leave it
  if (dist(c, WHITE) <= 12) return { kind: "paper", fam: "a" };
  for (const [t, f] of ACCENTS) if (dist(c, t) <= 40) return { kind: "accent", fam: f };
  if (dist(c, HERO) <= 40) return { kind: "hero", fam: "b" };
  for (const [t, f] of TINTS) if (dist(c, t) <= 26) return { kind: "tint", fam: f };
  const [h, s, l] = toHsl(c);
  if (l >= 0.9 && s >= 0.2) return { kind: "tint", fam: famOfHue(h) };
  return { kind: "keep", fam: famOfHue(h) };
}
function famOfHue(h: number): Fam { return h >= 250 && h < 300 ? "a" : h >= 300 && h < 352 ? "d" : h >= 215 && h < 250 ? "c" : h >= 90 && h < 215 ? "b" : "a"; }

const GRADIENT = (f: Fam) => `linear-gradient(100deg, var(--sb-${f}-dk), var(--sb-${f}))`;

// ── the plan ──────────────────────────────────────────────────────────────
export interface TextTheme {
  /** what the text sits on: the paper (dark ink) or a coloured shape (keeps its own light colours) */
  on: "paper" | "band";
  /** drawn on a picture / a colour that matters: its own colours are kept exactly */
  locked?: boolean;
  /** heading: the display font */
  display?: boolean;
  /** the words name colours ("the blue cube"): only the greys / near-black are re-inked, every other colour stays exactly as drawn */
  colourWords?: boolean;
  /** a soft rounded card behind it */
  card?: boolean;
}
export interface ElTheme {
  hide?: boolean;
  /** an image that is the publisher's white blob behind a paragraph: draw a card instead */
  panel?: boolean;
  fill?: string;
  line?: string;
  /** the full-width title band (`fam`), drawn as a brand gradient with a rounded lower edge */
  band?: Fam;
  text?: TextTheme;
}
export interface ThemePlan { bg: string; hero: boolean; fam: Fam; els: (ElTheme | undefined)[] }

type Box = { x: number; y: number; w: number; h: number };
const boxOf = (e: CanvasEl): Box => ({ x: e.x, y: e.y, w: e.w, h: e.h });
const cx = (b: Box) => b.x + b.w / 2, cy = (b: Box) => b.y + b.h / 2;
const inside = (b: Box, px: number, py: number) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
function overlapFrac(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 && a.w * a.h > 0 ? (w * h) / (a.w * a.h) : 0;
}
const plain = (t: CanvasText) => t.paras.map((p) => p.runs.map((r) => r.t).join("")).join(" ").trim();
const firstSize = (t: CanvasText) => t.paras.find((p) => p.runs.length)?.runs[0]?.size ?? 18;

/** The theme plan for one canvas block, or null when the slide is set to draw in its original colours. */
export function themeBlock(b: CanvasBlock): ThemePlan | null {
  if (b.theme === "original") return null;
  const els = b.els;
  const plan: (ElTheme | undefined)[] = new Array(els.length).fill(undefined);
  const bgc = clusterOf(b.bg ?? "#ffffff");
  const hero = bgc.kind === "hero";
  const fam: Fam = bgc.kind === "tint" || bgc.kind === "hero" || bgc.kind === "accent" ? bgc.fam : "a";
  const bg = bgc.kind === "paper" ? "linear-gradient(180deg, #ffffff 0%, var(--sb-paper) 100%)"
    : bgc.kind === "hero" ? "radial-gradient(circle at 93% 6%, var(--sb-glow2) 0, transparent 30%), radial-gradient(circle at 3% 98%, var(--sb-glow) 0, transparent 34%), linear-gradient(135deg, var(--sb-a-tint), var(--sb-b-tint))"
    : bgc.kind === "tint" ? `linear-gradient(180deg, var(--sb-${bgc.fam}-tint) 0%, color-mix(in srgb, var(--sb-${bgc.fam}-tint) 60%, #fff) 100%)`
    : (b.bg ?? "#ffffff");
  const lockAll = bgc.kind === "keep" || bgc.kind === "accent"; // a background that isn't theirs: keep the text colours

  // 1. the title band (a full-width accent rectangle at the top) and the wavy image under it
  let bandIdx = -1;
  els.forEach((e, i) => {
    if (bandIdx >= 0 || e.k !== "shape" || e.geom === "line" || !e.fill) return;
    const c = clusterOf(e.fill);
    if (e.x <= 0.012 && e.w >= 0.97 && e.y <= 0.02 && e.h >= 0.05 && e.h <= 0.16 && (c.kind === "accent" || c.kind === "hero")) { bandIdx = i; plan[i] = c.kind === "accent" ? { band: c.fam } : { fill: "var(--sb-b-tint)", line: undefined }; }
  });
  if (bandIdx >= 0) {
    const band = els[bandIdx]!;
    els.forEach((e, i) => { if (e.k === "img" && !e.alt && e.x <= 0.012 && e.w >= 0.97 && e.h <= 0.045 && e.y >= band.y + band.h - 0.035 && e.y <= band.y + band.h + 0.04) plan[i] = { hide: true }; });
  }

  // 2. panels: a big alt-less picture with paragraphs standing on it is the publisher's white blob → a branded card
  els.forEach((e, i) => {
    if (e.k !== "img" || plan[i] || e.alt || e.w * e.h < 0.2 || e.step || e.crop) return;
    const box = boxOf(e);
    let chars = 0;
    for (const t of els) if (t.k === "text" && inside(box, cx(boxOf(t)), cy(boxOf(t)))) chars += plain(t).length;
    if (chars >= 50) plan[i] = { panel: true };
  });

  // 3. which pictures / colours make the text around them off-limits
  const pics = els.map((e, i) => (e.k === "img" && !plan[i]?.hide && !plan[i]?.panel ? boxOf(e) : null));
  /** What colour the text stands on: the last filled shape before it that contains its centre. */
  const under = (t: CanvasText, ti: number): Kind => {
    let hit: Kind = "paper";
    for (let i = 0; i < ti; i++) {
      const e = els[i]!;
      if (e.k !== "shape" || e.geom === "line" || !e.fill || !inside(boxOf(e), cx(boxOf(t)), cy(boxOf(t)))) continue;
      const c = clusterOf(e.fill);
      hit = c.kind === "accent" ? "accent" : c.kind === "keep" ? "keep" : "paper";
    }
    return hit;
  };

  const hasWhiteLabel = (sh: CanvasEl, si: number) => els.some((t, j) => j > si && t.k === "text" && inside(boxOf(sh), cx(boxOf(t)), cy(boxOf(t))) && t.paras.every((p) => p.runs.every((r) => !r.t.trim() || (r.color ?? "").toLowerCase().startsWith("#ffffff"))) && plain(t).length > 0);
  els.forEach((e, i) => {
    if (e.k === "shape") {
      if (plan[i]) return;
      if (e.geom === "line") {
        const lc = e.line?.c ?? "#000000";
        const c = clusterOf(lc);
        if (c.kind === "accent") plan[i] = { line: `var(--sb-${c.fam})` };
        else if (INKS.includes(lc.toLowerCase())) plan[i] = { line: e.line && e.line.w <= 1.4 ? "var(--sb-rule2)" : "var(--sb-ink)" };
        else if (/^#(808080|9e9e9e|cccccc|b7b7b7|999999|bdbdbd)$/i.test(lc)) plan[i] = { line: "var(--sb-rule)" };
        return;
      }
      const t: ElTheme = {};
      if (e.fill) {
        const c = clusterOf(e.fill);
        // an accent-coloured box is theirs (a pill / label) only when a white label sits on it; a bare one is a colour that means something (a blue cube)
        if (c.kind === "accent") { if (hasWhiteLabel(e, i)) t.fill = GRADIENT(c.fam); }
        else if (c.kind === "hero") t.fill = bgc.kind === "hero" ? "transparent" : `var(--sb-${c.fam}-tint)`;
        else if (c.kind === "tint") t.fill = `var(--sb-${c.fam}-tint)`;
      }
      if (e.line) {
        const c = clusterOf(e.line.c);
        if (c.kind === "accent") t.line = `var(--sb-${c.fam})`;
        else if (INKS.includes(e.line.c.toLowerCase())) t.line = "var(--sb-ink)";
        else if (/^#(808080|9e9e9e|cccccc)$/i.test(e.line.c)) t.line = "var(--sb-rule)";
      }
      if (t.fill || t.line) plan[i] = t;
      return;
    }
    if (e.k !== "text") return;
    const tb = boxOf(e);
    const onPic = pics.some((p) => p && overlapFrac(tb, p) >= 0.35);
    const u = under(e, i);
    const locked = lockAll || onPic || u === "keep";
    const size = firstSize(e);
    const white = e.paras.every((p) => p.runs.every((r) => !r.t.trim() || (r.color ?? "").toLowerCase().startsWith("#ffffff")));
    const onBand = u === "accent" || (bandIdx >= 0 && tb.y < els[bandIdx]!.y + els[bandIdx]!.h && white);
    const text: TextTheme = { on: onBand ? "band" : "paper", ...(locked ? { locked: true } : {}), ...(COLOUR_WORDS.test(plain(e)) ? { colourWords: true } : {}) };
    if ((onBand && white && size >= 16) || size >= 30 || (e.paras[0]?.runs[0]?.bold && size >= 26)) text.display = true;
    // a soft card behind a stand-alone paragraph: wide, wordy, on the paper, clear of pictures / lines / other text
    if (!locked && !onBand && !hero && !text.display && e.w >= 0.28 && e.h >= 0.06 && plain(e).length >= 34 && !e.rot && e.y > 0.11) {
      const clear = els.every((o, j) => j === i || o.k === "text" || plan[j]?.hide || overlapFrac(tb, boxOf(o)) < 0.02);
      const others = els.every((o, j) => j === i || o.k !== "text" || overlapFrac(tb, boxOf(o)) < 0.1);
      const wPt = Math.max(1, e.w * b.w - 14);
      let hPt = 0;
      for (const p of e.paras) {
        const sz = Math.max(1, ...p.runs.map((r) => r.size)), n = p.runs.reduce((k, r) => k + r.t.length, 0);
        hPt += Math.max(1, Math.ceil((n * sz * 0.55) / Math.max(20, wPt - (p.ind?.[0] ?? 0)))) * sz * 1.25 * (p.lh ?? 1) + (p.before ?? 0) + (p.after ?? 0);
      }
      const fill = hPt / (e.h * b.h);
      if (clear && others && fill >= 0.5 && fill <= 1.0) text.card = true;
    }
    plan[i] = { text };
  });
  // two cards stacked closer than a hand's width read as one muddle: keep the upper one only
  const cards = plan.map((t, i) => (t?.text?.card ? i : -1)).filter((i) => i >= 0);
  for (const i of cards) for (const j of cards) {
    if (j <= i) continue;
    const a = els[i]!, c = els[j]!, gap = Math.max(c.y - (a.y + a.h), a.y - (c.y + c.h));
    if (gap < 0.03 && Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) > 0) plan[j]!.text!.card = false;
  }
  return { bg, hero, fam, els: plan };
}

const COLOUR_WORDS = /\b(red|blue|green|yellow|orange|purple|pink|black|white|brown|grey|gray|teal|violet|colou?r)\b/i;
const isInk = (c: string | undefined) => !c || INKS.includes(c.toLowerCase());
/** The colour a run is drawn in under the plan (`undefined` = inherit the slide's ink). */
export function mapTextColor(c: string | undefined, bold: boolean | undefined, t: TextTheme | undefined): string | undefined {
  if (!t || t.locked) return c;
  if (t.on === "band") return c;
  if (isInk(c)) return bold && !t.colourWords ? "var(--sb-a)" : undefined;
  if (t.colourWords) return /^#(595959|666666|434343|7f7f7f)$/i.test(c!) ? "var(--sb-ink2)" : c;
  const lc = c!.toLowerCase();
  if (lc === "#595959" || lc === "#666666" || lc === "#434343" || lc === "#7f7f7f") return "var(--sb-ink2)";
  const k = clusterOf(c);
  if (k.kind === "accent") return `var(--sb-${k.fam})`;
  return c;
}

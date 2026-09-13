// Derive the full `--brand-*` CSS-variable family from a single accent colour a
// provider picks in Setup → Branding. The picked colour is treated as the bright
// primary (matching the default #2f6bd8 = --brand-2); everything else is a
// lighten/darken of it. Applied only on customer-facing surfaces (the parent
// portal + checkout) via ParentBrandTheme — the operator/HO chrome keeps its own
// system theme. The var DEFAULTS in globals.css equal the old hard-coded blues,
// so components that switched to var(--brand*) look identical until a colour is set.

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = ({ r, g, b }: RGB) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
// Mix a colour toward white (amount>0) or black (amount<0). amount in 0..1.
const mix = (c: RGB, target: 0 | 255, amount: number): RGB => ({
  r: c.r + (target - c.r) * amount,
  g: c.g + (target - c.g) * amount,
  b: c.b + (target - c.b) * amount,
});
const lighten = (c: RGB, amt: number) => mix(c, 255, amt);
const darken = (c: RGB, amt: number) => mix(c, 0, amt);

// WCAG relative luminance + contrast ratio, so text laid on a provider's colour
// stays legible whatever they pick (a pale yellow needs dark text, navy white).
const lum = ({ r, g, b }: RGB) => {
  const ch = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const DARK_INK = "#171534";

/** A picked accent resolved for direct use on customer pages (the storefront
 *  isn't under ParentBrandTheme): `bg` fills buttons/header tints, `ink` is the
 *  text on it (white only when the colour is dark enough), `text` is the colour
 *  as text on a light ground (deepened if it's too pale to read). Null for a
 *  bad/missing hex, so callers keep their own default colours. */
export function brandAccent(hex: string | null | undefined): { bg: string; ink: string; text: string } | null {
  const base = hex ? hexToRgb(hex) : null;
  if (!base) return null;
  const ink = contrast(base, WHITE) >= contrast(base, hexToRgb(DARK_INK)!) ? "#ffffff" : DARK_INK;
  let t = base;
  for (let i = 0; i < 6 && contrast(t, WHITE) < 4.5; i++) t = darken(t, 0.15);
  return { bg: toHex(base), ink, text: toHex(t) };
}

/** The provider's logo from a settings blob — the public library exposes it as
 *  a top-level `logoUrl`; a signed-in operator's own library has it in billing. */
export function brandLogo(s: { logoUrl?: string; billing?: { logoUrl?: string } } | null | undefined): string | null {
  return (s?.logoUrl || s?.billing?.logoUrl || "").trim() || null;
}

/** The `--brand-*` variables for a picked accent hex. Returns {} for a bad hex
 *  so callers safely fall back to the globals.css defaults. */
export function brandVars(hex: string | null | undefined): Record<string, string> {
  const base = hex ? hexToRgb(hex) : null;
  if (!base) return {};
  return {
    "--brand-2": toHex(base),                 // the picked colour = bright primary
    "--brand": toHex(darken(base, 0.2)),      // the deeper primary
    "--brand-strong": toHex(darken(base, 0.32)),
    "--brand-ink": toHex(darken(base, 0.5)),  // text on a soft tint
    "--brand-soft": toHex(lighten(base, 0.9)),// very light fill behind chips
    "--brand-line": toHex(lighten(base, 0.78)),
  };
}

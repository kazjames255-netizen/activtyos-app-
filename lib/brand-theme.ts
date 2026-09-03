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

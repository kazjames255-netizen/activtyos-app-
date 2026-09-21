import { DEFAULT_PALETTE } from "./model";
import { DEFAULT_PAPER, type Paper } from "./render";

// The board's colours come from the portal's own tokens (so a tenant's rebrand
// carries through). The pen palette and the paper are read once, at mount, and
// resolved to plain hex — a stroke stores its colour as data, so every
// participant sees the same ink whatever their own theme.

const HEX = /^#[0-9a-f]{3,8}$/i;
export function readTheme(el: HTMLElement): { paper: Paper; palette: string[] } {
  const cs = getComputedStyle(el);
  const v = (name: string, fb: string) => { const s = cs.getPropertyValue(name).trim(); return HEX.test(s) ? s : fb; };
  const d = DEFAULT_PAPER;
  const paper: Paper = {
    paper: v("--surface", d.paper), grid: v("--line", d.grid), gridStrong: v("--brand-line", d.gridStrong), axis: v("--ink-3", d.axis), ink: v("--ink", d.ink), label: v("--ink-2", d.label),
    brand: v("--brand-2", d.brand), brandSoft: v("--brand-soft", d.brandSoft), danger: v("--red", d.danger),
    font: (cs.fontFamily || d.font).replace(/"/g, "'"),
  };
  // a legible dark ink first, then the brand-safe hues
  const palette = [v("--brand-ink", DEFAULT_PALETTE[0]!), v("--red", DEFAULT_PALETTE[1]!), v("--cat-10", DEFAULT_PALETTE[2]!), v("--gold", DEFAULT_PALETTE[3]!), v("--green", DEFAULT_PALETTE[4]!), v("--cat-5", DEFAULT_PALETTE[5]!), v("--brand-2", DEFAULT_PALETTE[6]!), v("--violet", DEFAULT_PALETTE[7]!), v("--cat-1", DEFAULT_PALETTE[8]!)];
  if (!/^#/.test(paper.ink) || paper.ink.toLowerCase() === "#ffffff") paper.ink = palette[0]!;
  return { paper, palette };
}

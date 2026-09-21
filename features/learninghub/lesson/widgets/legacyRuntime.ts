// Runtime for the plain-JS widget files kept in scratch/prototype/widgets/*.js (copied into ./legacy/*.gen.ts by
// `npm run hub:widgets`). Each file is written for the prototype page and registers itself with
//     WIDGETS.myWidget = { title, intro, html(){ return "<div class=explore id=…>" }, init(){ …wire up…; addXP(2) } }
// using the helper globals `$ esc md shuffle addXP gcd`. `register(H)` below hands those in: `$` is scoped to the widget
// that is currently mounted (so ids never clash with the page), and `addXP` feeds the player's XP pill.

import { LEGACY_REGISTRARS } from "./legacy/manifest.gen";

export interface LegacyDef { title: string; intro: string; html(): string; init(): void }

export interface LegacyHelpers {
  WIDGETS: Record<string, LegacyDef>;
  $: (selector: string, el?: ParentNode) => Element | null;
  esc: (s: unknown) => string;
  md: (s: unknown) => string;
  shuffle: <T>(a: readonly T[]) => T[];
  addXP: (n: number) => void;
  gcd: (a: number, b: number) => number;
}

let root: HTMLElement | null = null;
let xp: (n: number) => void = () => undefined;

/** Point the helper globals at the widget that is about to be mounted (and back at nothing on unmount). */
export function bindLegacy(el: HTMLElement | null, onXP?: (n: number) => void) { root = el; xp = onXP ?? (() => undefined); }

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const helpers = (WIDGETS: Record<string, LegacyDef>): LegacyHelpers => ({
  WIDGETS,
  $: (s, el) => (el ?? root ?? document).querySelector(s),
  esc,
  md: (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>"),
  shuffle: (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; },
  addXP: (n) => xp(n),
  gcd,
});

let cache: Record<string, LegacyDef> | null = null;
/** Every widget the legacy files registered, by id. A file that throws is skipped (and logged), never fatal. */
export function legacyDefs(): Record<string, LegacyDef> {
  if (cache) return cache;
  const out: Record<string, LegacyDef> = {};
  for (const reg of LEGACY_REGISTRARS) {
    try { reg(helpers(out)); } catch (e) { console.warn("[lesson widgets] a legacy widget file failed to register:", e); }
  }
  cache = out;
  return out;
}

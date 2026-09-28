import { posIn, type Cam, type Callout, type Cursor, type Ring, type Scene, type Shot } from "./types";

// The element rectangles recorded with every captured screen (public/how-it-works/<name>.rects.json, percent of the screenshot).
// A cue that names an element (`el`) is resolved here, so rings, zooms, cursors and labels always land on the real thing.
export interface RectRow { t: string; id: string; tag: string; role: string; x: number; y: number; w: number; h: number }
export type RectMap = Record<string, RectRow[]>;   // key = the screenshot's src

export const rectsUrl = (src: string) => src.replace(/\.webp$/, ".rects.json");
export const sceneShots = (s: Scene): Shot[] => (s.shots?.length ? s.shots : s.shot ? [s.shot] : []);

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();
/** Find the element `el` names among a screen's rows. Order of tries: "#testid" / "id:x", "tag:h2", "section~Label", exact label, label starts with, label contains. "@n" picks the nth match. */
export function findRect(rows: RectRow[] | undefined, el: string): RectRow | null {
  if (!rows?.length || !el) return null;
  const m = /^(.*?)(?:@(\d+))?$/.exec(el.trim()); const q = m?.[1] ?? el; const nth = Math.max(1, Number(m?.[2] ?? 1));
  let hits: RectRow[];
  if (q.startsWith("#") || q.startsWith("id:")) { const id = q.replace(/^#|^id:/, ""); hits = rows.filter((r) => r.id === id); }
  else if (q.includes("~")) { const [a, lab] = q.split("~"); const n = norm(lab); hits = rows.filter((r) => (r.tag === a.trim() || r.role === a.trim()) && norm(r.t).startsWith(n)); }   // "section~Needs your attention" = that kind of element with that label
  else if (q.startsWith("tag:")) hits = rows.filter((r) => r.tag === q.slice(4));
  else if (q.startsWith("role:")) hits = rows.filter((r) => r.role === q.slice(5));
  else {
    const n = norm(q);
    hits = rows.filter((r) => norm(r.t) === n);
    if (!hits.length) hits = rows.filter((r) => norm(r.t).startsWith(n));
    if (!hits.length) hits = rows.filter((r) => norm(r.t).includes(n) && r.w * r.h < 3200);
    hits = [...hits].sort((a, b) => a.w * a.h - b.w * b.h);   // a bare label means the smallest thing that says it (the button, not the card around it)
  }
  // prefer the smallest sensible element (the button, not the whole card that contains its text)
  hits = hits.filter((r) => r.w >= 0.5 && r.h >= 0.5);
  return hits[nth - 1] ?? null;
}

/** Which of the scene's screens is showing when `on` is spoken (the last screen swap at or before that phrase). */
function shotAt(s: Scene, on: string): number {
  const at = on ? Math.max(0, posIn(s.say, on)) : 0; let k = 0;
  (s.shots ?? []).forEach((sh, n) => { if (!sh.on || posIn(s.say, sh.on) <= at) k = n; });
  return k;
}
/** Replace every `el` cue with numbers. A cue whose element is not on that screen is dropped (no ring over the wrong spot). Cues that already have numbers pass through. */
export function resolveScene(s: Scene, maps: RectMap): Scene {
  const shots = sceneShots(s);
  const rowsFor = (on: string) => maps[shots[Math.min(shots.length - 1, shotAt(s, on))]?.src ?? ""];
  const rect = (c: { on: string; el?: string }) => (c.el ? findRect(rowsFor(c.on), c.el) : null);
  const keep = <T extends { on: string; el?: string }>(list: T[] | undefined, f: (c: T, r: RectRow | null) => T | null): T[] | undefined =>
    list?.map((c) => { if (!c.el) return c; const r = rect(c); return r ? f(c, r) : null; }).filter((c): c is T => !!c);
  const cx = (r: RectRow) => r.x + r.w / 2, cy = (r: RectRow) => r.y + r.h / 2;
  return {
    ...s,
    cam: keep<Cam>(s.cam, (c, r) => ({ ...c, x: cx(r!), y: cy(r!), z: c.z ?? Math.max(1, Math.min(2.6, 62 / Math.max(r!.w * 1.1, r!.h * 1.9, 8))) })),
    rings: keep<Ring>(s.rings, (c, r) => ({ ...c, x: Math.max(0, r!.x - 0.6), y: Math.max(0, r!.y - 0.9), w: r!.w + 1.2, h: r!.h + 1.8 })),
    cursor: keep<Cursor>(s.cursor, (c, r) => ({ ...c, x: r!.x + Math.min(r!.w * 0.7, r!.w - 1), y: cy(r!) + r!.h * 0.15 })),
    callouts: keep<Callout>(s.callouts, (c, r) => ({ ...c, x: r!.x + r!.w, y: cy(r!), dir: c.dir ?? "right" })),
  };
}
/** Every `el` a scene names that does NOT resolve against the recorded rects (used by the spec so nothing silently loses its ring). */
export function unresolved(s: Scene, maps: RectMap): string[] {
  const shots = sceneShots(s); const out: string[] = [];
  const all = [...(s.cam ?? []), ...(s.rings ?? []), ...(s.cursor ?? []), ...(s.callouts ?? [])];
  for (const c of all) if (c.el && !findRect(maps[shots[Math.min(shots.length - 1, shotAt(s, c.on))]?.src ?? ""], c.el)) out.push(`${s.id}: "${c.el}" @ "${c.on}"`);
  return out;
}

import { compile, sample, type Fn } from "./toolkit/mathExpr";
import { LINE_H, type El } from "./model";
import { wrapLines, type Env } from "./render";

// The toolkit's data-driven stamps: periodic table, function plotter, Bohr atom,
// circuit symbols, lab apparatus, lens ray diagrams, timelines, text-to-annotate,
// countdown timer and outline maps. Each is one compact element (all state is in
// `opts`), so a board full of them stays tiny. All vector, all from public
// knowledge (element symbols/masses, schematic continent outlines).

const o = (e: El, k: string, d: number | string | boolean) => { const v = e.opts?.[k]; return v === undefined ? d : v; };
const n = (e: El, k: string, d: number) => { const v = Number(o(e, k, d)); return Number.isFinite(v) ? v : d; };
const s = (e: El, k: string, d = "") => String(o(e, k, d));

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const card = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, env: Env, r = 10) => { ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.strokeStyle = env.paper.gridStrong; ctx.lineWidth = 1.4 / env.k; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke(); };

// ── periodic table ──────────────────────────────────────────────────────────
const SYM = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(" ");
const MASS = [1.008, 4.003, 6.94, 9.012, 10.81, 12.011, 14.007, 15.999, 18.998, 20.18, 22.99, 24.305, 26.982, 28.085, 30.974, 32.06, 35.45, 39.948, 39.098, 40.078, 44.956, 47.867, 50.942, 51.996, 54.938, 55.845, 58.933, 58.693, 63.546, 65.38, 69.723, 72.63, 74.922, 78.971, 79.904, 83.798, 85.468, 87.62, 88.906, 91.224, 92.906, 95.95, 98, 101.07, 102.91, 106.42, 107.87, 112.41, 114.82, 118.71, 121.76, 127.6, 126.9, 131.29, 132.91, 137.33, 138.91, 140.12, 140.91, 144.24, 145, 150.36, 151.96, 157.25, 158.93, 162.5, 164.93, 167.26, 168.93, 173.05, 174.97, 178.49, 180.95, 183.84, 186.21, 190.23, 192.22, 195.08, 196.97, 200.59, 204.38, 207.2, 208.98, 209, 210, 222, 223, 226, 227, 232.04, 231.04, 238.03, 237, 244, 243, 247, 247, 251, 252, 257, 258, 259, 266];
export const ELEMENT_SYMBOLS = SYM;

/** Table position (col 0–17, row 0–9) of element Z (1–118). Lanthanides/actinides sit in rows 8–9. */
export function pos(z: number): { c: number; r: number } {
  if (z === 1) return { c: 0, r: 0 };
  if (z === 2) return { c: 17, r: 0 };
  if (z <= 4) return { c: z - 3, r: 1 };
  if (z <= 10) return { c: z + 7, r: 1 };
  if (z <= 12) return { c: z - 11, r: 2 };
  if (z <= 18) return { c: z - 1, r: 2 };
  if (z <= 36) return { c: z - 19, r: 3 };
  if (z <= 54) return { c: z - 37, r: 4 };
  if (z <= 56) return { c: z - 55, r: 5 };
  if (z <= 71) return { c: z - 57 + 2, r: 8 };
  if (z <= 86) return { c: z - 72 + 3, r: 5 };
  if (z <= 88) return { c: z - 87, r: 6 };
  if (z <= 103) return { c: z - 89 + 2, r: 9 };
  return { c: z - 104 + 3, r: 6 };
}
const CAT = (z: number) => {
  if ([1, 6, 7, 8, 15, 16, 34].includes(z)) return 0;            // reactive non-metals
  if ([2, 10, 18, 36, 54, 86, 118].includes(z)) return 1;        // noble gases
  if ([3, 11, 19, 37, 55, 87].includes(z)) return 2;             // alkali metals
  if ([4, 12, 20, 38, 56, 88].includes(z)) return 3;             // alkaline earth
  if ([5, 14, 32, 33, 51, 52].includes(z)) return 4;             // metalloids
  if ([9, 17, 35, 53, 85, 117].includes(z)) return 5;            // halogens
  if ((z >= 57 && z <= 71)) return 7;                            // lanthanides
  if ((z >= 89 && z <= 103)) return 8;                           // actinides
  if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 6; // post-transition
  return 9;                                                       // transition metals
};
const CAT_COL = ["#bfe9d2", "#e6dcff", "#ffd6d6", "#ffe3c2", "#d6f0ef", "#fff3b0", "#dbe4f0", "#f3d9ee", "#f7d1e0", "#cfe4ff"];
export const CAT_NAMES = ["Reactive non-metal", "Noble gas", "Alkali metal", "Alkaline earth metal", "Metalloid", "Halogen", "Post-transition metal", "Lanthanide", "Actinide", "Transition metal"];
/** Which element (Z) is at board point (x, y) of a periodic-table stamp? */
export function periodicHit(e: El, x: number, y: number): number | null {
  const w = e.w ?? 1120, h = e.h ?? 640, cw = w / 18, ch = h / 10;
  const c = Math.floor((x - (e.x ?? 0)) / cw), r = Math.floor((y - (e.y ?? 0)) / ch);
  for (let z = 1; z <= 118; z++) { const p = pos(z); if (p.c === c && p.r === r) return z; }
  return null;
}

function drawPeriodic(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 1120, h = e.h ?? 640, cw = w / 18, ch = h / 10;
  const sel = new Set(s(e, "sel").split(",").filter(Boolean).map(Number)), colour = !!o(e, "colour", true);
  card(ctx, x - 10, y - 10, w + 20, h + 20, env, 12);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let z = 1; z <= 118; z++) {
    const p = pos(z), tx = x + p.c * cw + 2, ty = y + p.r * ch + 2 + (p.r >= 8 ? 8 : 0);
    ctx.fillStyle = colour ? CAT_COL[CAT(z)]! : "#ffffff";
    rr(ctx, tx, ty, cw - 4, ch - 4, 5); ctx.fill();
    ctx.strokeStyle = sel.has(z) ? env.paper.danger : env.paper.gridStrong; ctx.lineWidth = (sel.has(z) ? 4 : 1.2) / env.k; ctx.stroke();
    ctx.fillStyle = env.paper.label; ctx.font = `600 ${cw * 0.2}px ${env.paper.font}`; ctx.textAlign = "left"; ctx.fillText(String(z), tx + 4, ty + ch * 0.17);
    ctx.textAlign = "center"; ctx.fillStyle = env.paper.ink; ctx.font = `800 ${cw * 0.4}px ${env.paper.font}`; ctx.fillText(SYM[z - 1]!, tx + (cw - 4) / 2, ty + ch * 0.5);
    ctx.fillStyle = env.paper.label; ctx.font = `500 ${cw * 0.19}px ${env.paper.font}`;
    ctx.fillText(z <= MASS.length ? String(MASS[z - 1]) : "—", tx + (cw - 4) / 2, ty + ch * 0.8);
  }
  // f-block markers + legend
  ctx.fillStyle = env.paper.label; ctx.font = `600 ${cw * 0.24}px ${env.paper.font}`; ctx.textAlign = "right";
  ctx.fillText("57–71", x + 2.9 * cw, y + 5.5 * ch); ctx.fillText("89–103", x + 2.9 * cw, y + 6.5 * ch);
  if (colour) { ctx.textAlign = "left"; ctx.font = `600 ${cw * 0.2}px ${env.paper.font}`; CAT_NAMES.forEach((nm, i) => { const lx = x + (2.6 + (i % 4) * 2.25) * cw, ly = y + (0.3 + 0.55 * Math.floor(i / 4)) * ch; ctx.fillStyle = CAT_COL[i]!; ctx.fillRect(lx, ly - 6, 14, 14); ctx.strokeStyle = env.paper.gridStrong; ctx.strokeRect(lx, ly - 6, 14, 14); ctx.fillStyle = env.paper.label; ctx.fillText(nm, lx + 20, ly + 2); }); }
}

// ── function plotter ───────────────────────────────────────────────────────
const fnCache = new Map<string, Fn | null>();
const fn = (src: string) => { if (!fnCache.has(src)) { if (fnCache.size > 200) fnCache.clear(); fnCache.set(src, compile(src)); } return fnCache.get(src)!; };
function drawPlot(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 460, h = e.h ?? 460, R = Math.max(1, n(e, "range", 10)), cx = x + w / 2, cy = y + h / 2, sx = w / (2 * R), sy = h / (2 * R);
  const P = env.paper;
  card(ctx, x - 24, y - 24, w + 48, h + 48, env);
  ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
  const gs = R > 30 ? 5 : R > 20 ? 2 : 1;
  for (let i = -R; i <= R; i += gs) { ctx.moveTo(cx + i * sx, y); ctx.lineTo(cx + i * sx, y + h); ctx.moveTo(x, cy + i * sy); ctx.lineTo(x + w, cy + i * sy); }
  ctx.stroke();
  ctx.strokeStyle = P.axis; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke();
  ctx.fillStyle = P.label; ctx.font = `600 ${R > 12 ? 9 : 11}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const every = R > 30 ? 10 : R > 20 ? 5 : R > 12 ? 2 : 1;
  for (let i = -R; i <= R; i++) if (i && i % every === 0) { ctx.fillText(String(i), cx + i * sx, cy + 11); ctx.fillText(String(i), cx - 11, cy - i * sy); }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  [[s(e, "expr"), P.brand], [s(e, "expr2"), P.danger]].forEach(([src, col]) => {
    const f = src ? fn(src) : null; if (!f) return;
    ctx.strokeStyle = col!; ctx.lineWidth = 3.2; ctx.lineJoin = "round";
    for (const seg of sample(f, -R, R, -R, R, 600)) { ctx.beginPath(); seg.forEach((p, i) => (i ? ctx.lineTo(cx + p.x * sx, cy - p.y * sy) : ctx.moveTo(cx + p.x * sx, cy - p.y * sy))); ctx.stroke(); }
  });
  ctx.restore();
  const label = [s(e, "expr") && `y = ${s(e, "expr").replace(/^\s*y\s*=\s*/i, "")}`, s(e, "expr2") && `y = ${s(e, "expr2").replace(/^\s*y\s*=\s*/i, "")}`].filter(Boolean);
  ctx.textAlign = "left"; ctx.font = `700 15px ${P.font}`;
  label.forEach((t, i) => { ctx.fillStyle = i ? P.danger : P.brand; ctx.fillText(t, x + 8, y - 10 + (i - label.length + 1) * 0 + i * 0 - (label.length - 1 - i) * 18); });
}

// ── Bohr atom ──────────────────────────────────────────────────────────────
function drawBohr(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 300, h = e.h ?? 300, cx = x + w / 2, cy = y + h / 2, P = env.paper;
  const shells = s(e, "shells", "2,8,1").split(",").map((v) => Math.max(0, Math.min(32, Number(v) || 0)));
  const R = Math.min(w, h) / 2 - 6, nuc = R * 0.2, step = (R - nuc - 8) / Math.max(1, shells.length);
  card(ctx, x - 4, y - 4, w + 8, h + 8, env, Math.min(w, h) / 2);
  shells.forEach((cnt, i) => {
    const r = nuc + 8 + step * (i + 1) - step * 0.35;
    ctx.strokeStyle = P.gridStrong; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = P.brand;
    for (let j = 0; j < cnt; j++) { const a = -Math.PI / 2 + (j / cnt) * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + r * Math.cos(a), cy + r * Math.sin(a), Math.max(4, R * 0.045), 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.fillStyle = P.danger; ctx.beginPath(); ctx.arc(cx, cy, nuc, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = `800 ${nuc * 0.95}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s(e, "symbol", "Na"), cx, cy + 1);
}

// ── circuit symbols ────────────────────────────────────────────────────────
export const SYMBOL_KINDS = ["cell", "battery", "lamp", "switch-open", "switch-closed", "resistor", "variable-resistor", "ammeter", "voltmeter", "diode", "led", "fuse", "motor", "buzzer"] as const;
function drawSymbol(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 150, h = e.h ?? 90, cx = x + w / 2, cy = y + h / 2, P = env.paper, k = s(e, "kind", "cell");
  ctx.strokeStyle = e.c ?? P.ink; ctx.fillStyle = e.c ?? P.ink; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const u = Math.min(w / 6, h / 3.2);
  const wire = (a: number, b: number) => { ctx.beginPath(); ctx.moveTo(a, cy); ctx.lineTo(b, cy); ctx.stroke(); };
  const circle = (r: number, txt?: string) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = e.c ?? P.ink; if (txt) { ctx.font = `800 ${r * 1.1}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, cx, cy + 1); } };
  if (k === "cell") { wire(x, cx - u * 0.35); wire(cx + u * 0.35, x + w); ctx.beginPath(); ctx.moveTo(cx - u * 0.35, cy - u * 1.1); ctx.lineTo(cx - u * 0.35, cy + u * 1.1); ctx.stroke(); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(cx + u * 0.35, cy - u * 0.6); ctx.lineTo(cx + u * 0.35, cy + u * 0.6); ctx.stroke(); }
  else if (k === "battery") { wire(x, cx - u * 1.05); wire(cx + u * 1.05, x + w); for (const [dx, tall] of [[-1.05, 1.1], [-0.35, 0.6], [0.35, 1.1], [1.05, 0.6]] as const) { ctx.lineWidth = tall > 1 ? 3.5 : 7; ctx.beginPath(); ctx.moveTo(cx + dx * u, cy - u * tall); ctx.lineTo(cx + dx * u, cy + u * tall); ctx.stroke(); } }
  else if (k === "lamp") { wire(x, cx - u * 1.2); wire(cx + u * 1.2, x + w); circle(u * 1.2); ctx.beginPath(); ctx.moveTo(cx - u * 0.85, cy - u * 0.85); ctx.lineTo(cx + u * 0.85, cy + u * 0.85); ctx.moveTo(cx + u * 0.85, cy - u * 0.85); ctx.lineTo(cx - u * 0.85, cy + u * 0.85); ctx.stroke(); }
  else if (k === "switch-open" || k === "switch-closed") { wire(x, cx - u * 1.3); wire(cx + u * 1.3, x + w); ctx.beginPath(); ctx.arc(cx - u * 1.3, cy, 4, 0, 7); ctx.arc(cx + u * 1.3, cy, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - u * 1.3, cy); if (k === "switch-open") ctx.lineTo(cx + u * 0.9, cy - u * 1.2); else ctx.lineTo(cx + u * 1.3, cy); ctx.stroke(); }
  else if (k === "resistor" || k === "variable-resistor" || k === "fuse") { wire(x, cx - u * 1.5); wire(cx + u * 1.5, x + w); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.rect(cx - u * 1.5, cy - u * 0.6, u * 3, u * 1.2); ctx.fill(); ctx.stroke(); if (k === "fuse") { ctx.beginPath(); ctx.moveTo(cx - u * 1.5, cy); ctx.lineTo(cx + u * 1.5, cy); ctx.stroke(); } if (k === "variable-resistor") { ctx.beginPath(); ctx.moveTo(cx - u * 1.3, cy + u * 1.5); ctx.lineTo(cx + u * 1.3, cy - u * 1.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + u * 1.3, cy - u * 1.5); ctx.lineTo(cx + u * 0.6, cy - u * 1.35); ctx.moveTo(cx + u * 1.3, cy - u * 1.5); ctx.lineTo(cx + u * 1.15, cy - u * 0.8); ctx.stroke(); } }
  else if (k === "ammeter") { wire(x, cx - u * 1.2); wire(cx + u * 1.2, x + w); circle(u * 1.2, "A"); }
  else if (k === "voltmeter") { wire(x, cx - u * 1.2); wire(cx + u * 1.2, x + w); circle(u * 1.2, "V"); }
  else if (k === "motor") { wire(x, cx - u * 1.2); wire(cx + u * 1.2, x + w); circle(u * 1.2, "M"); }
  else if (k === "buzzer") { wire(x, cx - u * 1.2); wire(cx + u * 1.2, x + w); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, u * 1.2, Math.PI, 0); ctx.lineTo(cx + u * 1.2, cy + u * 0.4); ctx.lineTo(cx - u * 1.2, cy + u * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (k === "diode" || k === "led") { wire(x, cx - u); wire(cx + u, x + w); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cx - u, cy - u); ctx.lineTo(cx + u, cy); ctx.lineTo(cx - u, cy + u); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + u, cy - u); ctx.lineTo(cx + u, cy + u); ctx.stroke(); if (k === "led") { ctx.lineWidth = 2.6; for (const dx of [-0.2, 0.55]) { ctx.beginPath(); ctx.moveTo(cx + dx * u, cy - u * 1.1); ctx.lineTo(cx + (dx + 0.7) * u, cy - u * 2); ctx.stroke(); } } }
  ctx.font = `700 13px ${P.font}`; ctx.fillStyle = P.label; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(k.replace("-", " "), cx, y + h - 2);
}

// ── lab apparatus ──────────────────────────────────────────────────────────
export const APPARATUS_KINDS = ["beaker", "conical-flask", "test-tube", "measuring-cylinder", "funnel", "bunsen-burner", "round-flask", "tripod"] as const;
function drawApparatus(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 130, h = e.h ?? 170, cx = x + w / 2, P = env.paper, k = s(e, "kind", "beaker");
  ctx.strokeStyle = e.c ?? P.ink; ctx.lineWidth = 3.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
  const glass = () => { ctx.fillStyle = "rgba(200,225,250,.4)"; ctx.fill(); ctx.stroke(); };
  const liquid = (x0: number, x1: number, top: number, bot: number) => { ctx.fillStyle = "rgba(47,107,216,.28)"; ctx.fillRect(x0, top, x1 - x0, bot - top); };
  if (k === "beaker") { liquid(x + w * 0.17, x + w * 0.83, y + h * 0.42, y + h * 0.93); ctx.beginPath(); ctx.moveTo(x + w * 0.12, y + h * 0.06); ctx.lineTo(x + w * 0.16, y + h * 0.94); ctx.quadraticCurveTo(x + w * 0.17, y + h, x + w * 0.24, y + h); ctx.lineTo(x + w * 0.76, y + h); ctx.quadraticCurveTo(x + w * 0.83, y + h, x + w * 0.84, y + h * 0.94); ctx.lineTo(x + w * 0.88, y + h * 0.06); ctx.stroke(); ctx.beginPath(); for (let i = 1; i <= 4; i++) { ctx.moveTo(x + w * 0.16, y + h * (0.18 + i * 0.16)); ctx.lineTo(x + w * 0.3, y + h * (0.18 + i * 0.16)); } ctx.lineWidth = 2; ctx.stroke(); }
  else if (k === "conical-flask") { ctx.beginPath(); ctx.moveTo(cx - w * 0.12, y); ctx.lineTo(cx - w * 0.12, y + h * 0.3); ctx.lineTo(x + w * 0.05, y + h * 0.93); ctx.quadraticCurveTo(x + w * 0.05, y + h, x + w * 0.14, y + h); ctx.lineTo(x + w * 0.86, y + h); ctx.quadraticCurveTo(x + w * 0.95, y + h, x + w * 0.95, y + h * 0.93); ctx.lineTo(cx + w * 0.12, y + h * 0.3); ctx.lineTo(cx + w * 0.12, y); glass(); ctx.beginPath(); ctx.moveTo(x + w * 0.19, y + h * 0.66); ctx.lineTo(x + w * 0.81, y + h * 0.66); ctx.lineWidth = 2; ctx.stroke(); }
  else if (k === "test-tube") { ctx.beginPath(); ctx.moveTo(cx - w * 0.2, y); ctx.lineTo(cx - w * 0.2, y + h * 0.9); ctx.arc(cx, y + h * 0.9, w * 0.2, Math.PI, 0, true); ctx.lineTo(cx + w * 0.2, y); ctx.stroke(); ctx.fillStyle = "rgba(47,107,216,.28)"; ctx.beginPath(); ctx.moveTo(cx - w * 0.2, y + h * 0.45); ctx.lineTo(cx - w * 0.2, y + h * 0.9); ctx.arc(cx, y + h * 0.9, w * 0.2, Math.PI, 0, true); ctx.lineTo(cx + w * 0.2, y + h * 0.45); ctx.fill(); }
  else if (k === "measuring-cylinder") { ctx.beginPath(); ctx.rect(cx - w * 0.2, y + h * 0.04, w * 0.4, h * 0.88); glass(); ctx.fillStyle = e.c ?? P.ink; ctx.fillRect(cx - w * 0.36, y + h * 0.92, w * 0.72, h * 0.08); liquid(cx - w * 0.2, cx + w * 0.2, y + h * 0.4, y + h * 0.92); ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 9; i++) { const yy = y + h * (0.12 + i * 0.09); ctx.moveTo(cx + w * 0.2, yy); ctx.lineTo(cx + w * (i % 2 ? 0.08 : 0.0), yy); } ctx.stroke(); }
  else if (k === "funnel") { ctx.beginPath(); ctx.moveTo(x + w * 0.05, y + h * 0.05); ctx.lineTo(cx - w * 0.06, y + h * 0.55); ctx.lineTo(cx - w * 0.06, y + h); ctx.lineTo(cx + w * 0.06, y + h); ctx.lineTo(cx + w * 0.06, y + h * 0.55); ctx.lineTo(x + w * 0.95, y + h * 0.05); ctx.closePath(); glass(); }
  else if (k === "bunsen-burner") { ctx.fillStyle = "#9aa5b8"; ctx.beginPath(); ctx.moveTo(cx - w * 0.3, y + h); ctx.lineTo(cx + w * 0.3, y + h); ctx.lineTo(cx + w * 0.08, y + h * 0.9); ctx.lineTo(cx - w * 0.08, y + h * 0.9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(cx - w * 0.07, y + h * 0.35, w * 0.14, h * 0.55); ctx.strokeRect(cx - w * 0.07, y + h * 0.35, w * 0.14, h * 0.55); ctx.fillStyle = "#f5b81f"; ctx.beginPath(); ctx.moveTo(cx, y); ctx.quadraticCurveTo(cx + w * 0.16, y + h * 0.22, cx + w * 0.07, y + h * 0.35); ctx.lineTo(cx - w * 0.07, y + h * 0.35); ctx.quadraticCurveTo(cx - w * 0.16, y + h * 0.22, cx, y); ctx.fill(); ctx.strokeStyle = "#e26a1d"; ctx.lineWidth = 2.5; ctx.stroke(); }
  else if (k === "round-flask") { ctx.beginPath(); ctx.moveTo(cx - w * 0.1, y); ctx.lineTo(cx - w * 0.1, y + h * 0.3); ctx.arc(cx, y + h * 0.65, w * 0.42, Math.atan2(-0.35, -0.1) + 0.1, Math.PI * 2 + Math.atan2(-0.35, 0.1) - 0.1, true); ctx.lineTo(cx + w * 0.1, y); glass(); }
  else if (k === "tripod") { ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h * 0.2); ctx.lineTo(x + w * 0.9, y + h * 0.2); ctx.moveTo(x + w * 0.2, y + h * 0.2); ctx.lineTo(x + w * 0.12, y + h); ctx.moveTo(x + w * 0.8, y + h * 0.2); ctx.lineTo(x + w * 0.88, y + h); ctx.moveTo(cx, y + h * 0.2); ctx.lineTo(cx, y + h); ctx.stroke(); ctx.fillStyle = "rgba(150,160,180,.35)"; ctx.fillRect(x + w * 0.1, y + h * 0.13, w * 0.8, h * 0.07); }
  ctx.font = `700 12px ${P.font}`; ctx.fillStyle = P.label; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(k.replace(/-/g, " "), cx, y + h + 14);
}

// ── lens ray diagram ───────────────────────────────────────────────────────
function drawLens(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 760, h = e.h ?? 380, cx = x + w / 2, cy = y + h / 2, P = env.paper;
  const convex = s(e, "type", "convex") !== "concave", f0 = Math.max(20, n(e, "f", 140)), f = convex ? f0 : -f0, u = Math.max(10, n(e, "obj", 260)), ho = h * 0.2;
  card(ctx, x, y, w, h, env);
  ctx.strokeStyle = P.axis; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, cy); ctx.lineTo(x + w - 8, cy); ctx.stroke();
  // lens
  ctx.strokeStyle = P.brand; ctx.lineWidth = 4; ctx.beginPath();
  const lh = h * 0.42;
  if (convex) { ctx.moveTo(cx, cy - lh); ctx.quadraticCurveTo(cx + 20, cy, cx, cy + lh); ctx.quadraticCurveTo(cx - 20, cy, cx, cy - lh); }
  else { ctx.moveTo(cx - 14, cy - lh); ctx.quadraticCurveTo(cx + 2, cy, cx - 14, cy + lh); ctx.moveTo(cx + 14, cy - lh); ctx.quadraticCurveTo(cx - 2, cy, cx + 14, cy + lh); }
  ctx.stroke();
  ctx.fillStyle = P.ink; ctx.font = `700 14px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sgn * f0, cy, 4, 0, 7); ctx.fill(); ctx.fillText("F", cx + sgn * f0, cy + 8); }
  // object & image (lens equation: 1/v = 1/f - 1/u)
  const denom = 1 / f - 1 / u; const v = Math.abs(denom) < 1e-6 ? Infinity : 1 / denom, hi = Number.isFinite(v) ? -ho * (v / u) : 0;
  const ox = cx - u, ty = cy - ho;
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ox, cy); ctx.lineTo(ox, ty); ctx.stroke(); arrowHead(ctx, ox, ty, -Math.PI / 2);
  const ray = (px: number, py: number, dx: number, dy: number, colour: string) => { // from the lens point (px,py) heading (dx,dy)
    ctx.strokeStyle = colour; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(ox, ty); ctx.lineTo(px, py); const L = x + w - 8 - px; ctx.lineTo(px + L, py + (dy / (dx || 1e-9)) * L); ctx.stroke();
  };
  const ix = cx + v, iy = cy - hi;
  const dir = (px: number, py: number) => Number.isFinite(v) ? { dx: ix - px, dy: iy - py } : { dx: 1, dy: 0 };
  ray(cx, ty, dir(cx, ty).dx * Math.sign(v || 1), dir(cx, ty).dy * Math.sign(v || 1), P.danger);         // parallel ray → through the image
  ray(cx, cy, cx - ox, cy - ty, "#15b364");                                                               // undeviated through the centre
  if (Number.isFinite(v) && v < 0 || !convex) { ctx.setLineDash([6, 5]); ctx.strokeStyle = P.axis; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(ix, iy); ctx.moveTo(cx, cy); ctx.lineTo(ix, iy); ctx.stroke(); ctx.setLineDash([]); }
  if (Number.isFinite(v) && ix > x && ix < x + w) { ctx.strokeStyle = P.brand; ctx.lineWidth = 4; if (v < 0 || !convex) ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(ix, cy); ctx.lineTo(ix, iy); ctx.stroke(); ctx.setLineDash([]); arrowHead(ctx, ix, iy, hi > 0 ? -Math.PI / 2 : Math.PI / 2); }
  ctx.fillStyle = P.label; ctx.font = `600 13px ${P.font}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  const nature = !Number.isFinite(v) ? "image at infinity" : `${v > 0 ? "real" : "virtual"}, ${hi > 0 ? "upright" : "inverted"}, ${Math.abs(v / u) > 1 ? "magnified" : "diminished"}`;
  ctx.fillText(`${convex ? "Convex" : "Concave"} lens · f = ${f0} · image: ${nature}`, x + 12, y + h - 10);
}
function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 11 * Math.cos(a - 0.5), y - 11 * Math.sin(a - 0.5)); ctx.moveTo(x, y); ctx.lineTo(x - 11 * Math.cos(a + 0.5), y - 11 * Math.sin(a + 0.5)); ctx.stroke(); }

// ── timeline ───────────────────────────────────────────────────────────────
export function parseEvents(text: string): { year: number; label: string }[] {
  return text.split(/[;\n]/).map((t) => t.trim()).filter(Boolean).map((t) => { const [y, ...rest] = t.split("|"); return { year: Number(y), label: rest.join("|").trim() }; }).filter((x) => Number.isFinite(x.year));
}
/** A year as people write it: negative years are BC. */
const yearLabel = (yr: number) => (yr < 0 ? `${-yr} BC` : String(yr));
function niceStep(span: number) { const raw = span / 10, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function drawTimeline(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 900, h = e.h ?? 260, P = env.paper, cy = y + h / 2;
  const a = n(e, "start", 1000), b = Math.max(a + 1, n(e, "end", 2000)), X = (yr: number) => x + 30 + ((yr - a) / (b - a)) * (w - 60);
  card(ctx, x, y, w, h, env);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 14, cy); ctx.lineTo(x + w - 14, cy); ctx.stroke(); arrowHead(ctx, x + w - 14, cy, 0);
  const step = niceStep(b - a); ctx.font = `600 13px ${P.font}`; ctx.fillStyle = P.label; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.lineWidth = 2; ctx.strokeStyle = P.axis;
  for (let yr = Math.ceil(a / step) * step; yr <= b; yr += step) { ctx.beginPath(); ctx.moveTo(X(yr), cy - 8); ctx.lineTo(X(yr), cy + 8); ctx.stroke(); ctx.fillText(yearLabel(yr), X(yr), cy + 11); }
  parseEvents(s(e, "events")).forEach((ev, i) => {
    if (ev.year < a || ev.year > b) return;
    const up = i % 2 === 0, ex = X(ev.year), by = up ? y + 14 : y + h - 70;
    ctx.strokeStyle = P.brand; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ex, cy); ctx.lineTo(ex, up ? by + 54 : by); ctx.stroke();
    ctx.fillStyle = P.brand; ctx.beginPath(); ctx.arc(ex, cy, 7, 0, 7); ctx.fill();
    const lines = wrapLines(ev.label, 132, 14, false).slice(0, 3), bw = 150;
    const bx = Math.max(x + 6, Math.min(x + w - bw - 6, ex - bw / 2));
    ctx.fillStyle = P.brandSoft; ctx.strokeStyle = P.brand; ctx.lineWidth = 1.6; rr(ctx, bx, by, bw, 54, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `800 14px ${P.font}`; ctx.fillText(yearLabel(ev.year), bx + bw / 2, by + 4);
    ctx.font = `600 12px ${P.font}`; lines.forEach((l, j) => ctx.fillText(l, bx + bw / 2, by + 21 + j * 12.5));
  });
}

// ── text block / timer ─────────────────────────────────────────────────────
function drawTextBlock(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 720, size = n(e, "size", 24), P = env.paper;
  const lines = wrapLines(s(e, "text"), w - 44, size, false), lh = size * 1.65, h = Math.max(e.h ?? 0, lines.length * lh + 36);
  ctx.fillStyle = "#fffdf6"; ctx.strokeStyle = P.gridStrong; ctx.lineWidth = 1.6 / env.k; ctx.shadowColor = "rgba(20,30,60,.12)"; ctx.shadowBlur = 8; rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.shadowColor = "transparent"; ctx.stroke();
  ctx.fillStyle = P.ink; ctx.font = `500 ${size}px ${P.font}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
  lines.forEach((l, i) => ctx.fillText(l, x + 22, y + 18 + i * lh));
}
export const timerLeft = (e: El, now = Date.now()) => { const end = n(e, "endsAt", 0); return end > 0 ? Math.max(0, Math.round((end - now) / 1000)) : n(e, "left", n(e, "secs", 300)); };
export const timerRunning = (e: El, now = Date.now()) => e.stamp === "timer" && n(e, "endsAt", 0) > now;
function drawTimer(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 260, h = e.h ?? 130, left = timerLeft(e), P = env.paper, run = timerRunning(e);
  ctx.fillStyle = left <= 10 && (run || left === 0) ? "#fdebec" : "#fff"; ctx.strokeStyle = left <= 10 && run ? P.danger : P.gridStrong; ctx.lineWidth = 3 / env.k; rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.stroke();
  ctx.fillStyle = left <= 10 && run ? P.danger : P.ink; ctx.font = `800 ${h * 0.5}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, x + w / 2, y + h * 0.48);
  ctx.fillStyle = P.label; ctx.font = `700 ${h * 0.11}px ${P.font}`; ctx.fillText(run ? "counting down" : left === 0 ? "time's up" : "ready", x + w / 2, y + h * 0.86);
}

// ── outline maps ───────────────────────────────────────────────────────────
type Pt = [number, number];
/** Schematic outlines (lon, lat), simplified by hand — recognisable for labelling, not survey-accurate. */
const LAND: Record<string, Pt[]> = {
  namerica: [[-168, 66], [-162, 70], [-141, 70], [-128, 70], [-115, 68], [-95, 72], [-85, 70], [-80, 63], [-94, 59], [-93, 56], [-82, 53], [-79, 58], [-77, 62], [-70, 60], [-62, 58], [-56, 52], [-66, 45], [-70, 42], [-76, 38], [-76, 35], [-81, 31], [-80, 26], [-82, 26], [-84, 30], [-90, 30], [-94, 29], [-97, 26], [-97, 22], [-92, 19], [-90, 21], [-87, 21], [-88, 16], [-83, 15], [-83, 10], [-80, 8], [-78, 9], [-84, 9], [-87, 13], [-94, 16], [-105, 20], [-106, 23], [-112, 29], [-115, 30], [-110, 23], [-115, 28], [-118, 34], [-121, 37], [-124, 42], [-124, 48], [-130, 54], [-135, 58], [-142, 60], [-150, 60], [-158, 57], [-165, 55], [-160, 59], [-166, 62]],
  greenland: [[-73, 78], [-60, 82], [-30, 83], [-20, 80], [-20, 70], [-30, 68], [-43, 60], [-52, 65], [-55, 70], [-68, 76]],
  samerica: [[-78, 9], [-72, 12], [-63, 10], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-39, -15], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-62, -40], [-65, -45], [-68, -52], [-72, -54], [-74, -48], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -6], [-80, 0], [-77, 4]],
  eurasia: [[-9, 37], [-9, 43], [-2, 43.5], [-1, 46], [-4.5, 48.5], [2, 51], [8, 54], [9, 57], [12, 56], [12, 54], [20, 54.5], [22, 57], [24, 59], [30, 60], [22, 60.5], [21, 63], [25, 65.5], [22, 66], [17, 62], [19, 59], [16, 56], [12, 56], [11, 59], [5, 59], [5, 62], [14, 67], [20, 70], [30, 70], [40, 67], [45, 68], [60, 69], [70, 73], [80, 73], [100, 77], [115, 74], [130, 71], [145, 72], [160, 70], [170, 70], [180, 68], [180, 65], [170, 60], [163, 58], [156, 51], [155, 58], [142, 59], [135, 54], [141, 52], [140, 48], [132, 43], [129, 41], [128, 35], [126, 37], [125, 40], [121, 40], [122, 37], [119, 36], [122, 31], [120, 26], [112, 21], [108, 21], [106, 18], [109, 12], [105, 9], [101, 13], [100, 7], [104, 1], [100, 4], [98, 9], [98, 16], [94, 17], [91, 22], [87, 21], [80, 15], [80, 10], [77, 8], [73, 17], [72, 21], [67, 24], [62, 25], [57, 26], [56, 27], [50, 30], [48, 29], [51, 25], [56, 25], [59, 22], [52, 16], [43, 13], [43, 17], [35, 28], [34, 31], [36, 35], [30, 36], [27, 37], [26, 40], [29, 41], [24, 40], [23, 37], [21, 39], [19, 42], [13, 45], [16, 41], [18, 40], [16, 38], [12, 42], [8, 44], [3, 43], [0, 39], [-2, 37], [-6, 36]],
  africa: [[-17, 15], [-16, 22], [-13, 28], [-9, 32], [-6, 36], [10, 37], [11, 33], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [42, -2], [40, -10], [35, -20], [33, -26], [28, -33], [20, -35], [18, -32], [12, -17], [13, -8], [9, -1], [9, 4], [3, 6], [-8, 4], [-13, 8]],
  madagascar: [[44, -25], [47, -25], [50, -16], [49, -12], [44, -17]],
  australia: [[114, -22], [122, -18], [130, -12], [137, -12], [136, -15], [141, -11], [146, -19], [153, -26], [151, -34], [146, -39], [140, -38], [135, -34], [130, -32], [115, -34], [113, -26]],
  antarctica: [[-180, -72], [-120, -74], [-60, -64], [-58, -72], [0, -70], [60, -67], [120, -66], [180, -70], [180, -85], [-180, -85]],
  britain: [[-5.7, 50.0], [1.4, 51.2], [1.7, 52.7], [0.3, 53.5], [-1.5, 55], [-2, 57.5], [-3, 58.6], [-5, 58.6], [-6, 57], [-5.5, 55.8], [-4.5, 54.7], [-3, 54.6], [-3.2, 53.4], [-4.7, 53.3], [-4, 52.4], [-5.2, 51.9], [-3.3, 51.4], [-5.1, 50.6]],
  ireland: [[-10, 51.8], [-6.3, 52.2], [-6, 53.5], [-5.7, 54.6], [-7.3, 55.3], [-8.5, 54.5], [-10, 54], [-9.8, 52.5]],
  iceland: [[-24, 64.4], [-22, 66.2], [-15, 66.5], [-13.5, 65], [-18, 63.4]],
  japan: [[130, 31], [135, 34], [140, 35], [142, 40], [141, 45], [143, 44], [140, 41], [139, 37], [133, 36], [131, 34]],
  nz: [[172.5, -34.5], [178, -38], [175.5, -41.5], [174, -39]],
};
export const MAP_REGIONS: Record<string, { label: string; box: [number, number, number, number]; size: [number, number] }> = {
  world: { label: "World", box: [-180, -60, 180, 85], size: [900, 460] },
  europe: { label: "Europe", box: [-14, 34, 45, 72], size: [760, 640] },
  uk: { label: "UK & Ireland", box: [-11, 49.5, 3, 59.5], size: [520, 640] },
  africa: { label: "Africa", box: [-20, -36, 55, 38], size: [560, 600] },
  asia: { label: "Asia", box: [25, -12, 150, 78], size: [860, 620] },
  namerica: { label: "North America", box: [-170, 5, -50, 84], size: [700, 640] },
  samerica: { label: "South America", box: [-85, -57, -32, 14], size: [520, 640] },
  oceania: { label: "Oceania", box: [110, -50, 180, -5], size: [760, 480] },
};
const MAP_LABELS: Record<string, [string, number, number][]> = {
  world: [["North America", -100, 45], ["South America", -60, -15], ["Europe", 15, 52], ["Africa", 20, 5], ["Asia", 90, 48], ["Australia", 134, -25], ["Antarctica", 0, -78]],
  europe: [["UK", -2, 54], ["Ireland", -8, 53.5], ["France", 2, 47], ["Spain", -4, 40], ["Germany", 10, 51], ["Italy", 12.5, 42.5], ["Poland", 19, 52], ["Norway", 9, 62], ["Sweden", 16, 62], ["Finland", 26, 64]],
  uk: [["England", -1.5, 52.6], ["Scotland", -4, 57], ["Wales", -3.8, 52.3], ["N. Ireland", -6.7, 54.7], ["Ireland", -8, 53]],
};
const lonlat = (e: El, lon: number, lat: number, box: [number, number, number, number]) => ({ x: (e.x ?? 0) + ((lon - box[0]) / (box[2] - box[0])) * (e.w ?? 900), y: (e.y ?? 0) + ((box[3] - lat) / (box[3] - box[1])) * (e.h ?? 460) });
function drawMap(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const P = env.paper, x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 900, h = e.h ?? 460, reg = MAP_REGIONS[s(e, "region", "world")] ?? MAP_REGIONS.world!, box = reg.box;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = "#eaf3fb"; ctx.fillRect(x, y, w, h);
  // graticule
  ctx.strokeStyle = "rgba(120,150,190,.35)"; ctx.lineWidth = 1; ctx.beginPath();
  const gs = box[2] - box[0] > 100 ? 30 : box[2] - box[0] > 40 ? 10 : 5;
  for (let lo = Math.ceil(box[0] / gs) * gs; lo <= box[2]; lo += gs) { const a = lonlat(e, lo, box[3], box), b = lonlat(e, lo, box[1], box); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  for (let la = Math.ceil(box[1] / gs) * gs; la <= box[3]; la += gs) { const a = lonlat(e, box[0], la, box), b = lonlat(e, box[2], la, box); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
  ctx.stroke();
  ctx.fillStyle = "#fbf7ea"; ctx.strokeStyle = "#7d8aa3"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
  for (const pts of Object.values(LAND)) { ctx.beginPath(); pts.forEach(([lo, la], i) => { const p = lonlat(e, lo, la, box); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  if (o(e, "labels", true)) { ctx.fillStyle = "#5b6b8c"; ctx.font = `700 ${Math.max(11, w / 60)}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; for (const [t, lo, la] of MAP_LABELS[s(e, "region", "world")] ?? []) { const p = lonlat(e, lo, la, box); ctx.fillText(t, p.x, p.y); } }
  if (o(e, "grid", false)) {
    const nx = 10, ny = Math.max(4, Math.round((10 * h) / w)); ctx.strokeStyle = P.danger; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 1; i < nx; i++) { ctx.moveTo(x + (w * i) / nx, y); ctx.lineTo(x + (w * i) / nx, y + h); }
    for (let j = 1; j < ny; j++) { ctx.moveTo(x, y + (h * j) / ny); ctx.lineTo(x + w, y + (h * j) / ny); }
    ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = P.danger; ctx.font = `700 12px ${P.font}`; ctx.textAlign = "center";
    for (let i = 0; i < nx; i++) ctx.fillText(String.fromCharCode(65 + i), x + (w * (i + 0.5)) / nx, y + 10);
    for (let j = 0; j < ny; j++) ctx.fillText(String(j + 1), x + 10, y + (h * (j + 0.5)) / ny);
  }
  ctx.restore();
  ctx.strokeStyle = P.axis; ctx.lineWidth = 2.5 / env.k; ctx.strokeRect(x, y, w, h);
}


// ── classroom widgets: dice, spinner, score counter (tutor clicks; the state is in `opts`) ──
const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
};
const ROLL_MS = 650, SPIN_MS = 2600;
const roll = new Map<string, { rolls: number; at: number }>();
const spin = new Map<string, { to: number; from: number; at: number }>();
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Is a dice roll / wheel spin still animating (the board keeps redrawing while so)? */
export function widgetAnimating(e: El, now = Date.now()): boolean {
  if (e.stamp === "dice") { const r = roll.get(e.id); return !!r && now - r.at < ROLL_MS; }
  if (e.stamp === "spinner") { const r = spin.get(e.id); return !!r && r.from !== r.to && now - r.at < SPIN_MS; }
  return false;
}
/** The wheel's entries (2–12), from the comma/newline list in `opts.items`. */
export function spinnerItems(e: El): string[] {
  const a = s(e, "items", "").split(/[,\n;]/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
  return a.length >= 2 ? a : ["Yes", "No"];
}
const WHEEL = ["#2f6bd8", "#e2762b", "#15a465", "#8a5fd6", "#e5484d", "#0d9bbf", "#d99a06", "#d6479a"];

function drawDice(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 250, h = e.h ?? 130, P = env.paper, now = Date.now();
  const count = n(e, "n", 1) >= 2 ? 2 : 1, rolls = n(e, "rolls", 0);
  let rec = roll.get(e.id);
  if (!rec) { rec = { rolls, at: 0 }; roll.set(e.id, rec); }
  else if (rec.rolls !== rolls) { rec.rolls = rolls; rec.at = now; }
  const tumbling = now - rec.at < ROLL_MS;
  ctx.fillStyle = "#fff"; ctx.strokeStyle = P.gridStrong; ctx.lineWidth = 2.5 / env.k; rr(ctx, x, y, w, h, 16); ctx.fill(); ctx.stroke();
  const d = Math.min(h * 0.62, (w - 30) / count - 14), gap = 22, total = count * d + (count - 1) * gap, x0 = x + (w - total) / 2, y0 = y + (h - d) / 2 - h * 0.05;
  const faces = [n(e, "a", 4), n(e, "b", 2)];
  for (let i = 0; i < count; i++) {
    const wobble = tumbling ? Math.sin((now - rec.at) / 38 + i * 2) * 5 * (1 - (now - rec.at) / ROLL_MS) : 0;
    const face = tumbling && (now - rec.at) < ROLL_MS * 0.8 ? 1 + (Math.floor((now - rec.at) / 70) + i * 3 + rolls) % 6 : Math.min(6, Math.max(1, Math.round(faces[i]!)));
    const dx = x0 + i * (d + gap), cx = dx + d / 2, cy = y0 + d / 2;
    ctx.save(); ctx.translate(cx, cy + wobble); ctx.rotate((wobble * Math.PI) / 180 * 2); ctx.translate(-cx, -cy);
    ctx.shadowColor = "rgba(20,30,60,.22)"; ctx.shadowBlur = 8 / env.k; ctx.shadowOffsetY = 3 / env.k;
    ctx.fillStyle = "#fffdf6"; ctx.strokeStyle = P.ink; ctx.lineWidth = 3 / env.k; rr(ctx, dx, y0, d, d, d * 0.18); ctx.fill(); ctx.shadowColor = "transparent"; ctx.stroke();
    ctx.fillStyle = P.ink;
    for (const [u, v] of DIE_PIPS[face]!) { ctx.beginPath(); ctx.arc(dx + u * d, y0 + v * d, d * 0.075, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.fillStyle = P.label; ctx.font = `700 ${h * 0.11}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const sum = Math.min(6, Math.max(1, Math.round(faces[0]!))) + (count === 2 ? Math.min(6, Math.max(1, Math.round(faces[1]!))) : 0);
  ctx.fillText(rolls === 0 ? "click to roll" : tumbling ? "rolling…" : count === 2 ? `total ${sum}` : "click to roll again", x + w / 2, y + h - h * 0.09);
}

function drawSpinner(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 340, h = e.h ?? 340, P = env.paper, now = Date.now();
  const items = spinnerItems(e), k = items.length, seg = 360 / k, target = n(e, "spin", 0), pick = n(e, "pick", -1);
  let rec = spin.get(e.id);
  if (!rec) { rec = { to: target, from: target, at: 0 }; spin.set(e.id, rec); }
  else if (rec.to !== target) {
    const t = ease((now - rec.at) / SPIN_MS), cur = rec.from + (rec.to - rec.from) * t;
    rec.from = cur; rec.to = target; rec.at = now;
  }
  const t = rec.from === rec.to ? 1 : ease((now - rec.at) / SPIN_MS), ang = rec.from + (rec.to - rec.from) * t, done = t >= 1;
  const cx = x + w / 2, cy = y + h / 2 + 8, R = Math.min(w, h) / 2 - 26;
  ctx.save();
  ctx.shadowColor = "rgba(20,30,60,.25)"; ctx.shadowBlur = 12 / env.k; ctx.shadowOffsetY = 4 / env.k;
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (let i = 0; i < k; i++) {
    const a0 = ((-90 + ang + i * seg) * Math.PI) / 180, a1 = ((-90 + ang + (i + 1) * seg) * Math.PI) / 180;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
    ctx.fillStyle = WHEEL[i % WHEEL.length]!; ctx.globalAlpha = done && pick >= 0 && pick !== i ? 0.55 : 1; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5 / env.k; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((a0 + a1) / 2);
    ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const fs = Math.max(12, Math.min(26, R * 0.16, (R * 0.9 * Math.PI * 2 / k) * 0.45));
    ctx.font = `800 ${fs}px ${P.font}`;
    const label = items[i]!.length > 11 ? items[i]!.slice(0, 10) + "…" : items[i]!;
    ctx.fillText(label, R - 12, 0);
    ctx.restore();
  }
  // hub + result
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.26, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = P.gridStrong; ctx.lineWidth = 2.5 / env.k; ctx.stroke();
  ctx.fillStyle = P.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const hub = done && pick >= 0 && pick < k ? items[pick]! : "SPIN";
  ctx.font = `800 ${hub === "SPIN" ? R * 0.13 : Math.min(R * 0.14, (R * 0.5) / Math.max(3, hub.length) * 2.2)}px ${P.font}`;
  ctx.fillText(hub.length > 9 ? hub.slice(0, 8) + "…" : hub, cx, cy);
  // pointer
  ctx.beginPath(); ctx.moveTo(cx - 13, cy - R - 16); ctx.lineTo(cx + 13, cy - R - 16); ctx.lineTo(cx, cy - R + 8); ctx.closePath();
  ctx.fillStyle = P.danger; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 / env.k; ctx.stroke();
}

function drawTally(ctx: CanvasRenderingContext2D, e: El, env: Env) {
  const x = e.x ?? 0, y = e.y ?? 0, w = e.w ?? 200, h = e.h ?? 150, P = env.paper, v = Math.round(n(e, "n", 0));
  ctx.fillStyle = "#fff"; ctx.strokeStyle = P.brand; ctx.lineWidth = 3 / env.k; rr(ctx, x, y, w, h, 18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.brandSoft; ctx.beginPath(); ctx.moveTo(x + 18, y); ctx.arcTo(x + w, y, x + w, y + h, 18); ctx.lineTo(x + w, y + h * 0.26); ctx.lineTo(x, y + h * 0.26); ctx.lineTo(x, y + 18); ctx.arcTo(x, y, x + 18, y, 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.brand; ctx.font = `800 ${h * 0.13}px ${P.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const label = s(e, "label", "Score"); ctx.fillText(label.length > 18 ? label.slice(0, 17) + "…" : label, x + w / 2, y + h * 0.13);
  ctx.fillStyle = P.ink; ctx.font = `800 ${h * (String(v).length > 3 ? 0.36 : 0.5)}px ${P.font}`; ctx.fillText(String(v), x + w / 2, y + h * 0.6);
  ctx.fillStyle = P.label; ctx.font = `700 ${h * 0.09}px ${P.font}`; ctx.fillText("click to add 1", x + w / 2, y + h * 0.9);
}

const DRAW: Record<string, (ctx: CanvasRenderingContext2D, e: El, env: Env) => void> = {
  periodic: drawPeriodic, plot: drawPlot, bohr: drawBohr, symbol: drawSymbol, apparatus: drawApparatus, lens: drawLens, timeline: drawTimeline, textblock: drawTextBlock, timer: drawTimer, map: drawMap, dice: drawDice, spinner: drawSpinner, tally: drawTally,
};
export function drawExtraStamp(ctx: CanvasRenderingContext2D, e: El, env: Env): boolean {
  const f = e.stamp && DRAW[e.stamp];
  if (!f) return false;
  ctx.save();
  if (e.rot) { const cx = (e.x ?? 0) + (e.w ?? 0) / 2, cy = (e.y ?? 0) + (e.h ?? 0) / 2; ctx.translate(cx, cy); ctx.rotate((e.rot * Math.PI) / 180); ctx.translate(-cx, -cy); }
  f(ctx, e, env);
  ctx.restore();
  return true;
}
export const textBlockHeight = (e: El) => Math.max(120, wrapLines(s(e, "text"), (e.w ?? 720) - 44, n(e, "size", 24), false).length * n(e, "size", 24) * 1.65 + 36);
export { LINE_H };

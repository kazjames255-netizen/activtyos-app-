"use client";
/*
 * motionKit — topic-agnostic scene renderers + a line-art icon set for the
 * animated course videos. Every course's intro/mid video is authored as scene
 * DATA (narration + key words + which template + which icon) and rendered by
 * these generic templates, so 78 videos stay consistent and on-brand while
 * still looking specific to their subject.
 *
 * Each renderer draws into the same 320×184 viewBox the MotionPlayer uses and
 * receives { p, scene, reduced } where p is 0..1 progress through the scene.
 * Only transform / opacity / stroke-dashoffset are animated.
 */
import type { ReactNode } from "react";
import type { MotionScene } from "./courseContent";

export const KFIELD_A = "#14265c", KFIELD_B = "#2f6bd8";
export const KACCENT = "#f6b352", KGOOD = "#34d399", KINK = "#ffffff", KBAD = "#ff8a9c";
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const eo = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

// ————————————————————————————————————————————————————————————————
// Icon set — drawn in a 0..24 box, stroked (fill:none) so colour + size are set
// by the wrapper. Curated to cover every CPD topic in the catalogue.
const P = (d: string) => <path d={d} />;
export const ICONS: Record<string, ReactNode> = {
  shield: P("M12 2 L20 5 V11 C20 16 16 20 12 22 C8 20 4 16 4 11 V5 Z"),
  "shield-tick": <>{P("M12 2 L20 5 V11 C20 16 16 20 12 22 C8 20 4 16 4 11 V5 Z")}{P("M8.5 11.5 L11 14 L15.5 8.5")}</>,
  alert: <>{P("M12 3 L22 20 H2 Z")}<line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17.4" r="0.7" /></>,
  heart: P("M12 21 C4 15 3 9 7 6 C10 4 12 7 12 8 C12 7 14 4 17 6 C21 9 20 15 12 21 Z"),
  cross: P("M9 3 h6 v6 h6 v6 h-6 v6 h-6 v-6 H3 v-6 h6 Z"),
  document: <>{P("M7 3 h7 l4 4 v14 h-11 Z")}<line x1="9.5" y1="12" x2="15.5" y2="12" /><line x1="9.5" y1="16" x2="15.5" y2="16" /></>,
  clipboard: <>{P("M8 4 h8 v3 h-8 Z")}{P("M7 5 H5 v16 h14 V5 h-2")}<line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="13" y2="15" /></>,
  people: <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" />{P("M3 20 a5 5 0 0 1 10 0")}{P("M11 20 a5 5 0 0 1 10 0")}</>,
  child: <><circle cx="12" cy="6" r="3" /><line x1="12" y1="9" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />{P("M9 21 l3-5 3 5")}</>,
  brain: <><circle cx="12" cy="12" r="7.5" /><line x1="12" y1="4.5" x2="12" y2="19.5" />{P("M12 8 a3 3 0 0 0 0 8")}{P("M12 8 a3 3 0 0 1 0 8")}</>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" />{P("M8 11 V8 a4 4 0 0 1 8 0 v3")}</>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><line x1="10.5" y1="18" x2="13.5" y2="18" /></>,
  food: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.2" /></>,
  flame: P("M12 2 C14 8 18 9 16 14 A5 5 0 1 1 8 14 C7 11 9.5 10 10 8"),
  pill: <><rect x="3.5" y="9" width="17" height="6" rx="3" transform="rotate(45 12 12)" /><line x1="12" y1="4.5" x2="12" y2="19.5" transform="rotate(45 12 12)" /></>,
  droplet: P("M12 3 C12 3 5.5 11 5.5 15 A6.5 6.5 0 0 0 18.5 15 C18.5 11 12 3 12 3 Z"),
  sun: <><circle cx="12" cy="12" r="4.5" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={12 + 7 * Math.cos(r)} y1={12 + 7 * Math.sin(r)} x2={12 + 9.4 * Math.cos(r)} y2={12 + 9.4 * Math.sin(r)} />; })}</>,
  germ: <><circle cx="12" cy="12" r="5.5" />{[20, 70, 140, 200, 250, 310].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={12 + 5.5 * Math.cos(r)} y1={12 + 5.5 * Math.sin(r)} x2={12 + 9 * Math.cos(r)} y2={12 + 9 * Math.sin(r)} />; })}</>,
  hand: <>{P("M7 13 V8 a1.4 1.4 0 0 1 2.8 0 V7 a1.4 1.4 0 0 1 2.8 0 v1 a1.4 1.4 0 0 1 2.8 0 v1 a1.4 1.4 0 0 1 2.8 0 v5 a5 5 0 0 1-5 5 h-1 a5 5 0 0 1-4-2 l-3-4 a1.5 1.5 0 0 1 2.4-1.8 Z")}</>,
  globe: <><circle cx="12" cy="12" r="8.5" /><line x1="3.5" y1="12" x2="20.5" y2="12" />{P("M12 3.5 a13 13 0 0 1 0 17 a13 13 0 0 1 0-17")}</>,
  chat: P("M4 5 h16 v10 h-9 l-4 4 v-4 H4 Z"),
  book: <>{P("M12 5 C10 3.5 6 3.5 4 4 v14 c2-.5 6-.5 8 1")}{P("M12 5 C14 3.5 18 3.5 20 4 v14 c-2-.5-6-.5-8 1")}</>,
  box: <>{P("M4 7 l8-4 8 4 v10 l-8 4-8-4 Z")}<line x1="4" y1="7" x2="12" y2="11" /><line x1="20" y1="7" x2="12" y2="11" /><line x1="12" y1="11" x2="12" y2="21" /></>,
  lift: <><circle cx="12" cy="4.5" r="2" />{P("M12 6.5 v6 M7 9 h10 M9 21 l3-5 3 5")}<rect x="8" y="13" width="8" height="5" rx="1" /></>,
  puzzle: P("M8 5 h3 a1.6 1.6 0 1 1 3 0 h3 v3 a1.6 1.6 0 1 1 0 3 v3 h-3 a1.6 1.6 0 1 0-3 0 H8 v-3 a1.6 1.6 0 1 0 0-3 Z"),
  eye: <>{P("M2.5 12 S6.5 6 12 6 s9.5 6 9.5 6-4 6-9.5 6-9.5-6-9.5-6 Z")}<circle cx="12" cy="12" r="2.6" /></>,
  bell: <>{P("M6.5 16 V11 a5.5 5.5 0 0 1 11 0 v5 l1.5 2 H5 Z")}{P("M10 19 a2 2 0 0 0 4 0")}</>,
  clock: <><circle cx="12" cy="12" r="8" />{P("M12 7.5 v5 l3.2 2")}</>,
  tick: P("M4 12.5 l5 5.5 L20 5.5"),
  exit: <>{P("M14 3 h5 v18 h-5")}<line x1="3.5" y1="12" x2="14" y2="12" />{P("M10 8 l4 4-4 4")}</>,
  extinguisher: <><rect x="8.5" y="8" width="7" height="12" rx="2" />{P("M10.5 8 V5.5 h3 V8 M13.5 6 h4")}</>,
  lungs: <>{P("M12 4 v9")}{P("M12 8 c-1 -2 -5 -1 -5.5 3 c-.4 3 -1 6 1.5 6 s3.5 -2 4 -5 Z")}{P("M12 8 c1 -2 5 -1 5.5 3 c.4 3 1 6 -1.5 6 s-3.5 -2 -4 -5 Z")}</>,
  wave: <>{P("M3 14 q4 -5 8 0 t8 0")}{P("M3 18 q4 -5 8 0 t8 0")}</>,
  handshake: <>{P("M3 10 l4-2 5 3 5-3 4 2")}{P("M12 11 l2 2 M9 13 l2 2 M11 15 l1.5 1.5")}</>,
};

function Icon({ name, color, cx, cy, size, o = 1, sw = 2 }: { name: string; color: string; cx: number; cy: number; size: number; o?: number; sw?: number }) {
  const s = size / 24;
  return (
    <g transform={`translate(${cx} ${cy}) translate(${-12 * s} ${-12 * s}) scale(${s})`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={o}>
      {ICONS[name] ?? ICONS.shield}
    </g>
  );
}
const rays = (cx: number, cy: number, r0: number, r1: number, o: number, color = KACCENT) =>
  [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={cx + r0 * Math.cos(r)} y1={cy + r0 * Math.sin(r)} x2={cx + r1 * Math.cos(r)} y2={cy + r1 * Math.sin(r)} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={o} />; });
// Text that never overflows: when the estimated width exceeds maxW, SVG
// textLength compresses it to fit (fixes labels clipping off the stage edge).
const T = (x: number, y: number, s: number, txt: string, o = 1, col = KINK, anchor: "start" | "middle" | "end" = "middle", maxW = 0) => {
  const est = String(txt).length * s * 0.56;
  const fit = maxW && est > maxW ? { textLength: maxW, lengthAdjust: "spacingAndGlyphs" as const } : {};
  return <text x={x} y={y} fontSize={s} fontWeight={800} fill={col} textAnchor={anchor} opacity={o} {...fit} style={{ fontFamily: "var(--ff, system-ui)" }}>{txt}</text>;
};

interface SP { p: number; scene: MotionScene; reduced: boolean }
type Props = { icon?: string; icon2?: string; sub?: string; value?: string; items?: string[]; good?: string[]; bad?: string[] };
const pr = (s: MotionScene) => (s.props ?? {}) as Props;

// ————————————————————————————————————————————————————————————————
export const GENERIC_SCENES: Record<string, (sp: SP) => ReactNode> = {
  // Branded title card — the subject's icon assembles with a ring of rays.
  gtitle: ({ p, scene, reduced }) => { const d = reduced ? 1 : eo(seg(p, .05, .7)), r = reduced ? 1 : eo(seg(p, .5, 1)); const ic = pr(scene).icon || "shield";
    return <g>{rays(160, 74, 46, 46 + r * 20, r * .5)}<g opacity={d} transform={`translate(160 74) scale(${.6 + d * .4}) translate(-160 -74)`}><Icon name={ic} color={KINK} cx={160} cy={74} size={62} sw={2.4} /></g></g>; },
  // A single subject spotlit — icon on a warm glow.
  gspot: ({ p, scene, reduced }) => { const d = reduced ? 1 : eo(seg(p, .1, .7)); const ic = pr(scene).icon || "shield";
    return <g><ellipse cx={160} cy={86} rx={64} ry={70} fill={KACCENT} opacity={.12 * d} /><g opacity={d}><Icon name={ic} color={KINK} cx={160} cy={86} size={72} sw={2.4} /></g></g>; },
  // Up to four labelled icon cards, staggered in and kept.
  gcards: ({ p, scene, reduced }) => { const items = (pr(scene).items || []).slice(0, 4); const icons = pr(scene).icon ? [pr(scene).icon!] : [];
    const ics = (scene.props?.icons as string[] | undefined) || icons; const n = items.length || 1;
    const gap = 8; const w = Math.min(150, (304 - (n - 1) * gap) / n); const total = n * w + (n - 1) * gap; const x0 = 160 - total / 2;
    return <g>{items.map((label, i) => { const o = reduced ? 1 : eo(seg(p, .1 + i * .18, .4 + i * .18)); const left = x0 + i * (w + gap); const cx = left + w / 2;
      return <g key={i} opacity={o} transform={`translate(0 ${(1 - o) * 22})`}>
        <rect x={left} y={40} width={w} height={104} rx={14} fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.28)" strokeWidth={1.4} />
        <Icon name={ics[i] || ics[0] || "shield"} color={KACCENT} cx={cx} cy={78} size={40} sw={2.6} />
        {T(cx, 128, 11, label, 1, KINK, "middle", w - 8)}
      </g>; })}</g>; },
  // A ticking checklist — each item's tick draws on in turn.
  gcheck: ({ p, scene, reduced }) => { const items = (pr(scene).items || []).slice(0, 5); const n = items.length || 1; const top = 92 - n * 15;
    return <g>{items.map((label, i) => { const o = reduced ? 1 : eo(seg(p, .08 + i * .17, .3 + i * .17)); const y = top + i * 30;
      return <g key={i}><circle cx={78} cy={y} r={11} fill={KGOOD} opacity={.18 * o} /><g opacity={o}><Icon name="tick" color={KGOOD} cx={78} cy={y} size={18} sw={3} /></g>{T(96, y + 4.5, 12, label, o, KINK, "start", 214)}</g>; })}</g>; },
  // Numbered step flow across the stage.
  gsteps: ({ p, scene, reduced }) => { const items = (pr(scene).items || []).slice(0, 4); const n = items.length || 1; const span = 208; const x0 = 160 - span / 2; const gap = span / Math.max(1, n - 1); const cell = n > 1 ? gap : 260;
    return <g><line x1={x0} y1={80} x2={x0 + span} y2={80} stroke="rgba(255,255,255,.25)" strokeWidth={3} strokeLinecap="round" />
      {items.map((label, i) => { const o = reduced ? 1 : eo(seg(p, .12 + i * .2, .32 + i * .2)); const x = n === 1 ? 160 : x0 + i * gap;
        return <g key={i} opacity={o}><circle cx={x} cy={80} r={17} fill={KACCENT} /><circle cx={x} cy={80} r={17} fill="none" stroke={KFIELD_A} strokeWidth={2} />{T(x, 85, 15, String(i + 1), 1, KFIELD_A)}{T(x, 118, 9.5, label, 1, KINK, "middle", Math.min(cell * 0.86, 92))}</g>; })}</g>; },
  // A big number that counts up, with a caption.
  gstat: ({ p, scene, reduced }) => { const raw = pr(scene).value || ""; const m = raw.match(/^(\D*)(\d[\d,\.]*)(.*)$/); const d = reduced ? 1 : eo(seg(p, .05, .8));
    let shown = raw; if (m) { const num = parseFloat(m[2].replace(/,/g, "")); const cur = Math.round(num * d); shown = m[1] + cur.toLocaleString() + m[3]; }
    return <g><ellipse cx={160} cy={82} rx={120} ry={54} fill={KACCENT} opacity={.08} />{T(160, 96, 62, shown, 1, KINK)}{pr(scene).sub ? T(160, 138, 13, pr(scene).sub!, d, "rgba(255,255,255,.85)") : null}</g>; },
  // A warning beat — alert triangle pulses, optional subject icon behind.
  galert: ({ p, scene, reduced }) => { const d = reduced ? 1 : eo(seg(p, .05, .6)); const ic = pr(scene).icon;
    return <g>{ic ? <g opacity={.16 * d}><Icon name={ic} color={KINK} cx={160} cy={86} size={96} /></g> : null}
      <g style={{ transformOrigin: "160px 86px", animation: reduced ? undefined : "aos-alert 1.5s ease-in-out infinite" }} opacity={d}><Icon name="alert" color={KACCENT} cx={160} cy={86} size={76} sw={3} /></g></g>; },
  // Do / don't comparison — two columns, green ticks vs red crosses.
  gcompare: ({ p, scene, reduced }) => { const good = (pr(scene).good || []).slice(0, 3), bad = (pr(scene).bad || []).slice(0, 3);
    const col = (x: number, arr: string[], color: string, mark: string) => arr.map((label, i) => { const o = reduced ? 1 : eo(seg(p, .1 + i * .16, .34 + i * .16)); const y = 62 + i * 30; const maxW = x < 90 ? 106 : 126;
      return <g key={i} opacity={o}><Icon name={mark} color={color} cx={x} cy={y} size={16} sw={3} />{T(x + 14, y + 4.5, 10.5, label, 1, KINK, "start", maxW)}</g>; });
    return <g><line x1={160} y1={46} x2={160} y2={150} stroke="rgba(255,255,255,.16)" strokeWidth={1.5} />{col(30, good, KGOOD, "tick")}{col(172, bad, KBAD, "cross")}</g>; },
  // A reflective quote beat — big marks; the words come from the kinetic layer.
  gquote: ({ p, scene, reduced }) => { const d = reduced ? 1 : eo(seg(p, .1, .8)); const ic = pr(scene).icon || "heart";
    return <g opacity={d}><Icon name={ic} color={KACCENT} cx={160} cy={70} size={54} sw={2.4} /><text x={92} y={130} fontSize={70} fontWeight={800} fill="rgba(255,255,255,.16)">“</text></g>; },
  // Closing lock-in — the subject icon settles with a green tick + a pulse of rays.
  gclose: ({ p, scene, reduced }) => { const d = reduced ? 1 : eo(seg(p, .08, .7)); const gl = reduced ? .5 : Math.sin(clamp01(seg(p, .55, 1)) * Math.PI); const ic = pr(scene).icon || "shield-tick";
    return <g>{rays(160, 86, 52, 68, gl * .5)}<g opacity={d} transform={`translate(160 86) scale(${.7 + d * .3}) translate(-160 -86)`}><Icon name={ic} color={KINK} cx={160} cy={86} size={80} sw={2.4} /></g></g>; },
};

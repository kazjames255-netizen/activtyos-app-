"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { COSMETICS, VILLAGE, VILLAGE_PLOTS, friendOf, stageById, type BuildingId } from "../config";
import { HOST_NAME } from "../characters/host";
import { friendImage } from "../characters/friends";
import { IconFish } from "./icons";
import type { TT } from "./tt";

// THE IGLOO VILLAGE - a real scene, side on: night sky, aurora, mountains, two rows of plots on the snow. Fish buy buildings; you pick a building, then TAP the plot where it should go and it
// rises out of the snow (dust, sparkles). Every building has its own drawing. Friends you have freed live here and wander between the plots. Cosmetic only: nothing here changes the maths.
const W = 960, H = 520;
/** Plot positions: front row (0-5) is nearer and bigger, back row (6-11) sits higher on the snow and smaller. */
export const PLOTS: { x: number; y: number; s: number }[] = [
  ...Array.from({ length: 6 }, (_, i) => ({ x: 105 + i * 150, y: 460, s: 1 })),
  ...Array.from({ length: 6 }, (_, i) => ({ x: 150 + i * 132, y: 360, s: 0.72 })),
];
/** Where each building would like to stand if the child never chooses (old saves, and the first free plot for a quick build). */
export const DEFAULT_PLOT: Record<BuildingId, number> = { hut: 0, market: 1, bakery: 2, shed: 3, library: 4, school: 5, lighthouse: 6, rink: 7, observatory: 8, springs: 9, bridge: 10, square: 11 };
/** Every built building has a plot: the child's own choice where there is one, the default (or the first free plot) where there is not (an older save). */
export function derivePlots(built: string[], plots: (string | null)[]): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: VILLAGE_PLOTS }, (_, i) => (plots[i] && built.includes(plots[i]!) ? plots[i]! : null));
  for (const id of built) { if (out.includes(id)) continue; const want = DEFAULT_PLOT[id as BuildingId]; const slot = want !== undefined && out[want] === null ? want : out.findIndex((x) => x === null); if (slot >= 0) out[slot] = id; }
  return out;
}

const ICE = "#e9f6ff", ICE2 = "#b7d8f7", ICE3 = "#6aa6e6", NAVY = "#1b2350", GOLD = "#ffce4a", ROSE = "#ff9ec7", VIOLET = "#9b7bff", ROYAL = "#3b57d6", WOOD = "#8a5a2b", GLOW = "#fff0b3";

/** One drawing per building, standing on y = 0, about 130 wide and up to 130 tall. */
function Art({ id }: { id: BuildingId }) {
  const dome = (rx: number, ry: number, fill = ICE) => <><path d={`M${-rx} 0 A${rx} ${ry} 0 0 1 ${rx} 0 Z`} fill={fill} stroke={ICE3} strokeWidth="2.5" /><path d={`M${-rx * 0.86} ${-ry * 0.5} h${rx * 1.72} M${-rx * 0.6} ${-ry * 0.82} h${rx * 1.2}`} stroke={ICE2} strokeWidth="2" /></>;
  switch (id) {
    case "hut": return <g>{dome(46, 40)}<path d="M-12 0 v-14 a12 12 0 0 1 24 0 v14 Z" fill={NAVY} /><rect x="-16" y="-12" width="32" height="12" rx="4" fill={ICE2} stroke={ICE3} strokeWidth="2" /><path d="M-12 0 v-14 a12 12 0 0 1 24 0 v14 Z" fill={NAVY} /><circle cx="26" cy="-22" r="4" fill={GLOW} /></g>;
    case "market": return <g><rect x="-52" y="-46" width="104" height="46" rx="4" fill="#f4e6cf" stroke={WOOD} strokeWidth="2.5" />{Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${-56 + i * 19} -58 h19 l4 18 h-27 Z`} fill={i % 2 ? "#fff" : GOLD} stroke={NAVY} strokeWidth="1.5" />)}<rect x="-40" y="-26" width="80" height="26" rx="3" fill={WOOD} /><g fill="#8ec4f2" stroke={NAVY} strokeWidth="1.5">{[-28, -6, 16].map((x) => <path key={x} d={`M${x} -30 q9 -8 18 0 q-9 8 -18 0 M${x + 18} -30 l6 -5 v10 Z`} />)}</g><rect x="-56" y="-64" width="6" height="64" fill={WOOD} /><rect x="50" y="-64" width="6" height="64" fill={WOOD} /></g>;
    case "bakery": return <g>{dome(50, 44, "#ffeacc")}<path d="M-13 0 v-14 a13 13 0 0 1 26 0 v14 Z" fill={NAVY} /><rect x="24" y="-58" width="14" height="24" fill="#c9a26a" stroke={WOOD} strokeWidth="2" /><g className="ps-smoke" fill="rgba(255,255,255,.85)"><circle cx="31" cy="-66" r="6" /><circle cx="37" cy="-78" r="8" /><circle cx="30" cy="-92" r="9" /></g><rect x="-40" y="-30" width="20" height="16" rx="6" fill={GOLD} stroke={NAVY} strokeWidth="1.5" /><path d="M-36 -22 h12 M-33 -26 v8 M-27 -26 v8" stroke="#c8901a" strokeWidth="1.5" /></g>;
    case "shed": return <g><rect x="-52" y="-44" width="104" height="44" fill="#b98a55" stroke={WOOD} strokeWidth="2.5" /><path d="M-60 -44 L0 -78 L60 -44 Z" fill="#6f4a22" stroke={NAVY} strokeWidth="2" /><path d="M-52 -44 v44 M-26 -44 v44 M0 -44 v44 M26 -44 v44" stroke="#8a5a2b" strokeWidth="2" /><rect x="-20" y="-32" width="40" height="32" fill={NAVY} /><path d="M-70 -6 l24 -40 M-64 0 l24 -40" stroke={ROYAL} strokeWidth="5" strokeLinecap="round" /><path d="M-72 -4 q-4 6 6 6 h30" stroke={GOLD} strokeWidth="3" fill="none" /></g>;
    case "library": return <g>{dome(46, 52, "#efe8ff")}<rect x="-40" y="-14" width="80" height="14" rx="3" fill={VIOLET} />{[-30, -20, -10, 0, 10, 20, 30].map((x, i) => <rect key={x} x={x - 3.5} y={-26 - (i % 2) * 3} width="7" height={12 + (i % 2) * 3} fill={[GOLD, ROSE, ROYAL, "#fff"][i % 4]} stroke={NAVY} strokeWidth="1.2" />)}<circle cx="0" cy="-58" r="13" fill={GLOW} stroke={NAVY} strokeWidth="2.5" /><path d="M0 -70 v24 M-12 -58 h24" stroke={NAVY} strokeWidth="1.6" /><path d="M-11 0 v-8 a11 11 0 0 1 22 0 v8 Z" fill={NAVY} /></g>;
    case "school": return <g><rect x="-56" y="-52" width="112" height="52" fill="#dbe8ff" stroke={ROYAL} strokeWidth="2.5" /><path d="M-62 -52 L0 -84 L62 -52 Z" fill={ROYAL} stroke={NAVY} strokeWidth="2" /><rect x="-10" y="-30" width="20" height="30" rx="3" fill={NAVY} />{[-40, 28].map((x) => <rect key={x} x={x} y="-42" width="16" height="16" rx="3" fill={GLOW} stroke={NAVY} strokeWidth="1.6" />)}<path d="M0 -84 v-22" stroke={NAVY} strokeWidth="2.5" /><path d="M0 -106 h22 l-6 7 l6 7 h-22 Z" fill={GOLD} stroke="#c8901a" strokeWidth="1.5" /><circle cx="0" cy="-64" r="6" fill={GOLD} stroke="#c8901a" strokeWidth="1.5" /></g>;
    case "lighthouse": return <g><path d="M-22 0 L-14 -110 H14 L22 0 Z" fill="#fff" stroke={NAVY} strokeWidth="2.5" /><path d="M-19.5 -22 h39 l-1.5 24 h-36 Z M-15.5 -68 h31 l-1.5 24 h-28 Z" fill={ROYAL} opacity=".9" /><rect x="-20" y="-124" width="40" height="16" rx="3" fill={NAVY} /><rect x="-13" y="-122" width="26" height="12" fill={GLOW} /><path d="M-24 -124 L0 -142 L24 -124 Z" fill={ROYAL} stroke={NAVY} strokeWidth="2" /><path className="ps-beam" d="M13 -116 L120 -150 V-80 Z" fill="rgba(255,240,179,.32)" /><path d="M-9 0 v-12 a9 9 0 0 1 18 0 v12 Z" fill={NAVY} /></g>;
    case "rink": return <g><ellipse cx="0" cy="-8" rx="62" ry="20" fill="#f4fbff" stroke={ICE3} strokeWidth="3" /><ellipse cx="0" cy="-8" rx="46" ry="12" fill="none" stroke={ICE2} strokeWidth="2" /><path d="M-46 -8 h92" stroke={ROSE} strokeWidth="2" /><g className="ps-skate"><circle cx="-14" cy="-32" r="5" fill={NAVY} /><path d="M-14 -28 v14 M-22 -22 l8 4 l8 -4 M-14 -14 l-6 10 M-14 -14 l6 8" stroke={NAVY} strokeWidth="3.4" strokeLinecap="round" fill="none" /></g>{[-62, 62].map((x) => <g key={x}><rect x={x - 2} y="-46" width="4" height="40" fill={NAVY} /><circle cx={x} cy="-50" r="6" fill={GLOW} /></g>)}</g>;
    case "observatory": return <g><rect x="-40" y="-30" width="80" height="30" rx="4" fill="#dfe6ff" stroke={ROYAL} strokeWidth="2.5" /><path d="M-40 -30 A40 44 0 0 1 40 -30 Z" fill="#c9d6ff" stroke={ROYAL} strokeWidth="2.5" /><path d="M-6 -72 L6 -72 L10 -32 L-10 -32 Z" fill={NAVY} /><g transform="rotate(-38 0 -52)"><rect x="-6" y="-92" width="12" height="46" rx="4" fill="#fff" stroke={NAVY} strokeWidth="2" /><rect x="-8" y="-98" width="16" height="10" rx="3" fill={GOLD} stroke={NAVY} strokeWidth="1.5" /></g>{[[-52, -70], [50, -78], [-30, -96], [30, -100]].map(([x, y]) => <path key={x} d={`M${x} ${y - 5} l1.6 3.4 l3.6 .4 l-2.7 2.5 l.8 3.6 l-3.3 -1.9 l-3.3 1.9 l.8 -3.6 l-2.7 -2.5 l3.6 -.4 Z`} fill={GOLD} />)}<path d="M-8 0 v-8 a8 8 0 0 1 16 0 v8 Z" fill={NAVY} /></g>;
    case "springs": return <g><ellipse cx="0" cy="-8" rx="58" ry="18" fill="#c8b9ff" stroke={ICE3} strokeWidth="3" /><ellipse cx="0" cy="-10" rx="48" ry="12" fill="#ffc6e2" /><path d="M-30 -12 q10 -5 20 0 M6 -8 q10 -5 20 0" stroke="#fff" strokeWidth="2" fill="none" opacity=".7" />{[[-52, -14], [-58, -6], [52, -14], [58, -6], [-40, -24], [42, -24]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="8" ry="6" fill={ICE2} stroke={ICE3} strokeWidth="2" />)}<g className="ps-steam" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="4" strokeLinecap="round">{[-22, 0, 22].map((x) => <path key={x} d={`M${x} -24 q6 -12 0 -22 q-6 -10 0 -22`} />)}</g></g>;
    case "bridge": return <g><path d="M-70 0 Q0 -74 70 0 v-12 Q0 -88 -70 -12 Z" fill={ICE} stroke={ICE3} strokeWidth="3" /><path d="M-70 0 h24 v-10 h-24 Z M46 0 h24 v-10 h-24 Z" fill={ICE2} stroke={ICE3} strokeWidth="2" />{[-46, -23, 0, 23, 46].map((x) => <path key={x} d={`M${x} ${-(Math.sqrt(Math.max(0, 1 - (x / 70) ** 2)) * 74) + 4} v-16`} stroke={NAVY} strokeWidth="2.5" />)}<path d="M-56 -50 Q0 -104 56 -50" stroke={NAVY} strokeWidth="2.5" fill="none" />{[-30, 30].map((x) => <circle key={x} cx={x} cy={x < 0 ? -82 : -82} r="5" fill={GLOW} stroke={NAVY} strokeWidth="1.5" />)}<path d="M-70 4 q35 8 70 0 q35 -8 70 0" stroke={ICE3} strokeWidth="3" fill="none" /></g>;
    default: return <g><path d="M-58 0 h116 v-10 h-116 Z" fill={ICE2} stroke={ICE3} strokeWidth="2.5" /><path d="M-40 -10 h80 v-10 h-80 Z" fill={ICE} stroke={ICE3} strokeWidth="2.5" /><path d="M-8 -20 h16 l3 -30 h-22 Z" fill="#fff" stroke={ICE3} strokeWidth="2.5" /><path d="M0 -50 q-26 -16 -20 -40 q8 10 20 6 q12 4 20 -6 q6 24 -20 40 Z" fill="#c9f2ff" stroke={ICE3} strokeWidth="2.5" /><path className="ps-drip" d="M0 -84 q-3 10 0 16" stroke="#7fe3ff" strokeWidth="3" strokeLinecap="round" fill="none" />{[-52, 52].map((x) => <g key={x}><rect x={x - 2} y="-88" width="4" height="78" fill={NAVY} /><path d={`M${x} -88 h${x < 0 ? 22 : -22} l${x < 0 ? -6 : 6} 8 l${x < 0 ? 6 : -6} 8 h${x < 0 ? -22 : 22} Z`} fill={x < 0 ? ROSE : GOLD} stroke={NAVY} strokeWidth="1.5" /></g>)}<path d="M-52 -84 Q0 -60 52 -84" stroke={NAVY} strokeWidth="2" fill="none" />{[-30, -10, 10, 30].map((x) => <circle key={x} cx={x} cy={-73 + (1 - (x / 52) ** 2) * 10} r="3.5" fill={GLOW} />)}</g>;
  }
}

export function Village({ T, fish, built, plots, friends, bought, onBuild, onBuy, onClose, reduced }: {
  T: TT; fish: number; built: string[]; plots: (string | null)[]; friends: string[]; bought: string[]; reduced: boolean;
  onBuild: (id: BuildingId, cost: number, plot: number, nextPlots: (string | null)[]) => void; onBuy: (id: string, cost: number) => void; onClose: () => void;
}) {
  const head = useRef<HTMLHeadingElement>(null);
  const [pick, setPick] = useState<BuildingId | null>(null);
  const [rising, setRising] = useState<{ id: BuildingId; plot: number } | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => { head.current?.focus(); }, []);
  useEffect(() => { if (!rising) return; const t = setTimeout(() => setRising(null), 2200); return () => clearTimeout(t); }, [rising]);
  const placed = useMemo(() => derivePlots(built, plots), [built, plots]);
  const shop = COSMETICS.filter((c) => c.unlock.fish !== undefined);
  const wanderers = useMemo(() => friends.map((id, i) => ({ id, sp: friendOf(stageById(id)?.biome ?? 1), x: 60 + ((i * 137) % 840), y: 500 - (i % 3) * 14, ph: (i * 0.37) % 1 })), [friends]);
  const tapPlot = (i: number) => {
    if (!pick) { if (placed[i]) setNote(T(`bld_${placed[i]}`)); return; }
    if (placed[i]) { setNote(T("village_taken")); return; }
    const b = VILLAGE.find((x) => x.id === pick)!; if (fish < b.cost) return;
    const next = [...placed]; next[i] = pick; onBuild(pick, b.cost, i, next); setRising({ id: pick, plot: i }); setPick(null); setNote(T("village_placed", { name: T(`bld_${pick}`) }));
  };
  const nBuilt = built.length;
  return (
    <div className="ps-over" data-nokeys data-testid="ps-village" style={{ alignItems: "flex-start", background: "linear-gradient(180deg,rgba(7,11,46,.96),rgba(40,50,140,.9))" }}>
      <div style={{ width: "min(1040px,100%)", margin: "0 auto", paddingBottom: 30, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 ref={head} tabIndex={-1} style={{ margin: 0, fontFamily: "var(--ff-display,inherit)", fontSize: "clamp(26px,5vw,38px)", outline: "none" }}>{T("village_title")}</h2>
            <p style={{ margin: "4px 0 0", opacity: 0.9 }}>{pick ? T("village_pick_plot", { name: T(`bld_${pick}`) }) : T("village_sub", { mascot: HOST_NAME })}</p>
          </div>
          <span className="ps-chip2" data-testid="ps-village-count">{T("village_count", { n: nBuilt, of: VILLAGE.length })}</span>
          <span className="ps-chip2" data-testid="ps-village-friends">{T("village_friends", { n: friends.length })}</span>
          <span className="ps-chip2" data-testid="ps-village-fish"><IconFish /> <b>{T("village_fish", { n: fish })}</b></span>
        </div>

        <h3 style={{ margin: "12px 0 6px" }}>{T("village_build")}</h3>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }} data-testid="ps-village-tray">
          {VILLAGE.map((b) => { const has = built.includes(b.id); const can = fish >= b.cost; const on = pick === b.id; return (
            <div key={b.id} className="ps-card" style={{ margin: 0, padding: 8, width: 138, flex: "0 0 138px", textAlign: "center", opacity: has ? 0.8 : 1, outline: on ? `3px solid ${GOLD}` : "none" }} data-testid={`ps-bld-${b.id}`} data-built={has ? 1 : 0}>
              <svg viewBox="-80 -150 160 170" width="100%" style={{ display: "block", maxHeight: 92 }} aria-hidden="true"><g opacity={has ? 1 : 0.55}><Art id={b.id} /></g></svg>
              <b style={{ display: "block", margin: "2px 0 4px" }}>{T(`bld_${b.id}`)}</b>
              {has ? <span className="ps-help" style={{ color: "#2a3f9a", fontWeight: 800 }}>{T("village_built")}</span>
                : <button type="button" className="ps-chip" disabled={!can} aria-pressed={on} onClick={() => { setPick(on ? null : b.id); setNote(on ? "" : T("village_pick_plot", { name: T(`bld_${b.id}`) })); }} data-testid={`ps-build-${b.id}`}>{on ? T("village_cancel") : can ? T("village_buy", { n: b.cost }) : T("village_need", { n: b.cost - fish })}</button>}
            </div>); })}
        </div>
        <div style={{ overflowX: "auto", marginTop: 8, borderRadius: 22, border: "3px solid #4a5cc8", boxShadow: "0 12px 40px rgba(0,0,40,.5)" }} data-testid="ps-village-scroll">
          <svg viewBox={`0 40 ${W} ${H - 30}`} role="group" aria-label={T("village_scene")} style={{ display: "block", width: "100%", minWidth: 760 }} data-testid="ps-village-scene">
            <defs>
              <linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a0630" /><stop offset=".55" stopColor="#2a2f9a" /><stop offset="1" stopColor="#8d6be0" /></linearGradient>
              <linearGradient id="vs-snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dbe8ff" /><stop offset="1" stopColor="#a9bff0" /></linearGradient>
              <linearGradient id="vs-snow2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f9ff" /><stop offset="1" stopColor="#cfe0ff" /></linearGradient>
              <linearGradient id="vs-aur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#7fe3ff" stopOpacity="0" /><stop offset=".4" stopColor="#7fe3ff" stopOpacity=".55" /><stop offset=".7" stopColor="#b39dff" stopOpacity=".5" /><stop offset="1" stopColor="#ff9ec7" stopOpacity="0" /></linearGradient>
            </defs>
            <rect width={W} height={H} fill="url(#vs-sky)" />
            {Array.from({ length: 38 }, (_, i) => <circle key={i} cx={(i * 197) % W} cy={((i * 71) % 190) + 10} r={i % 5 === 0 ? 2 : 1.2} fill="#fff" opacity={0.4 + (i % 4) * 0.15} />)}
            <path className="ps-aurora" d="M0 90 C160 30 300 140 470 70 S760 30 960 100 L960 150 C760 90 600 190 440 120 S140 100 0 150 Z" fill="url(#vs-aur)" />
            <path d="M0 300 L120 190 L210 260 L330 150 L470 270 L590 180 L720 265 L850 170 L960 250 V330 H0 Z" fill="#26357f" />
            <path d="M330 150 l-30 34 l22 -8 l14 14 l16 -16 l20 10 Z M850 170 l-26 30 l20 -6 l12 12 l14 -14 l16 8 Z M120 190 l-22 26 l16 -4 l10 10 l12 -12 l12 6 Z" fill="#dfe9ff" />
            <path d="M0 330 Q240 290 480 320 T960 300 V420 H0 Z" fill="url(#vs-snow)" />
            <path d="M0 420 Q200 390 480 412 T960 398 V520 H0 Z" fill="url(#vs-snow2)" />

            {/* the plots: an empty one is a soft dashed pad; while a building is picked they glow and can be tapped */}
            {PLOTS.map((p, i) => { const id = placed[i] as BuildingId | null; const isRising = rising?.plot === i; return (
              <g key={i} transform={`translate(${p.x} ${p.y})`} data-testid={`ps-plot-${i}`} data-plot={i} data-building={id ?? ""}
                role="button" tabIndex={0} aria-label={id ? T(`bld_${id}`) : pick ? T("village_plot_free", { n: i + 1 }) : T("village_plot_empty", { n: i + 1 })}
                onClick={() => tapPlot(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapPlot(i); } }} style={{ cursor: pick || id ? "pointer" : "default", outline: "none" }}>
                <ellipse cx="0" cy="4" rx={72 * p.s} ry={14 * p.s} fill="rgba(20,30,100,.22)" />
                {!id && <ellipse cx="0" cy="0" rx={60 * p.s} ry={12 * p.s} fill={pick ? "rgba(255,206,74,.22)" : "rgba(140,170,230,.18)"} stroke={pick ? GOLD : "#8ea8dc"} strokeWidth="2.5" strokeDasharray="7 6" className={pick && !reduced ? "ps-plotpulse" : undefined} />}
                {!id && pick && <text x="0" y={5 * p.s} textAnchor="middle" fontSize={22 * p.s} fontWeight="800" fill={GOLD}>+</text>}
                {id && (
                  <g transform={`scale(${p.s})`}>
                    <g className={isRising && !reduced ? "ps-rise" : undefined} data-rising={isRising ? 1 : 0}><Art id={id} /></g>
                    {isRising && !reduced && <g aria-hidden="true">{[-46, -16, 18, 48].map((dx, k) => <circle key={k} className="ps-dust" cx={dx} cy="-4" r="9" fill="#fff" style={{ animationDelay: `${k * 0.07}s` }} />)}{[[-30, -80], [26, -96], [0, -120], [44, -60]].map(([x, y], k) => <path key={k} className="ps-spark" d={`M${x} ${y - 8} l2.4 5.2 l5.6 .6 l-4.2 3.8 l1.2 5.6 l-5 -2.8 l-5 2.8 l1.2 -5.6 l-4.2 -3.8 l5.6 -.6 Z`} fill={GOLD} style={{ animationDelay: `${0.5 + k * 0.12}s` }} />)}</g>}
                  </g>
                )}
              </g>); })}

            {/* the friends you have freed wander between the plots */}
            {wanderers.map((w, i) => (
              <image key={w.id} href={friendImage(w.sp, 128)} x={w.x - 26} y={w.y - 50} width="52" height="52" className={reduced ? undefined : "ps-wander"} style={{ animationDelay: `-${w.ph * 6}s`, animationDuration: `${7 + (i % 4)}s` }} data-testid={`ps-villager-${i}`} aria-hidden="true" />
            ))}
          </svg>
        </div>
        <p className="ps-help" role="status" aria-live="polite" style={{ color: "#dbe5ff", minHeight: 22, marginTop: 6 }} data-testid="ps-village-note">{note}</p>

        <h3 style={{ margin: "20px 0 8px" }}>{T("village_shop")}</h3>
        <div className="ps-row" style={{ justifyContent: "flex-start" }}>
          {shop.map((c) => { const has = bought.includes(c.id); const cost = c.unlock.fish!; return (
            <button key={c.id} type="button" className="ps-chip" disabled={has || fish < cost} onClick={() => onBuy(c.id, cost)} data-testid={`ps-shop-${c.id}`}>{T(`cos_${c.id}`)} · {has ? T("village_bought") : `${cost}`}</button>); })}
        </div>
        <div className="ps-row" style={{ marginTop: 18 }}><button className="ps-btn ps-big" type="button" style={{ minHeight: 60, fontSize: 22 }} onClick={onClose} data-testid="ps-village-close">{T("village_back")}</button></div>
      </div>
    </div>
  );
}

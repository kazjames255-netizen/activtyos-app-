"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { useMascotSettingsCalm } from "./settings";

// The Learning/Teaching Hub mascot: ONE shared skeleton (body, belly, cheeks, eyes, beak, cap, wings, feet) that every
// pose re-poses, so they all read as the same character. Pure SVG, no assets, no user-visible strings.
// The penguin's own colours are fixed; only the ground shadow / ledge follow the theme (CSS variables).

export const MASCOT_POSES = [
  "wave", "celebrate", "think", "read", "point", "cheer", "encourage", "sleep", "peek", "dance", "speak",
] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export interface MascotProps {
  pose?: MascotPose | "icon";
  /** Rendered width AND height in px (square). Default 120. */
  size?: number;
  /** Decorative by default (aria-hidden). Pass `decorative={false}` + `label` when the mascot carries meaning. */
  decorative?: boolean;
  /** Already-translated accessible name; only used when not decorative. */
  label?: string;
  /** No idle animation (blink/bob/wave). Also forced by Calm mode and prefers-reduced-motion. */
  still?: boolean;
  /** For `point`: which way the wing points. */
  dir?: "left" | "right";
  /** For `think`: show the thought bubble. Default true. */
  bubble?: boolean;
  /** Soft ground shadow under the feet. Default true. */
  ground?: boolean;
  className?: string;
  style?: CSSProperties;
}

const NAVY = "#1b2350";
const EYE = "#1d1630";
const RIM = "#3b4a92";

const CSS = `
.pcy-bob{animation:pcy-bob 3.4s ease-in-out infinite}
.pcy-blink{animation:pcy-blink 4.6s infinite;transform-origin:100px 96px}
.pcy-wave{animation:pcy-wave 1.1s ease-in-out infinite alternate}
.pcy-flap-a{animation:pcy-flap 1s ease-in-out infinite alternate}
.pcy-flap-b{animation:pcy-flap 1s ease-in-out infinite alternate-reverse}
.pcy-sway{animation:pcy-sway 1s ease-in-out infinite alternate;transform-origin:100px 190px}
.pcy-hop{animation:pcy-hop 1.1s ease-in-out infinite}
.pcy-twinkle{animation:pcy-twinkle 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.pcy-float{animation:pcy-float 3s ease-in-out infinite}
@keyframes pcy-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes pcy-blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.08)}}
@keyframes pcy-wave{from{transform:rotate(-9deg)}to{transform:rotate(11deg)}}
@keyframes pcy-flap{from{transform:rotate(-18deg)}to{transform:rotate(14deg)}}
@keyframes pcy-sway{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
@keyframes pcy-hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-7px)}}
@keyframes pcy-twinkle{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}
@keyframes pcy-float{0%{opacity:0;transform:translate(0,4px)}30%{opacity:1}100%{opacity:0;transform:translate(4px,-8px)}}
@media (prefers-reduced-motion:reduce){.pcy *{animation:none!important}}
.pcy-still *{animation:none!important}
`;

function star(cx: number, cy: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

const CONFETTI: Array<[number, number, string, "s" | "c" | "r", number]> = [
  [30, 40, "#f5b81f", "s", 7], [168, 36, "#ff8fa3", "s", 6], [16, 88, "#6ec6ff", "c", 3.5], [186, 84, "#7bd88f", "r", 5],
  [46, 16, "#ff8fa3", "r", 5], [140, 14, "#6ec6ff", "s", 5], [178, 128, "#f5b81f", "c", 3.5], [12, 130, "#7bd88f", "s", 5],
];

function Confetti() {
  return (
    <g>
      {CONFETTI.map(([x, y, c, k, s], i) => (
        <g key={i} className="pcy-twinkle" style={{ animationDelay: `${i * 0.23}s` }}>
          {k === "s" ? <path d={star(x, y, s)} fill={c} /> : k === "c" ? <circle cx={x} cy={y} r={s} fill={c} /> : <rect x={x - s} y={y - s / 2} width={s * 2} height={s} rx="1.5" fill={c} transform={`rotate(${i * 33} ${x} ${y})`} />}
        </g>
      ))}
    </g>
  );
}

// A wing hangs from its shoulder pivot; `a` rotates it (left wing + = out/up, right wing - = out/up); `s` shortens it.
function Wing({ side, a, s = 1, anim, fill }: { side: "l" | "r"; a: number; s?: number; anim?: string; fill: string }) {
  const px = side === "l" ? 55 : 145;
  return (
    <g transform={`translate(${px} 104) rotate(${a})`}>
      <g className={anim}>
        <ellipse cx="0" cy={27 * s} rx="12" ry={31 * s} fill={fill} stroke={RIM} strokeOpacity=".55" strokeWidth="1.4" />
        <ellipse cx="-3.5" cy={18 * s} rx="3" ry={12 * s} fill="#fff" opacity=".08" />
      </g>
    </g>
  );
}

type EyeMode = "open" | "happy" | "closed";
function Eyes({ mode, look = [0, 0], blink }: { mode: EyeMode; look?: [number, number]; blink: boolean }) {
  const xs = [82, 118];
  if (mode === "happy") {
    return <g fill="none" stroke={EYE} strokeWidth="4" strokeLinecap="round">{xs.map((x) => <path key={x} d={`M${x - 8} 99Q${x} 86 ${x + 8} 99`} />)}</g>;
  }
  if (mode === "closed") {
    return <g fill="none" stroke={EYE} strokeWidth="3.6" strokeLinecap="round">{xs.map((x) => <path key={x} d={`M${x - 8} 94Q${x} 104 ${x + 8} 94`} />)}</g>;
  }
  return (
    <g className={blink ? "pcy-blink" : undefined}>
      {xs.map((x) => {
        const ex = x + look[0], ey = 96 + look[1];
        return (
          <g key={x}>
            <circle cx={ex} cy={ey} r="8.6" fill={EYE} />
            <circle cx={ex + 3.4} cy={ey - 3.5} r="3.2" fill="#fff" />
            <circle cx={ex - 3} cy={ey + 3.6} r="1.5" fill="#fff" opacity=".85" />
          </g>
        );
      })}
    </g>
  );
}

interface Def {
  eyes: EyeMode;
  look?: [number, number];
  lw: number; rw: number; lS?: number; rS?: number;
  lFront?: boolean; rFront?: boolean;
  dy?: number; tilt?: number;
  open?: boolean;
  blush?: number;
}

const DEFS: Record<Exclude<MascotPose, "peek">, Def> = {
  wave: { eyes: "open", lw: 14, rw: -150 },
  celebrate: { eyes: "happy", lw: 152, rw: -152, dy: -8, open: true, blush: 0.6 },
  think: { eyes: "open", look: [3, -3], lw: 14, rw: 66, rS: 0.72, rFront: true, tilt: -3 },
  read: { eyes: "open", look: [0, 4], lw: -22, rw: 22, lS: 0.92, rS: 0.92, lFront: true, rFront: true },
  point: { eyes: "open", look: [3, 0], lw: 14, rw: -92, tilt: 2 },
  cheer: { eyes: "happy", lw: 34, rw: -158, dy: -14, open: true, blush: 0.6 },
  encourage: { eyes: "open", lw: 12, rw: -72, rS: 0.72, tilt: 4, blush: 0.75 },
  sleep: { eyes: "closed", lw: 10, rw: -10, dy: 5, tilt: -4 },
  dance: { eyes: "happy", lw: 60, rw: -60, open: true, blush: 0.6 },
  speak: { eyes: "open", lw: 16, rw: -14, open: true },
};

function Beak({ open, id }: { open?: boolean; id: string }) {
  if (!open) return <path d="M91 106Q100 103 109 106Q108 114 100 120Q92 114 91 106Z" fill={`url(#${id}-o)`} />;
  return (
    <g>
      <path d="M92 105Q100 102 108 105Q107 110 100 113Q93 110 92 105Z" fill={`url(#${id}-o)`} />
      <path d="M93 112Q100 120 107 112Q106 122 100 124Q94 122 93 112Z" fill="#c2452e" />
      <path d="M94.5 113Q100 118 105.5 113Q104 121 100 122Q96 121 94.5 113Z" fill="#e8807a" />
    </g>
  );
}

function Cap() {
  return (
    <g>
      <path d="M76 74v13q24 14 48 0V74Z" fill="#2a3470" />
      <polygon points="50,64 100,42 150,64 100,86" fill="#151b40" />
      <polygon points="50,64 100,42 100,52 66,66" fill="#fff" opacity=".1" />
      <path d="M146 64v16" stroke="#f5b81f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="146" cy="83" r="4.6" fill="#f5b81f" />
      <path d="M144 87l-1.5 5M146 87.5v6M148 87l1.5 5" stroke="#f5b81f" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Book() {
  return (
    <g>
      <path d="M62 138Q100 128 138 138V176Q100 166 62 176Z" fill="#c9483a" />
      <path d="M66 140Q100 131 134 140V172Q100 163 66 172Z" fill="#fff8ea" />
      <path d="M100 133V168" stroke="#e4d3ac" strokeWidth="2" />
      <path d="M72 148Q86 144 94 147M72 156Q86 152 94 155M106 147Q114 144 128 148M106 155Q114 152 128 156" stroke="#d9c79c" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Icon({ id }: { id: string }) {
  return (
    <g>
      <ellipse cx="100" cy="112" rx="64" ry="62" fill={`url(#${id}-b)`} />
      <ellipse cx="100" cy="146" rx="40" ry="30" fill={`url(#${id}-w)`} />
      <ellipse cx="72" cy="112" rx="24" ry="26" fill="#fbfbff" />
      <ellipse cx="128" cy="112" rx="24" ry="26" fill="#fbfbff" />
      {[72, 128].map((x) => (
        <g key={x}>
          <circle cx={x} cy="114" r="13" fill={EYE} />
          <circle cx={x + 5} cy="108" r="4.6" fill="#fff" />
          <circle cx={x - 4} cy="119" r="2" fill="#fff" opacity=".85" />
        </g>
      ))}
      <path d="M86 130Q100 126 114 130Q112 144 100 152Q88 144 86 130Z" fill={`url(#${id}-o)`} />
      <polygon points="34,72 100,44 166,72 100,100" fill="#151b40" />
      <path d="M166 72v26" stroke="#f5b81f" strokeWidth="5" strokeLinecap="round" />
      <circle cx="166" cy="102" r="8" fill="#f5b81f" />
    </g>
  );
}

export function Mascot({ pose = "wave", size = 120, decorative = true, label, still = false, dir = "right", bubble = true, ground = true, className, style }: MascotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = `pcy${uid}`;
  const calm = useMascotSettingsCalm();
  const noMotion = still || calm;
  const meaningful = !decorative && !!label;
  const isIcon = pose === "icon";
  const isPeek = pose === "peek";
  const d: Def = isPeek ? { eyes: "open", look: [0, 1], lw: 0, rw: 0, dy: 20 } : isIcon ? { eyes: "open", lw: 0, rw: 0 } : DEFS[pose];
  const dy = d.dy ?? 0;
  const mirror = pose === "point" && dir === "left";
  const jumping = pose === "cheer" || pose === "celebrate";

  const wingFill = `url(#${id}-b)`;
  const wave = pose === "wave";
  const dance = pose === "dance";
  const rAnim = wave ? "pcy-wave" : dance ? "pcy-flap-a" : undefined;
  const lAnim = dance ? "pcy-flap-b" : undefined;

  const body: ReactNode = (
    <>
      {/* feet */}
      <ellipse cx="82" cy="184" rx="15" ry="6.5" fill={`url(#${id}-o)`} />
      <ellipse cx="118" cy="184" rx="15" ry="6.5" fill={`url(#${id}-o)`} />
      {!d.lFront && <Wing side="l" a={d.lw} s={d.lS} anim={lAnim} fill={wingFill} />}
      {!d.rFront && <Wing side="r" a={d.rw} s={d.rS} anim={rAnim} fill={wingFill} />}
      <ellipse cx="100" cy="122" rx="50" ry="62" fill={`url(#${id}-b)`} stroke={RIM} strokeOpacity=".5" strokeWidth="1.4" />
      <ellipse cx="100" cy="137" rx="34" ry="45" fill={`url(#${id}-w)`} />
      <ellipse cx="80" cy="96" rx="17" ry="19" fill="#fbfbff" />
      <ellipse cx="120" cy="96" rx="17" ry="19" fill="#fbfbff" />
      <Eyes mode={d.eyes} look={d.look} blink={!noMotion} />
      <Beak open={d.open} id={id} />
      <ellipse cx="66" cy="110" rx="7.5" ry="5" fill="#ff8fa3" opacity={0.4 * (1 + (d.blush ?? 0.4))} />
      <ellipse cx="134" cy="110" rx="7.5" ry="5" fill="#ff8fa3" opacity={0.4 * (1 + (d.blush ?? 0.4))} />
      <Cap />
      {pose === "read" && <Book />}
      {d.lFront && <Wing side="l" a={d.lw} s={d.lS} fill={wingFill} />}
      {d.rFront && <Wing side="r" a={d.rw} s={d.rS} fill={wingFill} />}
      {pose === "encourage" && (
        <g>
          <ellipse cx="180" cy="104" rx="5.5" ry="9.5" fill={wingFill} stroke={RIM} strokeOpacity=".55" strokeWidth="1.4" transform="rotate(-8 180 104)" />
        </g>
      )}
    </>
  );

  const bodyDef = isIcon ? <Icon id={id} /> : isPeek ? null : body;

  return (
    <svg
      viewBox={isIcon ? "24 30 152 148" : "0 0 200 200"}
      width={size}
      height={size}
      className={`pcy${noMotion ? " pcy-still" : ""}${className ? " " + className : ""}`}
      style={{ display: "inline-block", flexShrink: 0, overflow: "visible", ...style }}
      role={meaningful ? "img" : undefined}
      aria-label={meaningful ? label : undefined}
      aria-hidden={meaningful ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-b`} cx=".38" cy=".28" r=".9"><stop offset="0" stopColor="#3f4f92" /><stop offset="1" stopColor="#161d45" /></radialGradient>
        <radialGradient id={`${id}-w`} cx=".4" cy=".3" r=".9"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe6f6" /></radialGradient>
        <linearGradient id={`${id}-o`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffc24d" /><stop offset="1" stopColor="#f0921a" /></linearGradient>
        <clipPath id={`${id}-clip`}><rect x="-20" y="-40" width="240" height="196" /></clipPath>
      </defs>
      <style>{CSS}</style>
      <g transform={mirror ? "translate(200 0) scale(-1 1)" : undefined}>
        {ground && !isIcon && !isPeek && (
          <ellipse cx="100" cy="190" rx={jumping ? 42 : 58} ry={jumping ? 6 : 8} fill="#0b1030" opacity={jumping ? 0.1 : 0.16} />
        )}
        {isIcon ? (
          bodyDef
        ) : isPeek ? (
          <PeekScene id={id} d={d} noMotion={noMotion} />
        ) : (
          <g className={dance ? "pcy-sway" : undefined}>
            <g className={!noMotion && pose !== "cheer" && !dance ? "pcy-bob" : jumping && !noMotion ? "pcy-hop" : undefined}>
              <g transform={`translate(0 ${dy}) ${d.tilt ? `rotate(${d.tilt} 100 190)` : ""}`}>{bodyDef}</g>
            </g>
          </g>
        )}
        {pose === "celebrate" && <Confetti />}
        {pose === "think" && bubble && (
          <g fill="#fff" stroke="#b9c3e6" strokeWidth="1.5">
            <circle cx="150" cy="60" r="3.6" /><circle cx="158" cy="47" r="5.5" />
            <ellipse cx="172" cy="26" rx="24" ry="16" />
            <g stroke="none" fill="#9aa7d6"><circle cx="162" cy="26" r="2.6" /><circle cx="172" cy="26" r="2.6" /><circle cx="182" cy="26" r="2.6" /></g>
          </g>
        )}
        {pose === "cheer" && (
          <g className="pcy-twinkle"><path d={star(158, 30, 12)} fill="#f5b81f" /><path d={star(38, 46, 7)} fill="#ff8fa3" /></g>
        )}
        {pose === "sleep" && (
          <g fill="none" stroke="#7d8fd6" strokeLinecap="round" strokeLinejoin="round">
            <path className="pcy-float" d="M148 62h12l-12 13h12" strokeWidth="3" />
            <path className="pcy-float" style={{ animationDelay: "1s" }} d="M166 40h8l-8 9h8" strokeWidth="2.4" />
          </g>
        )}
        {pose === "dance" && (
          <g className="pcy-float" fill="#7d8fd6">
            <ellipse cx="34" cy="60" rx="5" ry="3.6" /><path d="M38 60V40l10 4" stroke="#7d8fd6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <ellipse cx="166" cy="48" rx="4.4" ry="3.2" /><path d="M170 48V30l9 3" stroke="#7d8fd6" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        )}
        {pose === "speak" && (
          <g fill="none" stroke="#7d8fd6" strokeWidth="3" strokeLinecap="round" transform="translate(22 -30)">
            <path d="M126 108q8 6 0 14" /><path d="M134 102q14 12 0 26" /><path d="M142 96q20 18 0 38" />
          </g>
        )}
      </g>
    </svg>
  );
}

function PeekScene({ id, d, noMotion }: { id: string; d: Def; noMotion: boolean }) {
  const dy = d.dy ?? 26;
  return (
    <g>
      <g clipPath={`url(#${id}-clip)`}>
        <g className={noMotion ? undefined : "pcy-bob"}>
          <g transform={`translate(0 ${dy})`}>
            <ellipse cx="100" cy="122" rx="50" ry="62" fill={`url(#${id}-b)`} stroke={RIM} strokeOpacity=".5" strokeWidth="1.4" />
            <ellipse cx="80" cy="96" rx="17" ry="19" fill="#fbfbff" />
            <ellipse cx="120" cy="96" rx="17" ry="19" fill="#fbfbff" />
            <Eyes mode="open" look={d.look} blink={!noMotion} />
            <Beak id={id} />
            <ellipse cx="66" cy="110" rx="7.5" ry="5" fill="#ff8fa3" opacity=".55" />
            <ellipse cx="134" cy="110" rx="7.5" ry="5" fill="#ff8fa3" opacity=".55" />
            <Cap />
          </g>
        </g>
      </g>
      <rect x="20" y="142" width="160" height="16" rx="8" style={{ fill: "color-mix(in srgb, var(--ink, #171534) 14%, var(--surface, #ffffff))" }} />
      <rect x="20" y="142" width="160" height="4" rx="2" fill="#fff" opacity=".35" />
      <ellipse cx="66" cy="141" rx="13" ry="7.5" fill={`url(#${id}-b)`} stroke={RIM} strokeOpacity=".55" strokeWidth="1.4" />
      <ellipse cx="134" cy="141" rx="13" ry="7.5" fill={`url(#${id}-b)`} stroke={RIM} strokeOpacity=".55" strokeWidth="1.4" />
    </g>
  );
}

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

// A generic glass ORB: a glossy sphere whose LIQUID rises to a percentage, with a slowly drifting wave surface, a few rising bubbles
// and (at 80%+ unless `calm`) a one-shot sparkle burst. Made for the child/parent Progress view (one orb per subject, coloured by the
// subject) and shaped after the tutor flashcard orb in flashcards/StudentRings.tsx (which keeps its own copy — it is not edited here).
// All motion is CSS/SVG (no per-frame JS) and switches off under prefers-reduced-motion; `calm` also drops bubbles and sparkles.

const C0 = 60, ORB_R = 50, WL = 50;
const BUBBLES = [{ x: 46, d: 0, s: 1.7 }, { x: 62, d: 1.2, s: 1.3 }, { x: 76, d: 0.6, s: 2 }, { x: 54, d: 2, s: 1.2 }];

/** One repeating sine surface, 4 wavelengths wide so a one-wavelength drift loops seamlessly. */
function wavePath(amp: number, flip: boolean): string {
  const hw = WL / 2;
  let d = `M0 0`;
  for (let i = 0; i < 8; i++) d += ` Q${i * hw + hw / 2} ${(i % 2 === 0) !== flip ? -2 * amp : 2 * amp} ${(i + 1) * hw} 0`;
  return `${d} L${8 * hw} 120 L0 120 Z`;
}
const WAVE_A = wavePath(3.4, false), WAVE_B = wavePath(2.5, true);

const CSS = `
@media (prefers-reduced-motion: no-preference){
  .gO-liq{transition:transform 1.4s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i)*110ms)}
  .gO-wa{animation:gO-drift 7s linear infinite}
  .gO-wb{animation:gO-drift 11s linear infinite reverse}
  .gO-bub{animation:gO-rise 4.4s ease-in infinite;animation-delay:var(--bd)}
  .gO-spark{animation:gO-spark 1.2s ease-out both;animation-delay:calc(var(--i)*110ms + 1.3s)}
  .gO-zzz{animation:gO-bob 3.4s ease-in-out infinite}
}
@keyframes gO-drift{to{transform:translateX(-${WL}px)}}
@keyframes gO-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(calc(var(--rise)*-1));opacity:0}}
@keyframes gO-spark{0%{transform:rotate(var(--r)) translateY(-52px) scale(0);opacity:0}40%{opacity:1;transform:rotate(var(--r)) translateY(-62px) scale(1)}100%{transform:rotate(var(--r)) translateY(-70px) scale(.2);opacity:0}}
@keyframes gO-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
`;

export function GlassOrb({ pct, color, size = 112, index = 0, aria, center, calm = false }: {
  /** 0–100; null = nothing to show yet (a calm dashed orb with a 💤). */
  pct: number | null;
  /** Liquid colour: any CSS colour, normally a subject accent (`subjectSwatch(subject).base`). */
  color: string;
  size?: number;
  /** Stagger for the entrance (0, 1, 2…). */
  index?: number;
  aria: string;
  /** What sits over the liquid (an emoji, a level word, a %). Defaults to nothing for a filled orb and 💤 for an empty one. */
  center?: ReactNode;
  /** A calm child: no bubbles, no sparkles, the liquid still rises gently. */
  calm?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [go, setGo] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(r); }, []);
  const has = pct != null && pct > 0;
  const p = Math.min(1, Math.max(0, (pct ?? 0) / 100));
  const secure = has && (pct ?? 0) >= 80;
  const bottom = C0 + ORB_R - 2, top = C0 - ORB_R + 2;
  const surface = go ? bottom - p * (bottom - top) : bottom + 14;
  const fillH = p * (bottom - top);
  return (
    <div role="img" aria-label={aria} className="relative grid flex-none place-items-center" style={{ width: size, height: size, ["--i" as string]: index }}>
      <style>{CSS}</style>
      <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`${uid}g`} cx=".34" cy=".28" r=".85">
            <stop offset="0" stopColor="white" stopOpacity=".95" /><stop offset=".35" stopColor="white" stopOpacity=".25" /><stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}s`} cx=".5" cy=".5" r=".5">
            <stop offset=".72" stopColor="black" stopOpacity="0" /><stop offset="1" stopColor="black" stopOpacity=".26" />
          </radialGradient>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`color-mix(in srgb, ${color} 70%, white)`} /><stop offset="1" stopColor={color} />
          </linearGradient>
          <clipPath id={`${uid}c`}><circle cx={C0} cy={C0} r={ORB_R - 2} /></clipPath>
          <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.4" /></filter>
        </defs>
        {/* soft coloured glow behind a filled orb */}
        {has && <circle cx={C0} cy={C0} r={ORB_R} fill={color} opacity=".22" filter={`url(#${uid}f)`} />}
        <circle cx={C0} cy={C0} r={ORB_R} fill="color-mix(in srgb, var(--surface) 72%, transparent)" />
        {has ? (
          <g clipPath={`url(#${uid}c)`}>
            <g className="gO-liq" style={{ transform: `translateY(${surface}px)` }}>
              <g className="gO-wb" style={{ opacity: 0.55 }}><path d={WAVE_B} transform={`translate(${-WL * 0.35} 1.5)`} fill={`url(#${uid}l)`} /></g>
              <g className="gO-wa"><path d={WAVE_A} fill={`url(#${uid}l)`} /></g>
              {!calm && p > 0.05 && BUBBLES.map((b, i) => (
                <circle key={i} className="gO-bub" cx={b.x} cy={Math.max(8, fillH - 6)} r={b.s} fill="white" opacity="0"
                  style={{ ["--bd" as string]: `${b.d}s`, ["--rise" as string]: `${Math.max(6, fillH - 12)}px` }} />
              ))}
            </g>
          </g>
        ) : (
          <circle cx={C0} cy={C0} r={ORB_R - 4} fill="none" stroke="var(--ink-3)" strokeOpacity=".5" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
        )}
        <circle cx={C0} cy={C0} r={ORB_R} fill={`url(#${uid}s)`} />
        <circle cx={C0} cy={C0} r={ORB_R} fill={`url(#${uid}g)`} />
        <circle cx={C0} cy={C0} r={ORB_R} fill="none" strokeWidth={secure ? 3 : 1.6} stroke={secure ? "var(--gold)" : "color-mix(in srgb, var(--surface) 55%, white)"} />
        {secure && !calm && (
          <g transform={`translate(${C0} ${C0})`}>
            {[0, 60, 120, 180, 240, 300].map((r, i) => (
              <path key={r} className="gO-spark" d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4Z" fill="var(--gold)"
                style={{ ["--r" as string]: `${r}deg`, ["--i" as string]: index + i * 0.15, transform: `rotate(${r}deg) translateY(-64px)` }} />
            ))}
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-hidden
        style={{ color: has && p >= 0.55 ? "white" : "var(--ink)", textShadow: has && p >= 0.55 ? "0 1px 3px color-mix(in srgb, var(--ink) 55%, transparent)" : "0 1px 0 color-mix(in srgb, var(--surface) 80%, transparent)" }}>
        {center ?? (has ? null : <span className="gO-zzz text-[32px] leading-none" role="presentation">💤</span>)}
      </div>
    </div>
  );
}

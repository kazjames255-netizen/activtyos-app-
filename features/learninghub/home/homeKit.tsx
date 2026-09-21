"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { colorFor } from "@/features/money/finance-kit";
import { FOCUS, Icon, Skeleton, type IconName } from "../kit";
import { DISPLAY, TONES, type Tone } from "../teachKit";
import { Ico } from "../teachIcons";
import { initialsOf } from "./homeLib";

// Building blocks for the Home tab. Tokens only (var(--…)); motion is opt-out via
// prefers-reduced-motion. Same primitives as the rest of the hub (kit.tsx).

export { DISPLAY, FOCUS, Icon, TONES };
export type { IconName, Tone };

/** Keyframes + classes, injected once by the panel. */
export function HomeStyles() {
  return (
    <style>{`
      @keyframes home-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes home-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes home-ring { from { stroke-dashoffset: var(--home-len); } }
      @keyframes home-live { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--red) 55%, transparent); } 100% { box-shadow: 0 0 0 9px transparent; } }
      @keyframes home-shine { from { transform: translateX(-120%); } to { transform: translateX(220%); } }
      .home-rise { animation: home-rise .55s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--d, 0ms); }
      .home-grow { transform-origin: bottom; transform-box: fill-box; animation: home-grow .6s cubic-bezier(.2,.7,.2,1) both; animation-delay: var(--d, 0ms); }
      .home-ring { animation: home-ring 1s cubic-bezier(.2,.7,.2,1) both; }
      .home-live { animation: home-live 1.6s ease-out infinite; }
      @keyframes home-flicker { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: scale(1.04, 1.07) rotate(-1.5deg); } 65% { transform: scale(.98, 1.03) rotate(1.5deg); } }
      .home-flicker { transform-origin: 50% 90%; animation: home-flicker 2.2s ease-in-out infinite; }
      .home-lift { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
      .home-lift:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
      @media (prefers-reduced-motion: reduce) {
        .home-rise, .home-grow, .home-ring, .home-live, .home-flicker { animation: none !important; }
        .home-lift, .home-lift:hover { transition: none; transform: none; }
      }
    `}</style>
  );
}

export const rise = (i: number): CSSProperties => ({ ["--d" as string]: `${i * 60}ms` });

/** A tinted rounded icon tile — the colour budget for a card. */
export function IconTile({ icon, tone = "brand", size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const t = TONES[tone];
  return (
    <span aria-hidden className="grid flex-none place-items-center rounded-2xl" style={{ width: size, height: size, background: t.bg, color: t.fg, border: `1px solid ${t.line}` }}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** A section card with a header row (title, optional aside) and generous padding. */
export function Card({ title, icon, tone = "brand", aside, children, className = "", style, id, as: As = "section" }: {
  title: ReactNode; icon?: IconName; tone?: Tone; aside?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties; id?: string; as?: "section" | "div";
}) {
  return (
    <As id={id} data-ui="card" aria-label={typeof title === "string" ? title : undefined} className={`home-rise min-w-0 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5 ${className}`} style={style}>
      <header className="mb-3.5 flex items-center gap-2.5">
        {icon && <IconTile icon={icon} tone={tone} size={34} />}
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{title}</h3>
        {aside}
      </header>
      {children}
    </As>
  );
}

/** The person chip: coloured initials disc. */
export function Person({ name, size = 30, ring = false }: { name: string; size?: number; ring?: boolean }) {
  return (
    <span aria-hidden className="grid flex-none place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: colorFor(name), boxShadow: ring ? "0 0 0 2px var(--surface)" : undefined }}>
      {initialsOf(name)}
    </span>
  );
}

/** Overlapping avatar stack + a "+N". */
export function Stack({ names, max = 4, size = 30 }: { names: string[]; max?: number; size?: number }) {
  const shown = names.slice(0, max);
  const more = names.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-hidden>
      {shown.map((n, i) => <span key={n + i} style={{ marginLeft: i ? -size * 0.28 : 0 }}><Person name={n} size={size} ring /></span>)}
      {more > 0 && <span className="grid place-items-center rounded-full bg-[var(--panel)] text-[11px] font-extrabold text-[var(--ink-2)]" style={{ width: size, height: size, marginLeft: -size * 0.28, boxShadow: "0 0 0 2px var(--surface)" }}>+{more}</span>}
    </span>
  );
}

/** A score ring: track + coloured arc, the number in the centre. `sr` is the accessible text. */
export function ScoreRing({ pct, size = 76, color, sub, sr }: { pct: number | null; size?: number; color: string; sub?: string; sr: string }) {
  const sw = Math.max(6, Math.round(size / 10));
  const r = size / 2 - sw / 2;
  const c = 2 * Math.PI * r;
  const v = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  const dash = (c * v) / 100;
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={sr}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        {pct != null && <circle className="home-ring" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - dash} style={{ ["--home-len" as string]: c }} />}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" aria-hidden>
        <span className="font-extrabold tabular-nums leading-none text-[var(--ink)]" style={{ ...DISPLAY, fontSize: size * (v >= 100 ? 0.22 : 0.27) }}>{pct == null ? "–" : `${Math.round(v)}%`}</span>
        {sub && <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{sub}</span>}
      </div>
    </div>
  );
}

/** Primary pill button (brand gradient), ≥44px. */
export function BigButton({ children, onClick, icon, variant = "brand", className = "", ariaLabel }: { children: ReactNode; onClick?: () => void; icon?: IconName; variant?: "brand" | "white" | "ghost"; className?: string; ariaLabel?: string }) {
  const style: CSSProperties =
    variant === "brand" ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))", color: "#fff", boxShadow: "0 8px 20px -8px color-mix(in srgb, var(--brand) 80%, transparent)" }
    : variant === "white" ? { background: "#fff", color: "var(--brand-strong)", boxShadow: "0 10px 24px -10px rgba(0,0,0,.45)" }
    : { background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.35)" };
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 text-[14px] font-extrabold transition hover:-translate-y-px active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} ${className}`} style={style}>
      {icon && <Icon name={icon} size={17} />}{children}
    </button>
  );
}

/** A quiet inline note when one part of Home couldn't load (the rest still shows). */
export function PartError({ what, message, onRetry }: { what: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed px-3.5 py-3 text-[12.5px] font-semibold" style={{ borderColor: "var(--red-line)", background: "var(--red-soft)", color: "var(--ink)" }}>
      <Icon name="warning" size={15} className="text-[var(--red)]" />
      <span className="min-w-0 flex-1">Couldn&apos;t load {what}{message ? ` — ${message}` : ""}.</span>
      {onRetry && <button type="button" onClick={onRetry} className={`min-h-[44px] lg:min-h-[36px] rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>Try again</button>}
    </div>
  );
}

/** Home's loading state: shaped like the real layout so nothing jumps. */
export function HomeSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[248px] !rounded-3xl" />
        <Skeleton className="h-[248px] !rounded-3xl" />
      </div>
      <Skeleton className="h-[76px] !rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[260px] !rounded-3xl" />
        <Skeleton className="h-[260px] !rounded-3xl" />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** "Not started" / a count with a plural. */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;


/** An SVG flame. Lit = gold-to-red; unlit = a quiet outline on the hero. The day
 *  count sits inside it. */
export function Flame({ size = 56, lit = true, n }: { size?: number; lit?: boolean; n?: number }) {
  const id = useId();
  return (
    <span aria-hidden className="relative inline-grid flex-none place-items-center" style={{ width: size * 0.82, height: size }}>
      <svg viewBox="0 0 48 60" width={size * 0.82} height={size} className={lit ? "home-flicker" : ""} fill="none">
        <defs>
          <linearGradient id={`${id}o`} x1="24" y1="2" x2="24" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--gold)" /><stop offset="1" stopColor="var(--red)" />
          </linearGradient>
        </defs>
        <path d="M24 3C25 13 38 19 38 36a14 14 0 0 1-28 0c0-8 4-12 7.5-16.500.5 4.500 3 7.500 5.500 8.500-1.500-10-1-18 1-25z"
          fill={lit ? `url(#${id}o)` : "rgba(255,255,255,.2)"} stroke={lit ? undefined : "rgba(255,255,255,.5)"} strokeWidth={lit ? 0 : 1.5} />
        {lit && <path d="M24 32c2 4.500 6.500 6.500 6.500 12a6.500 6.500 0 0 1-13 0c0-3.500 2-5.500 3.500-8 1 2 2 3 3 3-.5-3.500 0-5.500 0-7z" fill="#fff" fillOpacity=".55" />}
      </svg>
      {n !== undefined && <span className="absolute font-extrabold tabular-nums text-white" style={{ ...DISPLAY, fontSize: size * 0.3, bottom: size * 0.16, textShadow: lit ? "0 1px 3px rgba(0,0,0,.35)" : undefined }}>{n}</span>}
    </span>
  );
}

/** Seven dots for the last seven days (oldest first); today is ringed. */
export function WeekDots({ dots }: { dots: { day: number; letter: string; active: boolean; today: boolean }[] }) {
  const on = dots.filter((d) => d.active).length;
  return (
    <div role="img" aria-label={`Active on ${on} of the last 7 days`} className="flex items-end gap-1.5">
      {dots.map((d) => (
        <span key={d.day} className="flex flex-col items-center gap-1">
          <span className="grid h-[18px] w-[18px] place-items-center rounded-full transition-colors" style={{ background: d.active ? "#fff" : "rgba(255,255,255,.16)", boxShadow: d.today ? "0 0 0 2px rgba(255,255,255,.55)" : undefined, color: "var(--brand-strong)" }}>
            {d.active && <Ico name="check" size={11} strokeWidth={3.4} />}
          </span>
          <span className="text-[11px] font-bold uppercase text-white/65">{d.letter}</span>
        </span>
      ))}
    </div>
  );
}

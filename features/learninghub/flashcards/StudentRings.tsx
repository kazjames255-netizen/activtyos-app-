"use client";

import { useEffect, useId, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { colorFor } from "@/features/money/finance-kit";
import { FOCUS, Pill, fmtDay } from "../teachKit";
import { Person } from "../home/homeKit";
import { requestOpenStudent } from "../hubIntent";
import type { FlashStats } from "./fcTypes";

// Tutor Flashcards → "Student progress": one frosted-glass card per child, each with a glass ORB whose liquid rises to the
// progress against the cards ASSIGNED to that child (never the whole library: 14 of 22,229 always read as 0%), wrapped in
// a rainbow progress arc. At most 5 cards, "Show all" for the rest, and an Open / Close toggle for the whole list.
// All motion is CSS/SVG (no per-frame JS) and is switched off for prefers-reduced-motion.

type Row = FlashStats["students"][number];

const DAY = 86_400_000;
/** Whole days since the child last reviewed a card (0 = today); null when they never have. */
function daysAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const d = new Date(iso), n = new Date(now);
  return Math.max(0, Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY));
}

// ── orb geometry (viewBox 0 0 120 120) ──
const C0 = 60, ARC_R = 54, ARC_W = 8, ORB_R = 44, LIQ_R = 42, WL = 44;
const STOPS = ["var(--brand-2)", "var(--violet)", "color-mix(in srgb, var(--red) 45%, var(--violet))", "var(--gold)"]; // blue → violet → pink → gold
/** Colour at t∈[0,1] along the four-stop rainbow, mixed in the browser so it follows the theme. */
function rainbow(t: number): string {
  const k = Math.min(2, Math.floor(t * 3)), u = Math.round((t * 3 - k) * 100);
  return u <= 0 ? STOPS[k]! : `color-mix(in srgb, ${STOPS[k]} ${100 - u}%, ${STOPS[k + 1]} ${u}%)`;
}
const SEGS = Array.from({ length: 36 }, (_, i) => {
  const a0 = (i / 36) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1.15) / 36) * 2 * Math.PI - Math.PI / 2; // tiny overlap hides seams
  const p = (a: number) => `${(C0 + ARC_R * Math.cos(a)).toFixed(2)} ${(C0 + ARC_R * Math.sin(a)).toFixed(2)}`;
  return { d: `M${p(a0)} A${ARC_R} ${ARC_R} 0 0 1 ${p(a1)}`, color: rainbow((i + 0.5) / 36) };
});
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
/** One repeating sine surface, 4 wavelengths wide so a one-wavelength drift loops seamlessly. */
function wavePath(amp: number, flip: boolean): string {
  const hw = WL / 2;
  let d = `M0 0`;
  for (let i = 0; i < 8; i++) d += ` Q${i * hw + hw / 2} ${(i % 2 === 0) !== flip ? -2 * amp : 2 * amp} ${(i + 1) * hw} 0`;
  return `${d} L${8 * hw} 120 L0 120 Z`;
}
const WAVE_A = wavePath(3.2, false), WAVE_B = wavePath(2.4, true);
const BUBBLES = [{ x: 44, d: 0, s: 1.6 }, { x: 58, d: 1.1, s: 1.2 }, { x: 72, d: 0.5, s: 1.9 }, { x: 52, d: 1.8, s: 1.1 }];

const CSS = `
@media (prefers-reduced-motion: no-preference){
  .fcO-arc{transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i)*90ms)}
  .fcO-head{transition:transform 1.1s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i)*90ms)}
  .fcO-liq{transition:transform 1.3s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i)*90ms + 150ms)}
  .fcO-wa{animation:fcO-drift 7s linear infinite}
  .fcO-wb{animation:fcO-drift 11s linear infinite reverse}
  .fcO-bub{animation:fcO-rise 4.2s ease-in infinite;animation-delay:var(--bd)}
  .fcO-spark{animation:fcO-spark 1.1s ease-out both;animation-delay:calc(var(--i)*90ms + 1.1s)}
  .fcO-crown{animation:fcO-pop .6s cubic-bezier(.3,1.6,.5,1) both;animation-delay:calc(var(--i)*90ms + 1.2s)}
  .fcO-zzz{animation:fcO-bob 3.4s ease-in-out infinite}
}
@keyframes fcO-drift{to{transform:translateX(-${WL}px)}}
@keyframes fcO-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.85}100%{transform:translateY(calc(var(--rise)*-1));opacity:0}}
@keyframes fcO-spark{0%{transform:rotate(var(--r)) translateY(-50px) scale(0);opacity:0}40%{opacity:1;transform:rotate(var(--r)) translateY(-60px) scale(1)}100%{transform:rotate(var(--r)) translateY(-68px) scale(.2);opacity:0}}
@keyframes fcO-pop{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes fcO-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
`;

function Orb({ pct, assigned, index, aria }: { pct: number; assigned: number; index: number; aria: string }) {
  const { t: tr } = useI18n();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [go, setGo] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(r); }, []);
  const has = assigned > 0;
  const p = Math.min(1, Math.max(0, pct / 100));
  const full = has && pct >= 100;
  const arcLen = 2 * Math.PI * ARC_R;
  const shown = go ? p : 0;
  // Liquid surface: y from the orb bottom (0%) to its top (100%); starts below the orb and rises once.
  const bottom = C0 + LIQ_R, top = C0 - LIQ_R;
  const surface = go ? bottom - p * (bottom - top) : bottom + 12;
  const fillH = p * (bottom - top);
  const light = has && pct >= 55; // liquid above the number → white text
  return (
    <div role="img" aria-label={aria} className="relative grid place-items-center" style={{ width: 124, height: 124, ["--i" as string]: index }}>
      <svg width="124" height="124" viewBox="0 0 120 120" aria-hidden style={{ overflow: "visible" }}>
        <defs>
          <radialGradient id={`${uid}g`} cx=".34" cy=".28" r=".85">
            <stop offset="0" stopColor="white" stopOpacity=".95" />
            <stop offset=".35" stopColor="white" stopOpacity=".25" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}s`} cx=".5" cy=".5" r=".5">
            <stop offset=".72" stopColor="black" stopOpacity="0" />
            <stop offset="1" stopColor="black" stopOpacity=".28" />
          </radialGradient>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="color-mix(in srgb, var(--brand-2) 55%, var(--green))" />
            <stop offset="1" stopColor="var(--brand)" />
          </linearGradient>
          <clipPath id={`${uid}c`}><circle cx={C0} cy={C0} r={LIQ_R} /></clipPath>
          <mask id={`${uid}m`}>
            <circle cx={C0} cy={C0} r={ARC_R} fill="none" stroke="white" strokeWidth={ARC_W + 2} strokeLinecap="round" transform={`rotate(-90 ${C0} ${C0})`}
              strokeDasharray={arcLen} strokeDashoffset={arcLen * (1 - shown)} className="fcO-arc" />
          </mask>
          <filter id={`${uid}f`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
        </defs>

        {/* dotted track + tick marks behind the arc */}
        <circle cx={C0} cy={C0} r={ARC_R} fill="none" stroke="var(--ink-3)" strokeOpacity={has ? 0.28 : 0.4} strokeWidth="2" strokeLinecap="round" strokeDasharray={has ? "0.1 5.6" : "4 6"} />
        {has && TICKS.map((a) => <line key={a} x1={C0} y1={C0 - ARC_R - 7} x2={C0} y2={C0 - ARC_R - 4} stroke="var(--ink-3)" strokeOpacity=".35" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${a} ${C0} ${C0})`} />)}

        {has && (
          <>
            {/* the conic arc: 36 coloured segments revealed by the animated mask; blurred copy = soft outer glow */}
            <g mask={`url(#${uid}m)`}>
              <g filter={`url(#${uid}f)`} opacity=".55">{SEGS.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={ARC_W + 2} />)}</g>
              {SEGS.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={ARC_W} />)}
            </g>
            {/* bright head dot at the end of the arc */}
            {p > 0 && !full && (
              <g className="fcO-head" style={{ transformOrigin: `${C0}px ${C0}px`, transform: `rotate(${(go ? p : 0) * 360}deg)` }}>
                <circle cx={C0} cy={C0 - ARC_R} r={ARC_W / 2 + 1.6} fill="white" opacity=".95" />
                <circle cx={C0} cy={C0 - ARC_R} r={ARC_W / 2 - 1} fill={rainbow(Math.min(0.999, p))} />
              </g>
            )}
          </>
        )}

        {/* the glass orb */}
        <circle cx={C0} cy={C0} r={ORB_R} fill="color-mix(in srgb, var(--surface) 70%, transparent)" />
        {has && p > 0 ? (
          <g clipPath={`url(#${uid}c)`}>
            <g className="fcO-liq" style={{ transform: `translateY(${surface}px)` }}>
              <g className="fcO-wb" style={{ opacity: 0.55 }}><path d={WAVE_B} transform={`translate(${-WL * 0.35} 1.5)`} fill={`url(#${uid}l)`} /></g>
              <g className="fcO-wa"><path d={WAVE_A} fill={`url(#${uid}l)`} /></g>
              {p > 0.04 && BUBBLES.map((b, i) => (
                <circle key={i} className="fcO-bub" cx={b.x} cy={Math.max(8, fillH - 6)} r={b.s} fill="white" opacity="0"
                  style={{ ["--bd" as string]: `${b.d}s`, ["--rise" as string]: `${Math.max(6, fillH - 12)}px` }} />
              ))}
            </g>
          </g>
        ) : (
          <circle cx={C0} cy={C0} r={LIQ_R} fill="none" stroke="var(--ink-3)" strokeOpacity=".5" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
        )}
        <circle cx={C0} cy={C0} r={ORB_R} fill={`url(#${uid}s)`} />
        <circle cx={C0} cy={C0} r={ORB_R} fill={`url(#${uid}g)`} />
        <circle cx={C0} cy={C0} r={ORB_R} fill="none" strokeWidth={full ? 3 : 1.6} stroke={full ? "var(--gold)" : "color-mix(in srgb, var(--surface) 55%, white)"} />
        {full && <circle cx={C0} cy={C0} r={ORB_R + 2} fill="none" stroke="var(--gold)" strokeOpacity=".45" strokeWidth="5" filter={`url(#${uid}f)`} />}

        {/* sparkle burst at 100% (one shot on load; static at the rim under reduced motion) */}
        {full && (
          <g transform={`translate(${C0} ${C0})`}>
            {[0, 60, 120, 180, 240, 300].map((r, i) => (
              <path key={r} className="fcO-spark" d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4Z" fill="var(--gold)"
                style={{ ["--r" as string]: `${r}deg`, ["--i" as string]: index + i * 0.15, transform: `rotate(${r}deg) translateY(-62px)` }} />
            ))}
          </g>
        )}
      </svg>

      {/* centre text */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center" aria-hidden>
        {has ? (
          <div className="grid gap-0.5" style={{ color: light ? "white" : "var(--ink)", textShadow: light ? "0 1px 3px color-mix(in srgb, var(--ink) 55%, transparent)" : "0 1px 0 color-mix(in srgb, var(--surface) 80%, transparent)" }}>
            <span className="text-[27px] font-extrabold leading-none" style={{ fontFamily: "var(--ff-display)" }}>{Math.round(pct)}%</span>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.1em] opacity-80">{tr("hubshell.hm_fcAssignedCap")}</span>
          </div>
        ) : (
          <span className="fcO-zzz text-[34px] leading-none" role="presentation">💤</span>
        )}
      </div>
      {full && <span className="fcO-crown absolute -top-1 end-1 grid h-7 w-7 place-items-center rounded-full text-[15px] font-extrabold text-[var(--brand-ink)] shadow-[var(--shadow-sm)]" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--gold) 55%, white), var(--gold))", ["--i" as string]: index }} aria-hidden>✓</span>}
    </div>
  );
}

export function StudentRings({ students, goTo }: { students: Row[]; goTo?: (key: never) => void }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now()); // fixed at mount: recency is by whole days
  // Most due first, then the child who studied longest ago; children who never have go last.
  const sorted = [...students].sort((a, b) => b.due - a.due || (a.lastReviewedAt ?? "9999").localeCompare(b.lastReviewedAt ?? "9999"));
  const shown = sorted.slice(0, all ? 200 : 5);

  const openChild = (s: Row) => { if (!goTo) return; requestOpenStudent(s.childId, s.childName); (goTo as (k: string) => void)("dashboard"); };

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label={tr("hublessons.tfStudentProgress")} data-testid="fc-student-rings">
      <style>{CSS}</style>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tr("hublessons.tfStudentProgress")}</div>
        <button type="button" data-testid="fc-rings-toggle" aria-expanded={open} aria-controls="fc-rings-list" onClick={() => setOpen((o) => !o)}
          className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
          {open ? tr("hubshell.hm_feedClose") : tr("hubshell.hm_feedOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
      </div>
      <div id="fc-rings-list" hidden={!open}>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s, idx) => {
            const assigned = s.assigned ?? 0;
            const reviewedA = s.assignedReviewed ?? 0;
            const pct = assigned ? Math.round((reviewedA / assigned) * 100) : 0;
            const days = daysAgo(s.lastReviewedAt, now);
            const recency = days === null ? "var(--ink-3)" : days <= 1 ? "var(--green)" : days <= 6 ? "var(--gold)" : "var(--red)";
            const last = days === null ? tr("hubshell.hm_fcNever") : days === 0 ? tr("hubshell.hm_fcToday") : days === 1 ? tr("hubshell.hm_fcYesterday") : tr("hubshell.hm_fcLastOn", { day: fmtDay(s.lastReviewedAt!) });
            const first = s.childName.split(" ")[0]!;
            const aria = assigned
              ? tr("hubshell.hm_fcAria", { name: s.childName, p: pct, due: s.due, n: s.new })
              : tr("hubshell.hm_fcAriaNone", { name: s.childName, a: s.reviewed, due: s.due });
            const orbAria = assigned ? tr("hubshell.hm_fcOrbAria", { name: first, a: reviewedA, b: assigned, p: pct }) : tr("hubshell.hm_fcNothing");
            const accent = colorFor(s.childName); // the child's avatar colour tints their card
            const inner = (
              <>
                <Orb pct={pct} assigned={assigned} index={idx} aria={orbAria} />
                <span className="flex items-center gap-2"><Person name={s.childName} size={26} /><span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{first}</span></span>
                <span className="flex flex-wrap justify-center gap-1.5">
                  {s.due > 0 && <Pill tone="gold">{tr("hublessons.tfDueN", { n: s.due })}</Pill>}
                  {s.new > 0 && <Pill tone="violet">{tr("hublessons.tfNewN", { n: s.new })}</Pill>}
                  {s.due === 0 && s.new === 0 && <Pill tone="green">{tr("hublessons.tfUpToDate")}</Pill>}
                </span>
                <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">{assigned ? tr("hubshell.hm_fcRingOf", { a: reviewedA, b: assigned }) : `${tr("hubshell.hm_fcNothing")} · ${tr("hubshell.hm_fcRingRev", { a: s.reviewed })}`}</span>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: recency }}><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: recency }} />{last}</span>
                {!assigned && s.cardsAvailable > 0 && <span className="text-[10.5px] font-semibold text-[var(--ink-3)]">{tr("hubshell.hm_fcLib", { n: s.cardsAvailable.toLocaleString() })}</span>}
              </>
            );
            const cls = `group grid w-full justify-items-center gap-1.5 rounded-[22px] border p-3 pt-4 text-center backdrop-blur-sm transition duration-150 motion-reduce:transition-none ${goTo ? `cursor-pointer hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${FOCUS}` : ""}`;
            const style = {
              background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 22%, var(--surface)), var(--surface) 70%)`,
              borderColor: `color-mix(in srgb, ${accent} 38%, var(--line))`,
              boxShadow: `inset 0 1px 0 color-mix(in srgb, var(--surface) 60%, white), inset 0 -10px 18px -14px color-mix(in srgb, ${accent} 45%, transparent), 0 12px 24px -16px color-mix(in srgb, ${accent} 60%, transparent)`,
            } as const;
            return (
              <li key={s.childId}>
                {goTo
                  ? <button type="button" aria-label={aria} onClick={() => openChild(s)} className={cls} style={style} data-testid={`fc-ring-${s.childId}`}>{inner}</button>
                  : <div role="group" aria-label={aria} className={cls} style={style} data-testid={`fc-ring-${s.childId}`}>{inner}</div>}
              </li>
            );
          })}
        </ul>
        {students.length > 5 && (
          <button type="button" onClick={() => setAll((v) => !v)} className={`mt-3 min-h-[44px] rounded-lg px-1 text-[12px] font-bold text-[var(--brand)] hover:underline lg:min-h-[40px] ${FOCUS}`}>
            {all ? tr("hublessons.tfShowFewer") : tr("hublessons.tfShowAll", { n: students.length })}
          </button>
        )}
      </div>
    </section>
  );
}

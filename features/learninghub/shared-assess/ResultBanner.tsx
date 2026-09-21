"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../kit";
import { useFamily } from "../family/FamilyContext";
import { NEUTRAL, OK, type Tone } from "./format";
import { useReducedMotion } from "./motion";
import { Chip, display, HourglassIcon, ScoreRing } from "./ui";

// THE pass moment. A full-width banner that opens every scored result: a big ring
// fills 0 → score over ~700ms while the number counts up, a soft green glow (and a
// popping tick) marks a pass, and a miss is a calm amber "Nearly there" with a
// one-tap "Review these N topics". Awaiting-marking shows an hourglass, never 0%.
// prefers-reduced-motion: final values immediately, no tick pop, no glow fade.

const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

/** "partial" = handed in with an auto-marked score already counted and written answer(s) still to be marked. */
export type BannerKind = "passed" | "missed" | "pending" | "baseline" | "partial";

export interface PartialInfo { autoMarks: number; autoMax: number; writtenPending: number; /** % points of the ring that may still move. */ maybe: number }

interface Props {
  kind: BannerKind;
  pct: number;
  scoreMarks: number;
  maxMarks: number;
  passMark?: number | null;
  headline: string;
  sub: string;
  eyebrow?: string;
  /** Names of the topics that dragged the score down (missed only). */
  weakTopics?: string[];
  onReviewTopics?: () => void;
  actions?: ReactNode;
  partial?: PartialInfo;
}

export function ResultBanner({ kind, pct, scoreMarks, maxMarks, passMark, headline, sub, eyebrow, weakTopics = [], onReviewTopics, actions, partial }: Props) {
  const fam = useFamily();
  const family = fam.active, kidView = fam.kid;
  const reduced = useReducedMotion();
  const [pop, setPop] = useState(reduced);
  useEffect(() => {
    if (reduced) { setPop(true); return; }
    const t = setTimeout(() => setPop(true), 760);
    return () => clearTimeout(t);
  }, [reduced]);

  const tone = kind === "passed" ? OK : kind === "missed" ? GOLD : BRAND;
  const wash = kind === "passed" ? "var(--green)" : kind === "missed" ? "var(--gold)" : "var(--brand)";
  const wp = partial?.writtenPending ?? 0;
  const gap = passMark != null ? Math.max(0, Math.round(passMark - pct)) : null;

  return (
    <section data-testid="hub-result-banner" data-kind={kind} className="relative overflow-hidden rounded-2xl border shadow-[var(--shadow-sm)]"
      style={{ borderColor: `color-mix(in srgb, ${wash} 30%, var(--line))`, background: `linear-gradient(135deg, color-mix(in srgb, ${wash} 14%, var(--surface)) 0%, var(--surface) 62%)` }}>
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${wash} ${kind === "passed" ? 26 : 14}%, transparent) 0%, transparent 70%)`, opacity: pop ? 1 : 0, transition: reduced ? "none" : "opacity 900ms ease" }} />
      <div className="relative flex flex-col items-center gap-5 p-5 text-center sm:flex-row sm:gap-8 sm:p-8 sm:text-left">
        <div className="relative flex-none">
          <ScoreRing pct={pct} size={172} stroke={14} tone={tone} passMark={kind === "passed" || kind === "missed" ? passMark : null} glow={kind === "passed"}
            state={kind === "pending" ? "pending" : undefined} sub={kind === "pending" ? "Awaiting marking" : kind === "partial" ? "auto-marked" : undefined}
            maybe={kind === "partial" ? partial?.maybe : undefined}
            ariaLabel={kind === "partial" && partial ? `Auto-marked ${partial.autoMarks} out of ${partial.autoMax}, ${Math.round(pct)} percent. ${wp} written ${wp === 1 ? "answer is" : "answers are"} still being marked, so this may change.` : undefined} />
          {kind === "passed" && (
            <span aria-hidden className="absolute -right-1 top-3 grid h-9 w-9 place-items-center rounded-full text-white shadow-[var(--shadow)]"
              style={{ background: "var(--green)", transform: pop ? "scale(1)" : "scale(0)", transition: reduced ? "none" : "transform 420ms cubic-bezier(.3,1.6,.5,1)" }}>
              <Icon name="check" size={20} strokeWidth={2.6} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          {eyebrow && <div className="mb-1 text-[12px] font-bold text-[var(--ink-3)] [overflow-wrap:anywhere]">{eyebrow}</div>}
          <h3 className="m-0 text-[26px] font-extrabold leading-tight text-[var(--ink)] sm:text-[30px]" style={display} data-testid="hub-result-headline">{headline}</h3>
          <p className="m-0 mt-2 max-w-[520px] text-[14px] leading-relaxed text-[var(--ink-2)]">{sub}</p>
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {kind === "partial" && partial
              ? <Chip tone={NEUTRAL}><span className="tabular-nums">{maxMarks} marks in all</span></Chip>
              : <Chip tone={NEUTRAL}><span className="tabular-nums">{scoreMarks} / {maxMarks} marks</span></Chip>}
            {kind === "partial" && <Chip tone={GOLD} icon={<HourglassIcon size={12} />}>{wp} written {wp === 1 ? "answer" : "answers"} with your tutor</Chip>}
            {kind === "pending" && <Chip tone={BRAND} icon={<HourglassIcon size={12} />}>{kidView ? "Your tutor is marking it" : "Awaiting marking"}</Chip>}
            {kind === "baseline" && <Chip tone={BRAND} icon={<Icon name="compass" size={12} />}>{family ? "Starting point set" : "Baseline set"}</Chip>}
            {kind === "passed" && <Chip tone={OK} icon={<Icon name="check" size={12} strokeWidth={2.4} />}>Passed</Chip>}
            {kind === "missed" && <Chip tone={GOLD}>{gap != null && gap > 0 ? `${gap} ${gap === 1 ? "point" : "points"} to go` : "Not passed yet"}</Chip>}
            {passMark != null && kind !== "baseline" && <Chip tone={NEUTRAL}>Pass mark {passMark}%</Chip>}
          </div>
          {kind === "missed" && weakTopics.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              {weakTopics.slice(0, 3).map((t) => <span key={t} className="rounded-md bg-[var(--gold-soft)] px-2 py-0.5 text-[11.5px] font-bold" style={{ color: GOLD.ink }}>{t}</span>)}
              {weakTopics.length > 3 && <span className="text-[11.5px] font-bold text-[var(--ink-3)]">+{weakTopics.length - 3} more</span>}
            </div>
          )}
          {(actions || (kind === "missed" && onReviewTopics && weakTopics.length > 0)) && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {kind === "missed" && onReviewTopics && weakTopics.length > 0 && (
                <button type="button" onClick={onReviewTopics} data-testid="hub-review-topics"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-[13px] font-extrabold text-[var(--ink)] shadow-[var(--shadow-sm)] transition-[filter,transform] hover:brightness-95 active:scale-[.98] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline"
                  style={{ background: "var(--gold)" }}>
                  Review these {weakTopics.length} {weakTopics.length === 1 ? "topic" : "topics"}
                  <Icon name="chevronDown" size={16} strokeWidth={2.4} />
                </button>
              )}
              {actions}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

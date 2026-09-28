"use client";

import type { CSSProperties, ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { glyphFor } from "../../subjectArt";
import { subjectColor, tint } from "../../kit";
import { SUBJECT_ICONS, SUBJECT_STEPS, mockProgress } from "./subjectVisuals";

// The lesson-introduction card: ONE master layout (two columns — the objective in plain text on the left, a small
// "this continues digitally" dashboard mock on the right), whose content and per-subject flavour come entirely from
// `lesson`. Replaces the plain "Outcome" slide re-skin: same detection (slideTheme.ts's `outcomeSlide`), a richer card.
//
// What's real vs decorative: subject / title / unit / objective / ageGroup / keyConcepts are the ACTUAL lesson's own
// data (never invented). The dashboard's little "72%"-style progress number and its checklist ticks are illustrative
// chrome — like the reference mock — never a real stat; `mockProgress` only keeps that number stable per lesson
// instead of jittering on every render.
//
// What this deliberately does NOT attempt: a bespoke illustrated "teacher + child" scene per subject. That's real
// illustration asset work — faking it with generic blob/circle "people" would look worse than not having it. Instead
// the visual panel leans on this app's own flat/line icon language (subjectArt.tsx's `SubjectGlyph`, and the small
// per-subject icon trio in `subjectVisuals.ts`), the same way every other slide re-skin in this file stays iconography,
// not illustration.

export interface LessonIntroData {
  subject: string;
  title: string;
  unit?: string;
  /** The pupil-facing "I can …" statement (slideTheme.ts's `outcomeSlide` extracts this from the raw deck). */
  objective: string;
  /** e.g. "Year 4" / "KS2" — whatever the lesson already carries; shown as a small chip, omitted if unknown. */
  ageGroup?: string;
  /** A short topic tag, distinct from the unit line (e.g. "Circuits"). Optional — falls back to the unit. */
  topic?: string;
  /** The lesson's own outline / key-learning-point wording (lesson.outline) — feeds the dashboard's checklist AND
   *  the floating chips, so both are this lesson's real content, not generic subject filler. */
  keyConcepts?: string[];
}

const glyphOf = (subject: string) => glyphFor(subject || "");

/** The objective paragraph's own classes — exported so a tutor-edit caller (CanvasSlide.tsx) can render an inline-editable
 *  element in its place that looks identical to the plain display version. */
export const OBJECTIVE_CLASS = "m-0 max-w-[34cqw] text-[2.1cqw] font-semibold leading-snug text-[color:var(--sb-ink2,#4a4763)]";

/** A small single-stroke icon from the subject's trio, cycling so any index works. */
function SubjectObjectIcon({ subject, index, size = 18, className = "" }: { subject: string; index: number; size?: number; className?: string }) {
  const set = SUBJECT_ICONS[glyphOf(subject)];
  const path = set[index % set.length];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {path}
    </svg>
  );
}

/** A tiny browser-chrome frame with lesson-specific mini-content: this lesson "continuing digitally". */
function DashboardMock({ lesson, accent }: { lesson: LessonIntroData; accent: string }) {
  const t = useT();
  const steps = SUBJECT_STEPS[glyphOf(lesson.subject)].map((k) => t(k));
  const concepts = (lesson.keyConcepts ?? []).filter(Boolean).slice(0, 4);
  const rows = concepts.length ? concepts : steps;
  const pct = mockProgress(lesson.title || lesson.subject || "lesson");
  return (
    <div className="relative w-full max-w-[280px] rounded-2xl bg-white shadow-[0_12px_32px_rgba(15,23,42,.22)]" style={{ border: "1px solid rgba(15,23,42,.06)" }}>
      <div className="flex items-center gap-1.5 rounded-t-2xl px-3 py-2" style={{ background: "#F1F3F9" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: "#F0554C" }} />
        <span className="h-2 w-2 rounded-full" style={{ background: "#F4B740" }} />
        <span className="h-2 w-2 rounded-full" style={{ background: "#38B26A" }} />
        <span className="ms-2 truncate text-[9.5px] font-bold text-[#8890A6]">{lesson.topic || lesson.unit || lesson.subject}</span>
      </div>
      <div className="space-y-2.5 px-3.5 py-3">
        <p className="m-0 truncate text-[11.5px] font-extrabold leading-tight text-[#1B2140]">{lesson.title}</p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "#EAEDF5" }}>
            <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
          </div>
          <span className="flex-none text-[9.5px] font-extrabold" style={{ color: accent }}>{pct}%</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((r, i) => (
            <li key={r} className="flex items-center gap-1.5 text-[9.5px] font-bold text-[#4A5170]">
              <span className="grid h-4 w-4 flex-none place-items-center rounded-full text-white" style={{ background: i === 0 ? accent : "#D7DCEA" }}>
                <SubjectObjectIcon subject={lesson.subject} index={i} size={9} />
              </span>
              <span className="truncate">{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A small chip floating near the dashboard, carrying one real bit of the lesson's own content (a key concept), or a
 *  subject-flavoured filler word when the lesson has none to show. */
function FloatingChip({ label, subject, index, style }: { label: string; subject: string; index: number; style: CSSProperties }) {
  const c = subjectColor(subject);
  return (
    <div className="absolute flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold shadow-[0_6px_16px_rgba(15,23,42,.18)]" style={{ background: "#fff", color: c, ...style }}>
      <SubjectObjectIcon subject={subject} index={index} size={12} />
      <span className="max-w-[84px] truncate">{label}</span>
    </div>
  );
}

/** The soft glowing curved trail suggesting the lesson "continues" from the chips into the dashboard. Decorative;
 *  a `prefers-reduced-motion` viewer just sees it sit still. */
function GlowTrail({ accent }: { accent: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 240" className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="lic-trail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0" />
          <stop offset="100%" stopColor={accent} stopOpacity=".55" />
        </linearGradient>
      </defs>
      <path d="M40 40 C 120 10, 160 90, 250 120" fill="none" stroke="url(#lic-trail)" strokeWidth="2.5" strokeDasharray="1 9" strokeLinecap="round" />
      <circle r="3.5" fill={accent}>
        <animateMotion dur="3.4s" repeatCount="indefinite" path="M40 40 C 120 10, 160 90, 250 120" />
      </circle>
    </svg>
  );
}

export function LessonIntroCard({ lesson, objectiveEditable }: {
  lesson: LessonIntroData;
  /** Tutor edit only: an inline-editable element (built by CanvasSlide.tsx, reusing its own contentEditable/onCommit
   *  mechanism) rendered in place of the plain objective paragraph, styled identically (OBJECTIVE_CLASS). Undefined
   *  in the real student view, which keeps rendering the plain, non-editable paragraph exactly as before. */
  objectiveEditable?: ReactNode;
}) {
  const t = useT();
  const accent = subjectColor(lesson.subject || "");
  const concepts = (lesson.keyConcepts ?? []).filter(Boolean);
  const chipWords = concepts.length ? concepts.slice(0, 2) : SUBJECT_STEPS[glyphOf(lesson.subject)].slice(0, 2).map((k) => t(k));

  return (
    <div data-testid="lesson-intro-card" className="flex h-full w-full flex-col overflow-hidden rounded-[1.6cqw] bg-white md:flex-row" style={{ fontFamily: "var(--ff-display), var(--ff), system-ui, sans-serif" }}>
      {/* LEFT — the lesson's own words, plainly. */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[1.4cqw] px-[5cqw] py-[4cqw]">
        <div className="flex flex-wrap items-center gap-[1cqw]">
          <span className="text-[2.4cqw] font-extrabold uppercase tracking-[0.08em]" style={{ color: accent }}>{lesson.subject || t("hublessons.stepLesson")}</span>
          {lesson.ageGroup && <span className="rounded-full px-[1.4cqw] py-[.3cqw] text-[1.8cqw] font-bold" style={{ background: tint(accent, 14), color: accent }}>{lesson.ageGroup}</span>}
        </div>
        <h2 className="m-0 text-[4.4cqw] font-extrabold leading-[1.08]" style={{ color: "var(--sb-ink, #171534)" }}>{lesson.title}</h2>
        {(lesson.unit || lesson.topic) && <p className="m-0 text-[2.2cqw] font-bold text-[color:var(--sb-ink2,#4a4763)]">{t("hublessons.liUnit", { unit: lesson.topic || lesson.unit || "" })}</p>}
        {objectiveEditable ?? <p className={OBJECTIVE_CLASS}>{lesson.objective}</p>}
      </div>

      {/* RIGHT — this app's own sidebar blue (var(--side-bg), the exact colour/pattern the sidebar itself uses —
          never a guessed/generic blue), carrying the dashboard mock + floating chips + glow trail. */}
      <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden px-[3cqw] py-[3cqw]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1px, transparent 1.6px), var(--side-bg)", backgroundSize: "18px 18px, cover" }}>
        <GlowTrail accent="#ffffff" />
        <FloatingChip label={chipWords[0] ?? lesson.subject} subject={lesson.subject} index={0} style={{ top: "10%", left: "8%", transform: "rotate(-4deg)" }} />
        {chipWords[1] && <FloatingChip label={chipWords[1]} subject={lesson.subject} index={1} style={{ bottom: "14%", left: "4%", transform: "rotate(3deg)" }} />}
        <DashboardMock lesson={lesson} accent={accent} />
      </div>
    </div>
  );
}

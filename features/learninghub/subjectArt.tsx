"use client";

import type { ReactNode } from "react";
import { subjectColor, tint } from "./kit";

// Deterministic "cover art" for a subject — a gradient in the subject's colour
// with a large, faded line-glyph — so quiz / note / lesson / roster cards get
// instant recognition and a consistent look with no image assets. The glyph is
// picked from the subject NAME by keyword (tenant-typed subjects are free text),
// falling back to a neutral star. Decorative: always aria-hidden.

type Glyph = "maths" | "words" | "science" | "world" | "art" | "music" | "code" | "star";

const RULES: [RegExp, Glyph][] = [
  [/math|algebra|geometry|arithmetic|number|calc|statistic/i, "maths"],
  [/english|literacy|reading|writing|grammar|spelling|phonic|french|spanish|german|language|latin/i, "words"],
  [/science|biolog|chemi|physic|nature/i, "science"],
  [/histor|geograph|humanit|religio|citizen|social|world/i, "world"],
  [/art|design|draw|drama/i, "art"],
  [/music|piano|guitar|violin|sing/i, "music"],
  [/comput|code|coding|program|ict|tech/i, "code"],
];
export const glyphFor = (subject: string): Glyph => RULES.find(([re]) => re.test(subject))?.[1] ?? "star";

const P: Record<Glyph, ReactNode> = {
  maths: <><path d="M10 34h28M24 20v28" /><path d="M42 50l12-12M42 38l12 12" /></>,
  words: <><path d="M12 48V16l20 8 20-8v32l-20-8-20 8z" /><path d="M32 24v24" /></>,
  science: <><path d="M26 12h12M29 12v14L16 50a4 4 0 003.5 6h25A4 4 0 0048 50L35 26V12" /><path d="M22 42h20" /></>,
  world: <><circle cx="32" cy="32" r="20" /><path d="M12 32h40M32 12c8 8 8 32 0 40M32 12c-8 8-8 32 0 40" /></>,
  art: <><path d="M32 12a20 20 0 100 40c4 0 5-3 3-6s0-6 5-6h5a6 6 0 006-6c0-13-9-22-19-22z" /><circle cx="22" cy="28" r="2" /><circle cx="30" cy="20" r="2" /><circle cx="42" cy="22" r="2" /></>,
  music: <><path d="M26 46V16l22-6v30" /><circle cx="20" cy="46" r="6" /><circle cx="42" cy="40" r="6" /></>,
  code: <><path d="M22 20L10 32l12 12M42 20l12 12-12 12M36 14L28 50" /></>,
  star: <path d="M32 10l6.5 14 15.5 2-11.5 10.5L45.5 52 32 44l-13.5 8 3.5-15.5L10.5 26l15.5-2z" />,
};

/** The bare line-glyph (currentColor), e.g. for a small icon next to a subject name. */
export function SubjectGlyph({ subject, size = 20, className = "" }: { subject: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {P[glyphFor(subject)]}
    </svg>
  );
}

/** A gradient cover: use as a card header band (`height` e.g. 56–96) or, with a
 *  square `height`/`width`, as an icon tile. */
export function SubjectCover({ subject, height = 72, width, rounded = "rounded-xl", children, className = "", artRight }: {
  subject: string; height?: number; width?: number | string; rounded?: string; children?: ReactNode; className?: string;
  /** Where the watermark glyph sits, from the right edge. Set it when the cover carries action buttons so the art never prints over them. */
  artRight?: number | string;
}) {
  const c = subjectColor(subject);
  return (
    <div data-subject-cover={subject} className={`relative flex-none overflow-hidden ${rounded} ${className}`} style={{ height, width: width ?? "100%", background: `linear-gradient(135deg, ${tint(c, 30)} 0%, ${tint(c, 12)} 100%)`, color: c }}>
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        className={`pointer-events-none absolute -bottom-3 opacity-25 ${artRight == null ? "-right-2" : ""}`} style={{ height: Math.max(height * 1.25, 72), width: Math.max(height * 1.25, 72), ...(artRight != null ? { right: artRight } : null) }}>
        {P[glyphFor(subject)]}
      </svg>
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}

/** A small rounded icon tile: the subject's gradient with its line-glyph in
 *  full colour — for sidebar rows, chips and group headers. */
export function SubjectTile({ subject, size = 28, className = "" }: { subject: string; size?: number; className?: string }) {
  const c = subjectColor(subject);
  return (
    <span data-subject-tile={subject} className={`grid flex-none place-items-center ${className}`} aria-hidden="true"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), background: `linear-gradient(135deg, ${tint(c, 30)} 0%, ${tint(c, 14)} 100%)`, color: c, boxShadow: `inset 0 0 0 1px ${tint(c, 22)}` }}>
      <SubjectGlyph subject={subject} size={Math.round(size * 0.62)} />
    </span>
  );
}

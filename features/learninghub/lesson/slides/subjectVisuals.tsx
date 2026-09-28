import type { ReactNode } from "react";
import { glyphFor } from "../../subjectArt";

// Per-subject visual vocabulary for LessonIntroCard.tsx — extensible in ONE place (add a Glyph key's entry here,
// nothing in the component itself changes). Keyed by the same subject→glyph detection subjectArt.tsx already uses
// (`glyphFor`), so "Maths"/"maths"/"Multiplication" etc. all resolve the same way everywhere in the hub.
//
// Deliberately NOT bespoke illustration (a real illustrated teacher-and-child scene per subject is genuine art
// asset work, out of scope for code) — these are small single-stroke line icons in this app's own icon language
// (mirrors subjectArt.tsx's glyphs: viewBox 0 0 24 24, stroke="currentColor", no fill), used as floating chips and
// inside the "digital dashboard" mock, plus a short checklist wording a lesson on that subject actually steps through.

export type Glyph = ReturnType<typeof glyphFor>;

const icon = (paths: ReactNode): ReactNode => paths;

/** 3 small topic-flavoured objects per subject (chips + dashboard bullets draw from these, cycling if more are needed). */
export const SUBJECT_ICONS: Record<Glyph, ReactNode[]> = {
  maths: [
    icon(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 9h8M8 13h8M8 17h4" /></>), // number tile
    icon(<><path d="M12 5v14M5 12h14" /></>), // plus
    icon(<><rect x="3" y="9" width="6" height="6" /><rect x="9" y="9" width="6" height="6" /><rect x="15" y="9" width="6" height="6" /></>), // counting blocks
  ],
  words: [
    icon(<><path d="M4 5.5C6 4.5 9 4 12 5.5V19c-3-1.5-6-1-8 0V5.5z" /><path d="M20 5.5c-2-1-5-1.5-8 0V19c3-1.5 6-1 8 0V5.5z" /></>), // open book
    icon(<><text x="12" y="17" textAnchor="middle" fontSize="15" fontFamily="serif" stroke="none" fill="currentColor">Aa</text></>), // letter
    icon(<><path d="M4 5h16v10H9l-4 4V5z" /></>), // speech bubble
  ],
  science: [
    icon(<><path d="M17 4c-6 1-11 5-11 11a5 5 0 005 5c6 0 10-5 11-11-1.5.5-3 .5-5-1-1-1-1-3 0-4z" /></>), // leaf
    icon(<><circle cx="10" cy="10" r="6" /><path d="M14.5 14.5L20 20" /></>), // magnifier
    icon(<><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="9" ry="3.5" /><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" /></>), // atom
  ],
  world: [
    icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>), // globe
    icon(<><path d="M6 3v18M6 4h11l-3 3.5L17 11H6" /></>), // flag
    icon(<><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 6-6 2 2-6 6-2z" /></>), // compass
  ],
  art: [
    icon(<><path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.2-2.2-.7-1-.1-2.3 1.3-2.3H16a5 5 0 005-5c0-5-4-8.5-9-8.5z" /><circle cx="8" cy="11" r="1.1" /><circle cx="11" cy="7.5" r="1.1" /><circle cx="15.5" cy="8.5" r="1.1" /></>), // palette
    icon(<><path d="M4 20l3-1 10-10-2-2L5 17l-1 3z" /></>), // paintbrush
    icon(<><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></>), // swatches
  ],
  music: [
    icon(<><path d="M9 17V5l10-2v12" /><circle cx="7" cy="17" r="2.4" /><circle cx="17" cy="15" r="2.4" /></>), // note
    icon(<><path d="M4 10a8 8 0 0116 0v6a2 2 0 01-2 2h-1v-6h3M4 16v-6h3v6H5a1 1 0 01-1-1z" /></>), // headphones
    icon(<><path d="M12 4l5 16H7z" /><path d="M12 8v6" /></>), // metronome
  ],
  code: [
    icon(<><path d="M9 8l-5 4 5 4M15 8l5 4-5 4" /></>), // angle brackets
    icon(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></>), // terminal
    icon(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" /></>), // gear
  ],
  star: [
    icon(<><path d="M12 3l2.2 4.8 5.3.6-4 3.6 1.1 5.2L12 14.7 7.4 17.2l1.1-5.2-4-3.6 5.3-.6z" /></>), // star
    icon(<><path d="M12 4v4M12 16v4M4 12h4M16 12h4" /></>), // sparkle
    icon(<><circle cx="12" cy="12" r="7" /></>), // circle
  ],
};

/** The 4-step "how this lesson goes" wording a dashboard checklist shows, phrased for that subject (i18n KEYS: resolve with t()). */
export const SUBJECT_STEPS: Record<Glyph, [string, string, string, string]> = {
  maths: ["hublessons.stWatch", "hublessons.stPractise", "hublessons.stPlay", "hublessons.quizTag"],
  words: ["hublessons.stListen", "hublessons.stIdentify", "hublessons.stPractise", "hublessons.quizTag"],
  science: ["hublessons.stObserve", "hublessons.explore", "hublessons.stRecord", "hublessons.quizTag"],
  world: ["hublessons.explore", "hublessons.stCompare", "hublessons.stDiscuss", "hublessons.quizTag"],
  art: ["hublessons.stLook", "hublessons.stCreate", "hublessons.stReflect", "hublessons.stShare"],
  music: ["hublessons.stListen", "hublessons.stCopy", "hublessons.stPerform", "hublessons.stReview"],
  code: ["hublessons.stPlan", "hublessons.stBuild", "hublessons.stTest", "hublessons.stDebug"],
  star: ["hublessons.stepLearn", "hublessons.stPractise", "hublessons.stApply", "hublessons.stReview"],
};

/** A short, stable "pretend" percentage for the dashboard mock's progress row — decorative flavour only (never a
 *  real stat), deterministic per lesson so the same lesson always renders the same mock. */
export function mockProgress(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 55 + (h % 40); // 55–94: reads as "part way through", never 0 or 100
}

"use client";

import type { ReactNode } from "react";
import { subjectSwatch } from "../subjectColour";
import { subjectEmoji } from "./subjectEmoji";

// A real-flashcard face: subject-coloured paper (soft gradient + dotted index-card texture), a big display-font line, a faint subject
// emoji watermark, two card edges peeking out behind (a little deck) and a 3D flip to the answer. Under prefers-reduced-motion the
// flip becomes a crossfade. Presentational only — the caller owns `flipped`. Used by the child's review session.

const CSS = `
.kFc3d{transform-style:preserve-3d;transition:transform .55s cubic-bezier(.2,.8,.2,1)}
.kFc3d[data-flipped="true"]{transform:rotateY(180deg)}
.kFcFace{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.kFcBackFace{transform:rotateY(180deg)}
@media (prefers-reduced-motion: reduce){
  .kFc3d{transition:none;transform:none !important}
  .kFcFace{backface-visibility:visible;-webkit-backface-visibility:visible;transition:opacity .2s}
  .kFcBackFace{transform:none;opacity:0;pointer-events:none}
  .kFc3d[data-flipped="true"] .kFcBackFace{opacity:1}
  .kFc3d[data-flipped="true"] .kFcFrontFace{opacity:0}
}`;

export function FlipCard({ front, back, flipped, onFlip, subject, position, badge, big = false, labels, hint, howWell }: {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
  subject: string;
  /** "3 / 12" — shown top-right on both faces. */
  position?: string;
  /** Small pill after the face label (e.g. "New"). */
  badge?: ReactNode;
  /** Young children: bigger type, fewer words. */
  big?: boolean;
  labels: { front: string; back: string; frontAria: string; backAria: string };
  /** Line under the question ("Tap to flip · Space"). */
  hint?: ReactNode;
  /** Line under the answer ("How well did you know it?"). */
  howWell?: string;
}) {
  const sw = subjectSwatch(subject);
  const emoji = subjectEmoji(subject);
  const paper = {
    background: `radial-gradient(color-mix(in srgb, ${sw.base} 26%, transparent) 1px, transparent 1.3px) 0 0 / 15px 15px, linear-gradient(160deg, color-mix(in srgb, ${sw.base} 9%, var(--surface)), color-mix(in srgb, ${sw.base} 24%, var(--surface)))`,
    borderColor: sw.ring,
  } as const;
  const deep = { background: `linear-gradient(155deg, ${sw.base}, color-mix(in srgb, ${sw.base} 68%, var(--ink)))` } as const;
  const face = "kFcFace absolute inset-0 flex flex-col overflow-hidden rounded-[28px] border p-5 sm:p-8";
  const textSize = big ? "text-[28px] sm:text-[36px]" : "text-[22px] sm:text-[28px]";
  return (
    <div className="relative [perspective:1400px]" data-testid="hub-flashcard" data-flipped={flipped}>
      <style>{CSS}</style>
      {/* the little deck behind the card */}
      <span aria-hidden className="absolute inset-x-3 top-2 h-full rounded-[28px] border" style={{ background: `color-mix(in srgb, ${sw.base} 16%, var(--surface))`, borderColor: sw.ring, transform: "rotate(-2.2deg)" }} />
      <span aria-hidden className="absolute inset-x-1.5 top-1 h-full rounded-[28px] border" style={{ background: `color-mix(in srgb, ${sw.base} 26%, var(--surface))`, borderColor: sw.ring, transform: "rotate(1.4deg)" }} />
      <button type="button" onClick={onFlip} data-flipped={flipped} aria-label={flipped ? labels.backAria : labels.frontAria}
        className={`kFc3d relative block h-[300px] w-full rounded-[28px] text-start shadow-[var(--shadow)] sm:h-[360px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]`}>
        <span className={`${face} kFcFrontFace`} style={paper}>
          <span aria-hidden className="pointer-events-none absolute -bottom-3 -end-2 select-none text-[120px] leading-none opacity-[0.13]">{emoji}</span>
          <span className="relative flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: sw.fg }}>
            <span className="h-2 w-2 rounded-full" style={{ background: sw.base }} /> {labels.front} {badge}
            {position && <span className="ms-auto font-bold normal-case tracking-normal text-[var(--ink-3)]">{position}</span>}
          </span>
          <span className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-3 text-center">
            <span className={`whitespace-pre-wrap break-words font-extrabold leading-snug text-[var(--ink)] ${textSize}`} style={{ fontFamily: "var(--ff-display)" }}>{front}</span>
          </span>
          {hint && <span className="relative text-center text-[12px] font-semibold text-[var(--ink-3)]">{hint}</span>}
        </span>
        <span className={`${face} kFcBackFace border-transparent text-white`} style={deep}>
          <span aria-hidden className="pointer-events-none absolute -bottom-3 -end-2 select-none text-[120px] leading-none opacity-[0.16]">{emoji}</span>
          <span className="relative flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <span className="h-2 w-2 rounded-full bg-white" /> {labels.back}
            {position && <span className="ms-auto font-bold normal-case tracking-normal text-white/65">{position}</span>}
          </span>
          <span className="relative flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-3 text-center">
            <span className={`whitespace-pre-wrap break-words font-bold leading-snug ${textSize}`} style={{ fontFamily: "var(--ff-display)" }}>{back}</span>
          </span>
          {howWell && <span className="relative text-center text-[12.5px] font-semibold text-white/80">{howWell}</span>}
        </span>
      </button>
    </div>
  );
}

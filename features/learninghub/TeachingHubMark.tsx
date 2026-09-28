"use client";

import type { CSSProperties, ReactNode } from "react";

// Our own placeholder art — used wherever a lesson has no real picture and used to show generic Oak/stock
// subject art instead (e.g. a stock abacus icon). No product name is baked in as a bitmap: it's a plain SVG
// mark built from the app's own brand variables (var(--brand)/var(--brand-2)/var(--gold)), so it can be
// restyled the moment the product's real name/logo is picked. The optional wordmark is real text, not an
// image, and says "Teaching and Learning Hub" (generic — the product's name is not decided yet).

/** The bare mark: an open book (learning) with a small spark (an "activity"/highlight), flat fills only,
 *  no outlines — same drawing language as server/src/oak/ownArt/kit.ts, but in the app's CSS variables. */
export function TeachingHubGlyph({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" role="img" aria-label="Teaching Hub" className={className} style={style}>
      <defs>
        <linearGradient id="thm-badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-2)" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="16" fill="url(#thm-badge)" />
      {/* open book: two pages meeting at a spine */}
      <path d="M32 22c-4.5-3.6-11-5.4-16.5-4.6v22c5.5-.8 12 1 16.5 4.6 4.5-3.6 11-5.4 16.5-4.6v-22C43 16.6 36.5 18.4 32 22z" fill="#fff" opacity="0.96" />
      <path d="M32 22v22" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <path d="M18.5 21.4c3.6-.2 7.4.7 10 2.4M18.5 27.4c3.6-.2 7.4.7 10 2.4M18.5 33.4c3.6-.2 7.4.7 10 2.4" stroke="var(--brand)" strokeWidth="1.4" strokeLinecap="round" opacity="0.28" />
      <path d="M45.5 21.4c-3.6-.2-7.4.7-10 2.4M45.5 27.4c-3.6-.2-7.4.7-10 2.4M45.5 33.4c-3.6-.2-7.4.7-10 2.4" stroke="var(--brand)" strokeWidth="1.4" strokeLinecap="round" opacity="0.28" />
      {/* a small spark of activity/progress */}
      <path d="M47 10.5l1.7 3.8 3.8 1.7-3.8 1.7-1.7 3.8-1.7-3.8-3.8-1.7 3.8-1.7z" fill="var(--gold)" />
    </svg>
  );
}

/** The glyph plus real text ("Teaching Hub"), in the app's own display font — a wordmark/icon
 *  combo for a full-bleed empty state, not for small inline use (use `TeachingHubGlyph` alone for that). */
export function TeachingHubMark({ size = 56, gap = 10, direction = "column", className = "" }: { size?: number; gap?: number; direction?: "row" | "column"; className?: string }): ReactNode {
  return (
    <span className={`inline-flex items-center ${direction === "column" ? "flex-col" : "flex-row"} ${className}`} style={{ gap }}>
      <span style={{ width: size, height: size, flex: "none" }}><TeachingHubGlyph /></span>
      <span className="text-center text-[13px] font-extrabold leading-tight text-[var(--ink-2)]" style={{ fontFamily: "var(--ff-display), var(--ff), sans-serif" }}>
        Teaching<br />Hub
      </span>
    </span>
  );
}

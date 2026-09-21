"use client";

// A little stack of flashcards — the hero's illustration. Pure SVG, white on the
// brand gradient (so it rebrands with the tenant); decorative.
export function StackedCards({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 210 168" fill="none" aria-hidden className={className}>
      <g transform="rotate(-12 105 92)">
        <rect x="42" y="30" width="126" height="92" rx="16" fill="#fff" fillOpacity=".16" stroke="#fff" strokeOpacity=".3" />
      </g>
      <g transform="rotate(7 105 92)">
        <rect x="44" y="34" width="126" height="92" rx="16" fill="#fff" fillOpacity=".3" stroke="#fff" strokeOpacity=".45" />
      </g>
      <g>
        <rect x="40" y="38" width="130" height="96" rx="18" fill="#fff" />
        <rect x="40" y="38" width="130" height="96" rx="18" stroke="var(--brand-line)" />
        <circle cx="62" cy="58" r="5" fill="var(--brand-2)" />
        <rect x="74" y="54" width="46" height="8" rx="4" fill="var(--brand-line)" />
        <rect x="58" y="78" width="94" height="9" rx="4.5" fill="var(--brand)" fillOpacity=".85" />
        <rect x="58" y="94" width="66" height="9" rx="4.5" fill="var(--brand)" fillOpacity=".35" />
        <path d="M140 112l6 6 12-14" stroke="var(--green)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="M178 26l2.4 6.6L187 35l-6.6 2.4L178 44l-2.4-6.6L169 35l6.6-2.4z" fill="#fff" fillOpacity=".85" />
      <path d="M30 118l1.6 4.4L36 124l-4.4 1.6L30 130l-1.6-4.4L24 124l4.4-1.6z" fill="#fff" fillOpacity=".6" />
    </svg>
  );
}

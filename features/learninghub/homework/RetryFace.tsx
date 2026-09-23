"use client";

import { FOCUS } from "../teachKit";

// A failed load is never the empty state ("No homework") because that reads as "nothing to do". One friendly
// face and one big Try again button (56px, thumb-sized), for children and grown-ups alike.

export function RetryFace({ what, kid, onRetry, id }: { what: string; kid: boolean; onRetry: () => void; id?: string }) {
  return (
    <div id={id} role="alert" data-testid="hub-load-failed" className="grid justify-items-center gap-3 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-5 py-8 text-center shadow-[var(--shadow-sm)]">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden focusable="false">
        <circle cx="32" cy="32" r="29" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="3" />
        <circle cx="22" cy="26" r="3.5" fill="var(--ink)" />
        <circle cx="42" cy="26" r="3.5" fill="var(--ink)" />
        <path d="M21 41 Q32 49 43 41" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <p className="m-0 text-[18px] font-extrabold text-[var(--ink)]">{kid ? "Oops! Let's try again." : `We couldn't load ${what} just now.`}</p>
      {!kid && <p className="m-0 text-[13px] text-[var(--ink-2)]">This is a connection hiccup, not an empty list. Nothing has been lost.</p>}
      <button type="button" onClick={onRetry} className={`min-h-[56px] min-w-[160px] rounded-full bg-[var(--brand)] px-7 text-[17px] font-extrabold text-white ${FOCUS}`}>Try again</button>
    </div>
  );
}

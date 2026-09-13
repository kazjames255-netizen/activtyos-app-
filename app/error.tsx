"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Any page that throws while rendering lands here instead of a white screen.
// Next 16 hands the boundary `unstable_retry` (re-fetch + re-render the segment).
export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line,#e6ebf2)] bg-[var(--surface,#fff)] p-7 text-center shadow-sm">
        <div className="text-[38px]">⚠️</div>
        <h1 className="mt-2 text-[20px] font-extrabold text-[var(--ink,#171534)]" style={{ fontFamily: "var(--ff-display)" }}>
          This page hit a problem
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-3,#5b6472)]">
          Nothing you entered has been lost by this. Try again — if it keeps happening, tell us what you were doing
          {error.digest ? <> and quote <b>{error.digest}</b></> : null}.
        </p>
        <button type="button" onClick={() => unstable_retry()} className="mt-5 rounded-full bg-[#1d3a8f] px-5 py-2.5 text-[13px] font-bold text-white">
          Try again
        </button>
      </div>
    </main>
  );
}

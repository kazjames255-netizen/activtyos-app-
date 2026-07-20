"use client";

import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────
// The "how it works" panel that heads Listings, Sessions & blocks, Bookings
// and Families.
//
// Collapsed by default and identical on all four: useful the first week, in
// the way every week after. Text on the left, a walkthrough video beside it —
// most people would rather watch two minutes than read four paragraphs, so
// the copy here is deliberately short and the video does the explaining.
//
// The video doesn't exist yet. Rather than leave a gap that gets forgotten,
// the slot is drawn with what it's for written in it.
// ─────────────────────────────────────────────────────────────────────────

export function HowItWorks({
  children,
  video,
  minutes,
}: {
  /** Two short paragraphs at most. If it needs more, it needs the video. */
  children: ReactNode;
  /** What the walkthrough covers, so whoever records it knows the brief. */
  video: string;
  minutes?: string;
}) {
  return (
    <details className="group mb-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-bold text-[var(--brand-ink,#1d3a8f)] [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        <span>ℹ️ How it works</span>
        <span className="ml-1 rounded-full bg-[var(--brand-soft,#eaf0fc)] px-2 py-[1px] text-[10px] font-extrabold">
          ▶ video
        </span>
      </summary>

      <div className="grid gap-4 px-3.5 pb-3.5 pl-8 md:grid-cols-[1fr_300px]">
        <div className="max-w-[560px] text-[12.5px] leading-[1.6] text-[var(--ink-3)]">{children}</div>

        {/* Placeholder, and honest about it — a grey box saying "video" gets
            shipped by accident; one naming the thing it should contain does
            not. */}
        <div className="self-start rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] p-3">
          <div
            className="flex items-center justify-center rounded-lg bg-[var(--brand-soft,#eaf0fc)]"
            style={{ aspectRatio: "16 / 9" }}
          >
            <span className="text-[26px]">▶</span>
          </div>
          <div className="mt-2 text-[11.5px] font-extrabold text-[var(--ink-2)]">
            Walkthrough — to record
          </div>
          <div className="mt-0.5 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
            {video}
            {minutes ? ` · aim for ${minutes}` : ""}
          </div>
        </div>
      </div>
    </details>
  );
}

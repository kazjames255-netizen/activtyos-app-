"use client";

import { useFamily } from "./FamilyContext";
import { openLink } from "./link";
import { useT } from "@/lib/i18n/provider";

// WATCH ALONG: a parent opens the lesson their child was given and sees exactly what the child sees, view-only. The lesson player runs in its
// tutor-preview mode (`readOnly`), so nothing is started, answered or saved and the child's marks never change. Reached from the weekly digest
// and homework reminder emails (`&watch=1`, server/src/lib/hubDigest.ts hubLink) and from the "Watch along" button on the parent's Home.
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";

export function WatchAlongBanner() {
  const tr = useT();
  const fam = useFamily();
  const name = firstName(fam.kids.find((k) => k.childId === fam.childId)?.childName ?? "") || tr("hubhow.watchYourChild");
  return (
    <div role="status" data-testid="hub-watchalong-banner" className="mb-3 rounded-2xl border border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eef3ff)] p-3.5">
      <b className="block text-[14px] text-[var(--ink,#0e1f4a)]">{tr("hubhow.watchBannerTitle", { name })}</b>
      <span className="mt-0.5 block text-[13px] leading-snug text-[var(--ink-2,#4a5677)]">{tr("hubhow.watchBannerBody", { name })}</span>
    </div>
  );
}

/** A small "Watch along" link for a parent, next to a homework that has an interactive lesson. */
export function WatchAlongButton({ noteId, className = "" }: { noteId: string; className?: string }) {
  const tr = useT();
  return (
    <button type="button" onClick={() => openLink({ kind: "lesson", id: noteId }, { tab: "notes", watch: true })} data-testid="hub-watchalong"
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-extrabold text-[var(--brand,#1d3a8f)] underline decoration-[1.5px] underline-offset-[3px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#1d3a8f)] ${className}`}>
      <span aria-hidden>👀</span>{tr("hubhow.watchAlong")}
    </button>
  );
}

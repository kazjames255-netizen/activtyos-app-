"use client";

import { Icon, type IconName } from "../kit";
import { display } from "../shared-assess/ui";

// "How placement works" — the three-step story a tutor needs before publishing a
// placement test. A numbered rail joins the steps (horizontal on desktop, vertical
// on a phone); purely explanatory.

const STEPS: { icon: IconName; title: string; body: (lock: boolean) => string }[] = [
  { icon: "quiz", title: "Publish a test per subject", body: () => "Build one placement test from your question bank for each subject, then publish it." },
  { icon: "compass", title: "The student sits it once", body: () => "One go, no pass mark and no pressure. Written answers wait for you in Marking." },
  { icon: "chart", title: "Their starting point is saved", body: (lock) => lock ? "Each topic's baseline is recorded, quizzes in that subject unlock, and Progress shows growth from it." : "Each topic's baseline is recorded, and Progress shows how far they grow from it." },
];

export function PlacementGuide({ requireDiagnostic }: { requireDiagnostic: boolean }) {
  return (
    <section aria-label="How placement works" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5" data-testid="hub-placement-guide">
      <h4 className="m-0 text-[14px] font-extrabold text-[var(--ink)]" style={display}>How placement works</h4>
      <ol className="m-0 mt-4 grid list-none gap-5 p-0 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex gap-3.5 sm:block">
            {i < STEPS.length - 1 && (
              <>
                <span aria-hidden className="absolute left-[19px] top-11 h-[calc(100%-8px)] w-0 border-l-2 border-dashed border-[var(--brand-line)] sm:hidden" />
                <span aria-hidden className="absolute left-12 right-[-8px] top-[19px] hidden border-t-2 border-dashed border-[var(--brand-line)] sm:block" />
              </>
            )}
            <span className="relative z-[1] grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)] ring-4 ring-[var(--surface)]" aria-hidden><Icon name={s.icon} size={19} strokeWidth={1.8} /></span>
            <div className="min-w-0 sm:mt-3">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">Step {i + 1}</div>
              <div className="mt-0.5 text-[14px] font-extrabold leading-snug text-[var(--ink)]" style={display}>{s.title}</div>
              <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{s.body(requireDiagnostic)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

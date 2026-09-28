"use client";

import { useT } from "@/lib/i18n/provider";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { FOCUS, Icon } from "../kit";
import type { LessonPlan, PlanStep } from "./plan";

// The lesson PLAN, twice: `LessonPlanSection` is the tutor's numbered, collapsible, printable step-by-step plan (with the common
// mistakes and tips), `PlanRecap` is the same steps written for the child ("Recap: step by step" on the Done step).
// (Oak's raw video script is not shown anywhere any more.)

const KIND_KEY: Record<PlanStep["kind"], string> = { warmup: "hublessons.kindWarmup", teach: "hublessons.kindTeach", guided: "hublessons.kindGuided", independent: "hublessons.kindIndependent", plenary: "hublessons.kindPlenary" };

const Label = ({ children }: { children: React.ReactNode }) => <p className="m-0 mb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{children}</p>;

function StepBody({ s }: { s: PlanStep }) {
  const t = useT();
  return (
    <div className="space-y-3 pb-1 ps-[42px] pe-1 text-[14px] leading-[1.6] text-[var(--ink)]">
      {s.doThis.length > 0 && <ul className="m-0 list-disc space-y-1 ps-5">{s.doThis.map((d, i) => <li key={i}>{d}</li>)}</ul>}
      {s.say && <div><Label>{t("hublessons.planReadAloud")}</Label><blockquote className="m-0 rounded-e-xl border-s-4 border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-[14px] font-semibold">{s.say}</blockquote></div>}
      {s.keyIdeas && s.keyIdeas.length > 0 && <div><Label>{t("hublessons.planKeyIdeas")}</Label><ul className="m-0 list-disc space-y-1 ps-5">{s.keyIdeas.map((k, i) => <li key={i}>{k}</li>)}</ul></div>}
      {s.keywords && s.keywords.length > 0 && (
        <div><Label>{t("hublessons.keyWordsTag")}</Label>
          <ul className="m-0 list-none space-y-1 p-0">{s.keywords.map((k) => <li key={k.term}><b>{k.term}</b>{k.meaning ? <span className="text-[var(--ink-2)]"> — {k.meaning}</span> : null}</li>)}</ul>
        </div>
      )}
      {s.examples && s.examples.length > 0 && <div><Label>{t("hublessons.planWorkedExamples")}</Label><ul className="m-0 list-disc space-y-1 ps-5">{s.examples.map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
      {s.checkFor && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
          <Label>{t("hublessons.planQuickCheck")}</Label>
          <p className="m-0"><b>{t("hublessons.planAsk")}</b> {s.checkFor.ask}</p>
          {s.checkFor.lookFor && <p className="m-0 mt-1 text-[var(--ink-2)]"><b className="text-[var(--ink)]">{t("hublessons.planLookFor")}</b> {s.checkFor.lookFor}</p>}
        </div>
      )}
    </div>
  );
}

export function LessonPlanSection({ plan }: { plan: LessonPlan }) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const [allOpen, setAllOpen] = useState(false);
  // Printing: every step opens (a closed <details> would print as its title only), then goes back to how it was.
  useEffect(() => {
    let saved: boolean[] = [];
    const before = () => { const ds = root.current?.querySelectorAll("details") ?? []; saved = [...ds].map((d) => d.open); ds.forEach((d) => { d.open = true; }); };
    const after = () => { const ds = root.current?.querySelectorAll("details") ?? []; ds.forEach((d, i) => { d.open = saved[i] ?? false; }); };
    window.addEventListener("beforeprint", before); window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);
  const toggleAll = () => { const next = !allOpen; root.current?.querySelectorAll("details.plan-step").forEach((d) => { (d as HTMLDetailsElement).open = next; }); setAllOpen(next); };
  const total = plan.steps.reduce((a, s) => a + (s.minutes ?? 0), 0);

  return (
    <section aria-labelledby="hub-lesson-plan" className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5" data-testid="lesson-plan" ref={root}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="hub-lesson-plan" className="m-0 flex items-center gap-2 text-[15px] font-extrabold text-[var(--ink)]"><Icon name="notes" size={16} /> {t("hublessons.lessonPlan")}</h3>
          <p className="m-0 mt-1 text-[12.5px] text-[var(--ink-2)]">{total ? t("hublessons.planSummaryTimed", { n: plan.steps.length, m: total }) : t("hublessons.planSummary", { n: plan.steps.length })}</p>
        </div>
        <Button onClick={toggleAll} className="hub-no-print !h-[40px]" data-testid="lesson-plan-toggle">{allOpen ? t("hublessons.collapseAll") : t("hublessons.expandAll")}</Button>
      </div>

      <ol className="m-0 mt-4 list-none space-y-2 p-0">
        {plan.steps.map((s, i) => (
          <li key={i} data-testid="plan-step">
            <details className="plan-step group rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5" open={i === 0}>
              <summary className={`flex cursor-pointer list-none items-center gap-3 rounded-lg ${FOCUS}`}>
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[13px] font-black text-white" aria-hidden="true">{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-extrabold leading-snug text-[var(--ink)]"><span className="sr-only">{t("hublessons.srStepN", { n: i + 1 })} </span>{s.title}</span>
                  <span className="block text-[12px] font-semibold text-[var(--ink-2)]">{t(KIND_KEY[s.kind])}{s.minutes ? ` · ${t("hublessons.aboutMin", { m: s.minutes })}` : ""}</span></span>
                <span className="hub-no-print text-[var(--ink-3)] transition group-open:rotate-90" aria-hidden="true">›</span>
              </summary>
              <div className="mt-3"><StepBody s={s} /></div>
            </details>
          </li>
        ))}
      </ol>

      {plan.commonMistakes.length > 0 && (
        <div className="mt-5" data-testid="plan-mistakes">
          <h4 className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hublessons.commonMistakes")}</h4>
          <ul className="m-0 list-none space-y-2 p-0">
            {plan.commonMistakes.map((m, i) => (
              <li key={i} className="rounded-e-xl border-s-4 border-[var(--red)] bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] leading-[1.55]" style={{ color: "color-mix(in srgb, var(--red) 55%, #000)" }}>
                <b>{t("hublessons.mistakeStudentsWrong")}</b> {m.mistake}{m.fix ? <><br /><b>{t("hublessons.mistakeHowToHelp")}</b> {m.fix}</> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.watchOut.length > 0 && (
        <div className="mt-5" data-testid="plan-watchout">
          <h4 className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hublessons.watchOut")}</h4>
          <ul className="m-0 list-none space-y-2 p-0">
            {plan.watchOut.map((w, i) => <li key={i} className="rounded-e-xl border-s-4 border-[var(--gold)] bg-[var(--gold-soft)] px-3.5 py-2.5 text-[13.5px] leading-[1.55] text-[var(--ink)]">{w}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The child's "Recap: step by step" (Done step): the same steps, in the short friendly wording. */
export function PlanRecap({ plan }: { plan: LessonPlan }) {
  const t = useT();
  return (
    <section className="mt-6 text-start" aria-labelledby="lesson-recap-h" data-testid="lesson-recap">
      <h2 id="lesson-recap-h" className="m-0 mb-2 text-[16px] font-extrabold text-[var(--ink)]">{t("hublessons.recapStepByStep")}</h2>
      <ol className="m-0 list-none space-y-2 p-0">
        {plan.steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5" data-testid="recap-step">
            <span className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-black text-[var(--brand)]" aria-hidden="true">{i + 1}</span>
            <div className="min-w-0 text-[14px] leading-[1.55] text-[var(--ink)]">
              <p className="m-0 font-extrabold"><span className="sr-only">{t("hublessons.srStepN", { n: i + 1 })} </span>{s.title}</p>
              {s.recap.map((r, j) => <p key={j} className="m-0 mt-0.5 text-[var(--ink-2)]">{r}</p>)}
              {s.keywords && s.keywords.length > 0 && <p className="m-0 mt-1.5 flex flex-wrap gap-1.5">{s.keywords.map((k) => <span key={k.term} className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[12px] font-extrabold text-[var(--brand)]">{k.term}</span>)}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

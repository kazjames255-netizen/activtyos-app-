"use client";

import { RetryFace } from "../homework/RetryFace";
import type { KidBand } from "../family/kidCopy";
import { DISPLAY, FOCUS, Icon, type IconName } from "./homeKit";

// A child's Home (P-03): ONE big next-step card, at most six words, one "Go" button. No streak, level, stats or
// animation. KS1 (Reception to Year 2) sees nothing under the card; KS2 a few short rows; older children a plain
// "due this week" list. Wording comes from the caller so it can stay kind (P-13) or plain for Year 10+.

export type KidStep = { icon: IconName; text: string; to: "live" | "homework" | "flashcards" | "quizzes" | "diagnostic" | "home" };
export interface KidRow { key: string; icon: IconName; title: string; note?: string; to: KidStep["to"] }

export function KidHome({ name, band, step, rows, failedHomework, onRetry, go }: {
  name: string; band: KidBand; step: KidStep | null; rows: KidRow[]; failedHomework: boolean; onRetry: () => void; go: (k: KidStep["to"]) => void;
}) {
  const list = band === "ks1" ? [] : band === "ks2" ? rows.slice(0, 4) : rows.slice(0, 6);
  return (
    <div id="hub-home-kid" data-testid="hub-home-kid" data-band={band} className="mx-auto grid w-full max-w-[720px] gap-4">
      <h2 className="m-0 text-[22px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Hi {name}!</h2>
      {failedHomework ? (
        <RetryFace what="your homework" kid onRetry={onRetry} />
      ) : (
        <section aria-label="What to do next" data-testid="hub-kid-next" data-ui="card" className="flex min-h-[96px] flex-wrap items-center gap-4 rounded-3xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-5 shadow-[var(--shadow-sm)]">
          <span aria-hidden className="grid h-[72px] w-[72px] flex-none place-items-center rounded-3xl bg-[var(--surface)] text-[var(--brand)]"><Icon name={step?.icon ?? "check"} size={38} strokeWidth={2.2} /></span>
          <p className="m-0 min-w-0 flex-1 basis-[180px] text-[26px] font-extrabold leading-tight text-[var(--ink)]" style={DISPLAY}>{step?.text ?? "All done. Well done!"}</p>
          {step && (
            <button type="button" onClick={() => go(step.to)} data-testid="hub-kid-go" aria-label={`Go: ${step.text}`}
              className={`inline-flex min-h-[56px] min-w-[110px] items-center justify-center rounded-full bg-[var(--brand)] px-8 text-[20px] font-extrabold text-white ${FOCUS}`}>Go</button>
          )}
        </section>
      )}
      {list.length > 0 && !failedHomework && (
        <section aria-label={band === "ks2" ? "More to do" : "Due this week"} className="grid gap-2">
          {band !== "ks2" && <h3 className="m-0 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Due this week</h3>}
          {list.map((r) => (
            <button key={r.key} type="button" onClick={() => go(r.to)} className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-left ${FOCUS}`}>
              <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--panel)] text-[var(--brand)]"><Icon name={r.icon} size={20} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-extrabold text-[var(--ink)]">{r.title}</span>{r.note && <span className="block truncate text-[12.5px] font-semibold text-[var(--ink-2)]">{r.note}</span>}</span>
              <Icon name="chevronRight" size={16} className="flex-none text-[var(--ink-3)]" />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

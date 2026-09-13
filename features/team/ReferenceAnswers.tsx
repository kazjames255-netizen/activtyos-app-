"use client";

// The reference question controls, shared by the referee's public form and the
// operator's "taken by phone" modal — plus the read-back used on the onboarding
// record. One renderer, so a phoned reference and an emailed one can't drift
// apart in what they captured.
//
// The question set is always PASSED IN, never imported: each request carries a
// snapshot of the questions it was sent under, so a reference answered before
// the provider edited their form still reads back exactly as it was asked.
import { Input } from "@/components/ui";
import {
  detailsKey,
  needsDetails,
  type RefQuestion,
  type RefSection,
} from "./referenceQuestions";

const ACCENT = "#b45309";

/** A row of pill options — every multiple-choice question, from rating scales to
 *  the safeguarding yes/nos, so the whole form is tappable on a phone rather
 *  than a column of dropdowns. */
function Pills({ q, value, onPick }: { q: RefQuestion; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(q.options ?? []).map((o) => {
        const on = value === o;
        // An answer the provider marked as a safeguarding concern turns red on
        // purpose — the referee should be in no doubt they've said something
        // significant.
        const hot = (q.concernOptions ?? []).includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(on ? "" : o)}
            className={"rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors " + (on
              ? "border-transparent text-white"
              : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:border-[#b45309]")}
            style={on ? { background: hot ? "#c0392b" : ACCENT } : undefined}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

const textareaCls = "w-full rounded-lg border border-[var(--line)] bg-white px-2.5 py-2 text-[13px] leading-snug text-[var(--ink)] outline-none focus:border-[#b45309]";

export function QuestionField({ q, answers, set }: { q: RefQuestion; answers: Record<string, string>; set: (id: string, v: string) => void }) {
  const v = answers[q.id] ?? "";
  const wide = q.kind === "long" || q.kind === "choice";
  const details = needsDetails(q, answers);
  return (
    <div className={"rounded-xl border border-[var(--line)] bg-[#fffdfa] p-3 " + (wide ? "sm:col-span-2" : "")}>
      <label className="mb-1.5 block text-[12.5px] font-bold leading-snug text-[var(--ink-2)]">
        {q.label}
        {q.required && <span className="ml-1 text-[#c0392b]">*</span>}
      </label>
      {q.kind === "choice" ? (
        <Pills q={q} value={v} onPick={(x) => set(q.id, x)} />
      ) : q.kind === "long" ? (
        <textarea value={v} onChange={(e) => set(q.id, e.target.value)} rows={3} className={textareaCls} />
      ) : q.kind === "month" ? (
        <Input type="month" value={v} onChange={(e) => set(q.id, e.target.value)} className="w-full bg-white" />
      ) : (
        <Input value={v} onChange={(e) => set(q.id, e.target.value)} className="w-full bg-white" />
      )}
      {q.hint && <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--ink-3)]">{q.hint}</p>}
      {details && (
        <div className="mt-2">
          <label className="mb-1 block text-[11.5px] font-bold text-[#a32020]">
            {q.detailsLabel || "Please give details"} <span className="text-[#c0392b]">*</span>
          </label>
          <textarea
            value={answers[detailsKey(q.id)] ?? ""}
            onChange={(e) => set(detailsKey(q.id), e.target.value)}
            rows={3}
            className={textareaCls}
          />
        </div>
      )}
    </div>
  );
}

export function SectionCard({ section, answers, set }: { section: RefSection; answers: Record<string, string>; set: (id: string, v: string) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-[var(--line)] bg-[#fdf3e0] px-4 py-3">
        <span className="text-[20px] leading-none">{section.icon}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold text-[#8a4b09]">{section.title}</h2>
          {section.blurb && <p className="mt-0.5 text-[11.5px] leading-snug text-[#96632a]">{section.blurb}</p>}
        </div>
      </header>
      <div className="grid gap-2.5 p-4 sm:grid-cols-2">
        {section.questions.map((q) => <QuestionField key={q.id} q={q} answers={answers} set={set} />)}
      </div>
    </section>
  );
}

/** Every section, in order. The whole reference on one page — a referee doing a
 *  favour on their lunch break shouldn't have to discover there's a step 4. */
export function ReferenceQuestionForm({ sections, answers, set }: { sections: RefSection[]; answers: Record<string, string>; set: (id: string, v: string) => void }) {
  return (
    <div className="space-y-3">
      {sections.map((s) => <SectionCard key={s.id} section={s} answers={answers} set={set} />)}
    </div>
  );
}

// ——— read-back ———

/** What the referee said, grouped the way they were asked. Unanswered questions
 *  are shown as "—" rather than hidden: on a safeguarding reference, a question
 *  someone skipped is itself information. */
export function ReferenceReadback({ sections, answers }: { sections: RefSection[]; answers: Record<string, string> }) {
  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div key={s.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] font-extrabold text-[var(--ink-2)]">{s.icon} {s.title}</div>
          <dl className="divide-y divide-[var(--line)]">
            {s.questions.map((q) => {
              const v = (answers[q.id] ?? "").trim();
              const why = (answers[detailsKey(q.id)] ?? "").trim();
              const bad = (q.concernOptions ?? []).includes(v);
              return (
                <div key={q.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[1fr_1fr]">
                  <dt className="text-[11.5px] leading-snug text-[var(--ink-3)]">{q.label}</dt>
                  <dd className={"text-[12.5px] font-semibold leading-snug " + (bad ? "text-[#c0392b]" : v ? "text-[var(--ink)]" : "text-[var(--ink-3)]")}>
                    {bad && "⚠ "}{v || "—"}
                    {why && <div className={"mt-1 whitespace-pre-wrap rounded-lg px-2 py-1.5 text-[12px] font-normal " + (bad ? "bg-[#fdecec] text-[#8a2020]" : "bg-[var(--panel)] text-[var(--ink-2)]")}>{why}</div>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
      {(answers.signedName || answers.signedPosition || answers.signedOrg) && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[12px] text-[var(--ink-2)]">
          <span className="font-extrabold text-[var(--ink)]">Signed:</span> {answers.signedName}
          {answers.signedPosition ? ` · ${answers.signedPosition}` : ""}
          {answers.signedOrg ? ` · ${answers.signedOrg}` : ""}
        </div>
      )}
    </div>
  );
}

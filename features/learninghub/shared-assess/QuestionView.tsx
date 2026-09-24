"use client";

import { useId, useState } from "react";
import { Icon } from "../kit";
import type { KindRule, MatchAnswer, Option, OrderAnswer, Piece, Pic } from "./api";
import { MatchInput, OrderInput } from "./MatchOrder";
import { ToolQuestion, type ToolAnswerValue } from "../tools/ToolQuestion";
import type { PublicProblem } from "../tools/problems";
import { Lightbox, QImage } from "./QuestionImage";
import { display } from "./ui";
import { SpeakButton } from "../speak";
import { useSupport } from "../family/FamilyContext";

// One question as a student answers it. Used by the quiz runner and by the
// tutor's live preview in the question editor — so what a tutor previews is
// exactly what a child gets. Rendering only: marking is the server's job.

export type Answer = string | string[] | MatchAnswer | OrderAnswer | ToolAnswerValue;

export interface QView { id: string; prompt: string; options?: Option[]; marks: number; image?: Pic | null; /** match */ terms?: Piece[]; definitions?: Piece[]; /** order */ items?: string[]; /** tool */ toolProblem?: PublicProblem }

const LETTERS = "ABCDEFGHIJ";

export function QuestionView({ q, rule, value, onChange, disabled, autoFocus, onRefreshImages }: { q: QView; rule: KindRule; value: Answer | undefined; onChange: (v: Answer) => void; disabled?: boolean; autoFocus?: boolean; /** Signed picture links expire: refetch the paper's links (called once per failed picture). */ onRefreshImages?: () => Promise<unknown> | void }) {
  const gid = useId();
  const multi = rule === "multi";
  const picked = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  const matchVal = value && typeof value === "object" && !Array.isArray(value) && value.kind === "match" ? value : undefined;
  const orderVal = value && typeof value === "object" && !Array.isArray(value) && value.kind === "order" ? value : undefined;

  const support = useSupport();
  const spoken = support.readAloudDefault && q.options?.length ? `${q.prompt}. ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o.text}`).join(". ")}` : q.prompt;
  const pictured = (q.options ?? []).some((o) => o.image?.url);
  const field = "w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[16px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-3)] focus:border-[var(--brand)] disabled:opacity-60";

  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-4 w-full p-0">
        <span className="flex items-start gap-2.5">
          <span className="block min-w-0 flex-1 text-[19px] font-extrabold leading-snug text-[var(--ink)] sm:text-[21px]" style={display}>
            <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{q.prompt || "Your question will appear here"}</span>
          </span>
          {q.prompt && <SpeakButton text={spoken} label="Read the question aloud" testId="hub-read-question" />}
        </span>
        <span className="mt-2 inline-flex items-center gap-2 text-[11.5px] font-bold text-[var(--ink-3)]">
          <span className="rounded-full bg-[var(--panel)] px-2.5 py-0.5">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
          {multi && <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[var(--brand-strong)]">Choose all that apply</span>}
          {rule === "match" && <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[var(--brand-strong)]">Match each pair</span>}
          {rule === "order" && <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[var(--brand-strong)]">Put in order</span>}
          {rule === "tool" && <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[var(--brand-strong)]">Use the tools</span>}
        </span>
      </legend>

      {q.image?.url && <div className="mb-4" data-testid="hub-question-image"><QImage pic={q.image} onRefresh={onRefreshImages} /></div>}

      {(rule === "choice" || rule === "multi") && pictured && (
        <div className={`grid grid-cols-2 gap-2.5 ${(q.options ?? []).length % 3 === 0 ? "sm:grid-cols-3" : ""}`} role={multi ? "group" : "radiogroup"} aria-label="Answer options" data-testid="hub-picture-options">
          {(q.options ?? []).map((o, i) => {
            const on = picked.includes(o.id);
            return (
              <div key={o.id} className="relative">
                <label className="group relative block h-full cursor-pointer">
                  <input type={multi ? "checkbox" : "radio"} name={`${gid}-${q.id}`} checked={on} autoFocus={autoFocus && i === 0}
                    onChange={() => onChange(multi ? (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : o.id)} className="peer sr-only" />
                  <span className="flex h-full flex-col overflow-hidden rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] transition-all peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand-soft)] peer-checked:shadow-[var(--shadow-sm)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--brand)] hover:border-[var(--brand-line)] peer-disabled:opacity-60">
                    {o.image?.url ? <QImage pic={o.image} alt={o.text || `Option ${LETTERS[i] ?? i + 1}`} fit="tile" zoom={false} onRefresh={onRefreshImages} /> : <span className="grid aspect-[4/3] place-items-center bg-[var(--panel)] text-[var(--ink-3)]" aria-hidden>·</span>}
                    <span className="flex min-h-[48px] items-center gap-2.5 px-2.5 py-2">
                      <span className={`grid h-7 w-7 flex-none place-items-center text-[12px] font-extrabold transition-colors ${multi ? "rounded-lg" : "rounded-full"} ${on ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-2)]"}`} aria-hidden>{on ? "✓" : LETTERS[i] ?? i + 1}</span>
                      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{o.text || <span className="sr-only">Option {LETTERS[i] ?? i + 1}</span>}</span>
                    </span>
                  </span>
                </label>
                {o.image?.url && <PicZoom pic={o.image} label={o.text || `Option ${LETTERS[i] ?? i + 1}`} />}
              </div>
            );
          })}
        </div>
      )}

      {(rule === "choice" || rule === "multi") && !pictured && (
        <div className="grid gap-2.5" role={multi ? "group" : "radiogroup"} aria-label="Answer options">
          {(q.options ?? []).map((o, i) => {
            const on = picked.includes(o.id);
            return (
              <label key={o.id} className="group relative block cursor-pointer">
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={`${gid}-${q.id}`}
                  checked={on}
                  autoFocus={autoFocus && i === 0}
                  onChange={() => onChange(multi ? (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : o.id)}
                  className="peer sr-only"
                />
                <span className="flex min-h-[56px] items-center gap-3 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 transition-all peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand-soft)] peer-checked:shadow-[var(--shadow-sm)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--brand)] hover:border-[var(--brand-line)] peer-disabled:opacity-60">
                  <span className={`grid h-8 w-8 flex-none place-items-center text-[12.5px] font-extrabold transition-colors ${multi ? "rounded-lg" : "rounded-full"} ${on ? "bg-[var(--brand)] text-white" : "bg-[var(--panel)] text-[var(--ink-2)]"}`} aria-hidden>
                    {on ? "✓" : LETTERS[i] ?? i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{o.text || <em className="text-[var(--ink-3)]">Empty option</em>}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {rule === "match" && (
        (q.terms?.length && q.definitions?.length)
          ? <MatchInput key={`${q.id}:${q.terms.length}`} terms={q.terms} definitions={q.definitions} value={matchVal} onChange={onChange} disabled={disabled} />
          : <p className="m-0 text-[13px] text-[var(--ink-3)]">Add at least three pairs to see how this looks.</p>
      )}

      {rule === "order" && (
        (q.items?.length ?? 0) >= 2
          ? <OrderInput key={`${q.id}:${q.items!.length}`} items={q.items!} value={orderVal} onChange={onChange} disabled={disabled} />
          : <p className="m-0 text-[13px] text-[var(--ink-3)]">Add at least two items to see how this looks.</p>
      )}

      {rule === "exact" && (
        <div>
          <label htmlFor={`${gid}-t`} className="sr-only">Your answer</label>
          <input id={`${gid}-t`} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} autoFocus={autoFocus} className={field} placeholder="Type your answer" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}

      {rule === "numeric" && (
        <div>
          <label htmlFor={`${gid}-n`} className="sr-only">Your answer (a number)</label>
          <input id={`${gid}-n`} type="text" inputMode="decimal" autoComplete="off" autoFocus={autoFocus} className={`${field} max-w-[280px] tabular-nums`} placeholder="Enter a number" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}

      {rule === "tool" && <ToolQuestion problem={q.toolProblem} value={value && typeof value === "object" && !Array.isArray(value) && value.kind === "tool" ? value : undefined} onChange={onChange} disabled={disabled} />}

      {rule === "manual" && (
        <div>
          <label htmlFor={`${gid}-w`} className="sr-only">Your written answer</label>
          <textarea id={`${gid}-w`} rows={6} autoFocus={autoFocus} className={`${field} resize-y leading-relaxed`} placeholder="Write your answer here. Your tutor will read and mark it." value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
          <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">Your tutor marks this one by hand.</p>
        </div>
      )}
    </fieldset>
  );
}

/** Has the student put anything in for this question? */
export function isAnswered(v: Answer | undefined): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return v.kind === "match" ? v.pairs.length > 0 : v.kind === "order" ? v.items.length > 0 : v.kind === "tool" ? ((v.marks?.length ?? 0) > 0 || (v.points?.length ?? 0) > 0 || (v.number !== undefined && v.number !== null)) : false;
  return typeof v === "string" && v.trim() !== "";
}

/** A small "enlarge" button laid over a picture-answer tile (the tile itself selects the answer). */
function PicZoom({ pic, label }: { pic: Pic; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={`Enlarge picture for ${label}`} onClick={() => setOpen(true)} className="absolute right-1.5 top-1.5 z-[1] grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)]/90 text-[var(--ink)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline"><Icon name="search" size={15} strokeWidth={2.2} /></button>
      {open && pic.url && <Lightbox url={pic.url} alt={label} onClose={() => setOpen(false)} />}
    </>
  );
}

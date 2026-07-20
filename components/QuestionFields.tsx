"use client";

import { FieldLabel, Input, Select } from "@/components/ui";
import { answerKey, DEFAULT_QUESTION_LENGTH, type ChildQuestion } from "@/lib/settings";

// ─────────────────────────────────────────────────────────────────────────
// The provider's own child questions, rendered as fields.
//
// One component for both sides — the parent answering at checkout and the
// operator filling them in on the Families screen — because they are the same
// questions and the same answers. Two renderers would drift, and a question
// that looks different depending on who is typing is a question that gets
// answered differently.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The customer pages carry three themes of their own and don't use the
 * operator CSS variables — a component that assumed `var(--ink)` came out
 * unreadable there. Passing the colours in keeps one renderer for both sides.
 */
export interface QuestionTone {
  ink: string;
  muted: string;
  inputClass: string;
  inputStyle: React.CSSProperties;
  accent: string;
  accentSoft: string;
  line: string;
}

export function QuestionFields({
  questions,
  answers,
  onChange,
  /** Shown above the group. Omit on the parent side, where it'd be noise. */
  heading,
  tone,
}: {
  questions: ChildQuestion[];
  answers: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  heading?: string;
  tone?: QuestionTone;
}) {
  if (questions.length === 0) return null;

  const set = (key: string, value: string) => onChange({ ...answers, [key]: value });

  if (tone) return <ThemedQuestions questions={questions} answers={answers} set={set} tone={tone} heading={heading} />;

  return (
    <div className="mt-2.5 border-t border-[var(--line)] pt-2.5">
      {heading && <div className="mb-1.5 text-[11px] font-bold">{heading}</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((q) => {
          const key = answerKey(q);
          const value = answers[key] ?? "";
          return (
            <div key={q.id} className={q.type === "text" ? "sm:col-span-2" : undefined}>
              <FieldLabel>
                {q.label}
                {q.required && <span className="ml-1 text-[var(--red,#e21d27)]">*</span>}
              </FieldLabel>

              {q.type === "text" && (
                <Input
                  value={value}
                  onChange={(e) => set(key, e.target.value)}
                  title={value || undefined}
                  maxLength={q.maxLength ?? DEFAULT_QUESTION_LENGTH}
                  className="w-full"
                />
              )}

              {q.type === "choice" && (
                <Select value={value} onChange={(e) => set(key, e.target.value)} className="w-full">
                  <option value="">Not said</option>
                  {(q.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              )}

              {q.type === "yesno" && (
                <div className="flex gap-1.5">
                  {["Yes", "No"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      // Clicking the chosen one again clears it. "No" and
                      // "never answered" are different facts, and a consent
                      // question you can't un-answer is one you can't correct.
                      onClick={() => set(key, value === v ? "" : v)}
                      className="rounded-full border-2 px-3 py-[3px] text-[11.5px] font-bold transition-colors"
                      style={
                        value === v
                          ? { borderColor: "var(--brand,#2f6bd8)", background: "var(--brand-soft,#eaf0fc)", color: "var(--brand-ink,#1d3a8f)" }
                          : { borderColor: "var(--line)", color: "var(--ink-3)" }
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {q.help && <div className="mt-0.5 text-[10.5px] leading-[1.4] text-[var(--ink-3)]">{q.help}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The same fields in a customer page's own theme. */
function ThemedQuestions({
  questions,
  answers,
  set,
  tone,
  heading,
}: {
  questions: ChildQuestion[];
  answers: Record<string, string>;
  set: (key: string, value: string) => void;
  tone: QuestionTone;
  heading?: string;
}) {
  return (
    <div className="mt-3 border-t pt-2.5" style={{ borderColor: tone.line }}>
      {heading && (
        <div className="mb-1.5 text-[11.5px] font-bold" style={{ color: tone.ink }}>
          {heading}
        </div>
      )}
      {questions.map((q) => {
        const key = answerKey(q);
        const value = answers[key] ?? "";
        return (
          <div key={q.id} className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tone.ink }}>
              {q.label}{" "}
              <span className="font-normal" style={{ color: tone.muted }}>
                {q.required ? "— required" : "— optional"}
              </span>
            </div>

            {q.type === "text" && (
              <input
                value={value}
                maxLength={q.maxLength ?? DEFAULT_QUESTION_LENGTH}
                onChange={(e) => set(key, e.target.value)}
                className={tone.inputClass}
                style={tone.inputStyle}
              />
            )}

            {q.type === "choice" && (
              <div className="flex flex-wrap gap-1.5">
                {(q.options ?? []).map((o) => {
                  const on = value === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => set(key, on ? "" : o)}
                      className="rounded-full border-2 px-3 py-[4px] text-[12px] font-bold transition-colors"
                      style={
                        on
                          ? { borderColor: tone.accent, background: tone.accentSoft, color: tone.ink }
                          : { borderColor: `${tone.ink}33`, color: tone.muted }
                      }
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "yesno" && (
              <div className="flex gap-1.5">
                {["Yes", "No"].map((v) => {
                  const on = value === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set(key, on ? "" : v)}
                      className="rounded-full border-2 px-3.5 py-[4px] text-[12px] font-bold transition-colors"
                      style={
                        on
                          ? { borderColor: tone.accent, background: tone.accentSoft, color: tone.ink }
                          : { borderColor: `${tone.ink}33`, color: tone.muted }
                      }
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            )}

            {q.help && (
              <div className="mt-1 text-[10.5px] leading-[1.45]" style={{ color: tone.muted }}>
                {q.help}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Required questions with no answer — the caller decides what to do about it. */
export function unansweredRequired(questions: ChildQuestion[], answers: Record<string, string>): ChildQuestion[] {
  return questions.filter((q) => q.required && !(answers[answerKey(q)] ?? "").trim());
}

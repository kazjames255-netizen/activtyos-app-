"use client";

// Edit the reference questions a provider asks. Same shape as the onboarding
// ⚙ Requirements modal: open it from the References step, change what you like,
// save straight to settings (tenant-scoped, server-backed).
//
// Everything is editable EXCEPT the three safeguarding questions, and even
// those are only half-locked — reword them, reorder them, change their answer
// options — they just can't be deleted, and must keep at least one answer
// marked as a concern. That mark is what puts a new starter on hold, so a set
// without one would quietly disable the gate. validateSections enforces it and
// the editor explains it rather than just refusing.
import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import {
  DEFAULT_REFERENCE_SECTIONS,
  LOCKED_IDS,
  RATINGS,
  YES_NO,
  newId,
  validateSections,
  type RefKind,
  type RefQuestion,
  type RefSection,
} from "./referenceQuestions";

const KIND_LABEL: Record<RefKind, string> = {
  choice: "Multiple choice",
  text: "Short text",
  long: "Long text",
  month: "Month",
};

const clone = (s: RefSection[]): RefSection[] => s.map((x) => ({ ...x, questions: x.questions.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined, concernOptions: q.concernOptions ? [...q.concernOptions] : undefined, detailsOn: q.detailsOn ? [...q.detailsOn] : undefined })) }));

const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

export function ReferenceQuestionsEditor({ sections, onSave, onClose }: {
  sections: RefSection[];
  onSave: (s: RefSection[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<RefSection[]>(() => clone(sections));
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  const problems = validateSections(list);
  const patchSection = (si: number, p: Partial<RefSection>) => setList((l) => l.map((s, i) => (i === si ? { ...s, ...p } : s)));
  const patchQ = (si: number, qi: number, p: Partial<RefQuestion>) =>
    setList((l) => l.map((s, i) => (i === si ? { ...s, questions: s.questions.map((q, j) => (j === qi ? { ...q, ...p } : q)) } : s)));

  const addQuestion = (si: number) => {
    const n = list.reduce((a, s) => a + s.questions.length, 0);
    const q: RefQuestion = { id: newId("q_custom", n + Date.now() % 100000), kind: "text", label: "" };
    setList((l) => l.map((s, i) => (i === si ? { ...s, questions: [...s.questions, q] } : s)));
    setOpenQ(q.id);
  };
  const addSection = () => setList((l) => [...l, { id: newId("sec", l.length + Date.now() % 100000), title: "New section", icon: "📝", questions: [] }]);

  const save = () => {
    setTried(true);
    if (problems.length) return;
    onSave(list);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[144] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-extrabold text-[var(--ink)]">Reference questions</h3>
            <button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button>
          </div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-3)]">
            What referees are asked. Changes apply to <b>new</b> requests — a reference already sent keeps the
            questions it was sent with, so what a referee answered always reads back as it was asked.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f4ee] px-5 py-4">
          {tried && problems.length > 0 && (
            <div className="rounded-xl border border-[#f3c2c2] bg-[#fdecec] px-3.5 py-2.5">
              <div className="text-[12px] font-extrabold text-[#a32020]">Can&rsquo;t save yet:</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] leading-snug text-[#8a2020]">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}

          {list.map((s, si) => (
            <section key={s.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-white">
              <header className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[#fdf3e0] px-3 py-2">
                <Input value={s.icon} onChange={(e) => patchSection(si, { icon: e.target.value.slice(0, 4) })} className="w-[52px] bg-white text-center" title="Emoji" />
                <Input value={s.title} onChange={(e) => patchSection(si, { title: e.target.value })} className="min-w-[160px] flex-1 bg-white font-bold" placeholder="Section title" />
                <div className="flex gap-1">
                  <button type="button" title="Move up" onClick={() => setList((l) => move(l, si, -1))} className="rounded-md px-1.5 text-[13px] text-[#96632a] hover:bg-white">▲</button>
                  <button type="button" title="Move down" onClick={() => setList((l) => move(l, si, 1))} className="rounded-md px-1.5 text-[13px] text-[#96632a] hover:bg-white">▼</button>
                  {!s.questions.some((q) => q.locked) && (
                    <button type="button" title="Delete section" onClick={() => { if (window.confirm(`Delete “${s.title}” and its ${s.questions.length} question(s)?`)) setList((l) => l.filter((_, i) => i !== si)); }} className="rounded-md px-1.5 text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                  )}
                </div>
                <Input value={s.blurb ?? ""} onChange={(e) => patchSection(si, { blurb: e.target.value })} className="w-full bg-white text-[11.5px]" placeholder="Optional note shown under the title" />
              </header>

              <div className="space-y-1.5 p-2.5">
                {s.questions.map((q, qi) => (
                  <QuestionRow
                    key={q.id}
                    q={q}
                    open={openQ === q.id}
                    onToggle={() => setOpenQ(openQ === q.id ? null : q.id)}
                    onPatch={(p) => patchQ(si, qi, p)}
                    onMove={(d) => patchSectionQuestions(setList, si, (qs) => move(qs, qi, d))}
                    onDelete={() => patchSectionQuestions(setList, si, (qs) => qs.filter((_, j) => j !== qi))}
                  />
                ))}
                <Button sm onClick={() => addQuestion(si)}>+ Add a question</Button>
              </div>
            </section>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button onClick={addSection}>+ Add a section</Button>
            <Button onClick={() => { if (window.confirm("Put every question back to the ActivityOS default set? Your edits will be lost.")) setList(clone(DEFAULT_REFERENCE_SECTIONS)); }}>Reset to the default questions</Button>
          </div>
        </div>

        <div className="flex flex-none flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <span className="text-[11.5px] text-[var(--ink-3)]">
            {list.reduce((a, s) => a + s.questions.length, 0)} questions · {LOCKED_IDS.length} safeguarding questions locked
          </span>
          <Button className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save questions</Button>
        </div>
      </div>
    </div>
  );
}

/** Replace one section's questions — keeps the setState plumbing in one place. */
function patchSectionQuestions(
  setList: React.Dispatch<React.SetStateAction<RefSection[]>>,
  si: number,
  fn: (qs: RefQuestion[]) => RefQuestion[],
) {
  setList((l) => l.map((s, i) => (i === si ? { ...s, questions: fn(s.questions) } : s)));
}

function QuestionRow({ q, open, onToggle, onPatch, onMove, onDelete }: {
  q: RefQuestion;
  open: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<RefQuestion>) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
}) {
  const options = q.options ?? [];
  const concern = q.concernOptions ?? [];
  const details = q.detailsOn ?? [];
  const setOption = (i: number, v: string) => {
    const old = options[i];
    onPatch({
      options: options.map((o, j) => (j === i ? v : o)),
      // Rename in place: an option marked as a concern must stay marked when
      // its wording changes, or rewording silently unhooks the gate.
      concernOptions: concern.map((o) => (o === old ? v : o)),
      detailsOn: details.map((o) => (o === old ? v : o)),
    });
  };
  const removeOption = (i: number) => {
    const old = options[i];
    onPatch({
      options: options.filter((_, j) => j !== i),
      concernOptions: concern.filter((o) => o !== old),
      detailsOn: details.filter((o) => o !== old),
    });
  };
  const toggleIn = (list: string[], o: string) => (list.includes(o) ? list.filter((x) => x !== o) : [...list, o]);

  return (
    <div className={"rounded-lg border " + (q.locked ? "border-[#f3cfa6] bg-[#fffdfa]" : "border-[var(--line)]")}>
      <div className="flex flex-wrap items-center gap-2 px-2.5 py-2">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="text-[12.5px] font-semibold text-[var(--ink)]">{q.label || <i className="text-[var(--ink-3)]">Untitled question</i>}</span>
          {q.locked && <span title="Safeguarding — can't be deleted" className="ml-1.5 text-[10px]">🔒</span>}
          {q.required && <span className="ml-1 text-[#c0392b]">*</span>}
          <span className="ml-1.5 text-[10px] text-[var(--ink-3)]">{KIND_LABEL[q.kind]}</span>
        </button>
        <div className="flex gap-1">
          <button type="button" title="Move up" onClick={() => onMove(-1)} className="rounded-md px-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)]">▲</button>
          <button type="button" title="Move down" onClick={() => onMove(1)} className="rounded-md px-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)]">▼</button>
          {q.locked ? (
            <span title="Safeguarding questions can't be removed" className="px-1.5 text-[12px] text-[var(--ink-3)]">🔒</span>
          ) : (
            <button type="button" title="Delete" onClick={() => { if (window.confirm(`Delete “${q.label || "this question"}”?`)) onDelete(); }} className="rounded-md px-1.5 text-[12px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
          )}
          <button type="button" onClick={onToggle} className="rounded-md px-1.5 text-[12px] font-bold text-[#1d3a8f]">{open ? "Done" : "Edit"}</button>
        </div>
      </div>

      {open && (
        <div className="space-y-2.5 border-t border-[var(--line)] px-2.5 py-2.5">
          {q.locked && (
            <div className="rounded-lg bg-[#fdf3e0] px-2.5 py-1.5 text-[11px] leading-snug text-[#8a4b09]">
              A safeguarding question. Reword it, reorder it, change its answers — but it can&rsquo;t be deleted, and at
              least one answer must stay marked <b>⚠ concern</b>. That mark is what puts someone on hold.
            </div>
          )}
          <label className="block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Question
            <textarea value={q.label} onChange={(e) => onPatch({ label: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[13px] font-semibold normal-case text-[var(--ink)] outline-none focus:border-[#b45309]" />
          </label>
          <label className="block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Hint (optional)
            <Input value={q.hint ?? ""} onChange={(e) => onPatch({ hint: e.target.value })} className="mt-1 w-full normal-case" placeholder="Shown in small text under the answer" />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={q.kind}
              disabled={q.locked}
              onChange={(e) => {
                const kind = e.target.value as RefKind;
                onPatch({ kind, options: kind === "choice" ? (options.length ? options : [...YES_NO]) : undefined, concernOptions: kind === "choice" ? concern : undefined, detailsOn: kind === "choice" ? details : undefined });
              }}
              className="max-w-[160px]"
              title={q.locked ? "Safeguarding questions stay multiple-choice" : undefined}
            >
              {(Object.keys(KIND_LABEL) as RefKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">
              <input type="checkbox" checked={!!q.required} disabled={q.locked} onChange={(e) => onPatch({ required: e.target.checked })} className="h-3.5 w-3.5 accent-[#b45309]" />
              Must be answered
            </label>
          </div>

          {q.kind === "choice" && (
            <div className="rounded-lg border border-[var(--line)] p-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Answers</span>
                <button type="button" onClick={() => onPatch({ options: [...options, `Option ${options.length + 1}`] })} className="text-[11px] font-bold text-[#1d3a8f] hover:underline">+ Add</button>
                {!q.locked && (
                  <>
                    <button type="button" onClick={() => onPatch({ options: [...RATINGS] })} className="text-[11px] font-bold text-[var(--ink-3)] hover:underline">Use the rating scale</button>
                    <button type="button" onClick={() => onPatch({ options: [...YES_NO] })} className="text-[11px] font-bold text-[var(--ink-3)] hover:underline">Use Yes / No</button>
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                {options.map((o, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <Input value={o} onChange={(e) => setOption(i, e.target.value)} className="min-w-[140px] flex-1" />
                    <button
                      type="button"
                      onClick={() => onPatch({ concernOptions: toggleIn(concern, o) })}
                      title="Picking this answer flags a safeguarding concern and blocks cleared-to-start"
                      className={"rounded-full border px-2 py-1 text-[10.5px] font-bold " + (concern.includes(o) ? "border-transparent bg-[#c0392b] text-white" : "border-[var(--line)] text-[var(--ink-3)] hover:border-[#c0392b] hover:text-[#c0392b]")}
                    >
                      ⚠ Concern
                    </button>
                    <button
                      type="button"
                      onClick={() => onPatch({ detailsOn: toggleIn(details, o) })}
                      title="Picking this answer asks the referee to explain"
                      className={"rounded-full border px-2 py-1 text-[10.5px] font-bold " + (details.includes(o) ? "border-transparent bg-[#1d3a8f] text-white" : "border-[var(--line)] text-[var(--ink-3)] hover:border-[#1d3a8f] hover:text-[#1d3a8f]")}
                    >
                      Ask why
                    </button>
                    {options.length > 1 && <button type="button" onClick={() => removeOption(i)} className="px-1 text-[12px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>}
                  </div>
                ))}
              </div>
              {details.length > 0 && (
                <label className="mt-2 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">“Ask why” prompt
                  <Input value={q.detailsLabel ?? ""} onChange={(e) => onPatch({ detailsLabel: e.target.value })} className="mt-1 w-full normal-case" placeholder="Please give details" />
                </label>
              )}
              <p className="mt-2 text-[10.5px] leading-snug text-[var(--ink-3)]">
                <b>⚠ Concern</b> marks an answer as one that puts the person on hold until someone reviews it.
                <b> Ask why</b> opens a compulsory explanation box.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

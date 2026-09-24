"use client";

import { useMemo, useState } from "react";
import QuestionTools from "../tools/QuestionTools";
import { yearFromLabel } from "../tools/yearLabel";
import { GENERATOR_LABEL, publicProblem, PROBLEM_GENERATORS } from "../tools/problems";
import { Button, FieldLabel, Input } from "@/components/ui";
import { post, put } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import { errMsg, topicLabel } from "../types";
import { NewTopicInline, useTopicsWithNew } from "../NewTopicInline";
import { TopicPicker } from "../TopicPicker";
import { hubPath, newOptionId, ruleOf, type KindRule, type Option, type PairImage, type Pic, type Question } from "../shared-assess/api";
import { imageFrom } from "../shared-assess/imageUtil";
import { ImageField, OptionPic } from "./ImageField";
import { QuestionView, type Answer } from "../shared-assess/QuestionView";
import { display, FOCUS, Modal, Notice, Switch, TAP } from "../shared-assess/ui";

// Create / edit one question. The form is driven entirely by the tenant's
// configured question kinds (p.config.questionKinds): the *rule* a kind marks by
// decides which answer editor appears. A live preview on the right renders the
// same component a student answers with.

interface Draft {
  yearGroups: string[];
  id: string | null;
  topicId: string;
  kind: string;
  prompt: string;
  options: Option[];
  correct: string[];
  exact: string;
  accepted: string[];
  numeric: string;
  tolerance: string;
  marks: string;
  explanation: string;
  published: boolean;
  image: Pic | null;
  imageAlt: string;
  /** match: one row per pair (a picture, when the question came with one, is kept as it was). */
  pairs: PairRow[];
  /** order: the items, in the CORRECT order, top to bottom. */
  items: { id: string; text: string }[];
  /** tool: which problem generator, and an optional pinned seed (blank = a fresh problem every attempt). */
  toolGen: string;
  toolSeed: string;
}

interface PairRow { id: string; term: string; definition: string; termImage?: PairImage | null; definitionImage?: PairImage | null }

const MATCH_MIN = 3, MATCH_MAX = 8, ORDER_MIN = 2, ORDER_MAX = 8;
const blankPairs = (): PairRow[] => [0, 1, 2].map(() => ({ id: newOptionId(), term: "", definition: "" }));
const blankItems = () => [0, 1, 2].map(() => ({ id: newOptionId(), text: "" }));

const blankOptions = () => [0, 1, 2, 3].map(() => ({ id: newOptionId(), text: "" }));

function fromQuestion(q: Question): Draft {
  return {
    id: q.id, topicId: q.topicId, kind: q.kind, prompt: q.prompt,
    options: q.options?.length ? q.options : blankOptions(),
    correct: Array.isArray(q.answer) ? q.answer : typeof q.answer === "string" && q.options?.some((o) => o.id === q.answer) ? [q.answer] : [],
    exact: typeof q.answer === "string" && !q.options?.some((o) => o.id === q.answer) ? q.answer : "",
    accepted: q.acceptedAnswers ?? [],
    numeric: typeof q.answer === "number" ? String(q.answer) : "",
    tolerance: String(q.tolerance ?? 0),
    marks: String(q.marks ?? 1), explanation: q.explanation ?? "", published: q.published,
    image: q.image?.id ? { id: q.image.id, url: q.image.url } : q.image?.url ? { url: q.image.url } : null, imageAlt: q.image?.alt ?? "",
    yearGroups: q.yearGroups ?? [],
    pairs: q.pairs?.length ? q.pairs.map((x) => ({ id: newOptionId(), ...x })) : blankPairs(),
    items: q.items?.length ? q.items.map((text) => ({ id: newOptionId(), text })) : blankItems(),
    toolGen: q.tool?.generatorId ?? "", toolSeed: q.tool?.seed ? String(q.tool.seed) : "",
  };
}

/** Card look of each way a question can be marked (the same picker style as the lesson builder's "Add to this slide"). */
const KIND_LOOK: Record<string, { icon: string; hint: string }> = {
  choice: { icon: "✅", hint: "One right answer, tap to choose" },
  multi: { icon: "☑️", hint: "Several right answers" },
  exact: { icon: "✏️", hint: "Type the answer, marked automatically" },
  numeric: { icon: "🔢", hint: "A number, with a tolerance" },
  match: { icon: "🔗", hint: "Pair each item with its match" },
  order: { icon: "↕️", hint: "Put the items in order" },
  tool: { icon: "📐", hint: "Ruler, protractor, grid… marked automatically" },
  manual: { icon: "📝", hint: "Written, you mark it by hand" },
};

export function QuestionForm({ p, question, defaultTopicId, onClose, onSaved }: { p: PanelProps; question?: Question | null; defaultTopicId?: string; onClose: () => void; onSaved: (q: Question) => void }) {
  const kinds = p.config.questionKinds;
  const [d, setD] = useState<Draft>(() => question ? fromQuestion(question) : {
    id: null, topicId: defaultTopicId ?? p.topics.find((t) => p.covered.has(t.id))?.id ?? p.topics[0]?.id ?? "",
    kind: kinds[0]?.id ?? "single", prompt: "", options: blankOptions(), correct: [], exact: "", accepted: [], numeric: "", tolerance: "0", marks: "1", explanation: "", published: true, image: null, imageAlt: "", yearGroups: [], pairs: blankPairs(), items: blankItems(), toolGen: "", toolSeed: "",
  });
  const [acc, setAcc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<Answer | undefined>(undefined);
  const rule: KindRule = ruleOf(kinds, d.kind);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const [withNew, rememberTopic, forgetSubject] = useTopicsWithNew(p.topics);
  const topics = useMemo(() => [...withNew].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [withNew]);

  const filled = d.options.filter((o) => o.text.trim() || o.image?.id || o.image?.url);
  const problems: string[] = [];
  if (d.image && !d.imageAlt.trim()) problems.push("Describe the picture (alt text) so every child can use it.");
  if (!d.topicId) problems.push("Choose a topic.");
  if (!d.prompt.trim()) problems.push("Write the question.");
  if (rule === "choice" || rule === "multi") {
    if (filled.length < 2) problems.push("Add at least two options.");
    const ok = d.correct.filter((id) => filled.some((o) => o.id === id));
    if (rule === "choice" && ok.length !== 1) problems.push("Mark the one correct option.");
    if (rule === "multi" && ok.length < 1) problems.push("Mark every correct option.");
  }
  const halfPair = d.pairs.some((x) => !!x.term.trim() !== !!x.definition.trim());
  const fullPairs = d.pairs.filter((x) => x.term.trim() && x.definition.trim());
  const fullItems = d.items.filter((x) => x.text.trim());
  if (rule === "match") {
    if (halfPair) problems.push("Every pair needs both a term and its match.");
    if (fullPairs.length < MATCH_MIN) problems.push(`Add at least ${MATCH_MIN} pairs.`);
    const keys = fullPairs.map((x) => `${x.term.trim().toLowerCase()}\u241f${x.definition.trim().toLowerCase()}`);
    if (new Set(keys).size !== keys.length) problems.push("The same pair is in twice.");
  }
  if (rule === "order" && fullItems.length < ORDER_MIN) problems.push(`Add at least ${ORDER_MIN} items.`);
  if (rule === "tool" && !PROBLEM_GENERATORS[d.toolGen]) problems.push("Choose what the pupil has to do with the tool.");
  if (rule === "tool" && d.toolSeed.trim() !== "" && !(Number.isInteger(Number(d.toolSeed)) && Number(d.toolSeed) >= 1)) problems.push("A fixed problem number must be a whole number, 1 or more (or leave it blank).");
  if (rule === "exact" && !d.exact.trim()) problems.push("Enter the correct answer.");
  if (rule === "numeric" && (d.numeric.trim() === "" || !Number.isFinite(Number(d.numeric)))) problems.push("Enter the correct number.");
  if (!(Number(d.marks) >= 1)) problems.push("Marks must be at least 1.");

  const changeKind = (kind: string) => {
    const r = ruleOf(kinds, kind);
    setPreview(undefined);
    setD((x) => ({ ...x, kind, correct: r === "choice" ? x.correct.slice(0, 1) : x.correct }));
  };

  const save = async () => {
    setErr(null);
    if (problems.length) { setErr(problems[0]); return; }
    setBusy(true);
    try {
      const choiceLike = rule === "choice" || rule === "multi";
      const options = choiceLike ? filled.map((o) => ({ id: o.id, text: o.text.trim(), ...(o.image?.id ? { image: { id: o.image.id } } : {}) })) : [];
      const answer = rule === "choice" ? d.correct[0] : rule === "multi" ? d.correct.filter((id) => filled.some((o) => o.id === id)) : rule === "exact" ? d.exact.trim() : rule === "numeric" ? Number(d.numeric) : null;
      const body = {
        topicId: d.topicId, kind: d.kind, prompt: d.prompt.trim(), options, answer,
        ...(rule === "match" ? { pairs: fullPairs.map((x) => ({ term: x.term.trim(), definition: x.definition.trim(), ...(x.termImage ? { termImage: x.termImage } : {}), ...(x.definitionImage ? { definitionImage: x.definitionImage } : {}) })) } : {}),
        ...(rule === "order" ? { items: fullItems.map((x) => x.text.trim()) } : {}),
        ...(rule === "tool" ? { tool: { generatorId: d.toolGen, ...(d.toolSeed.trim() ? { seed: Number(d.toolSeed) } : {}) } } : {}),
        acceptedAnswers: rule === "exact" ? d.accepted : [], tolerance: rule === "numeric" ? Number(d.tolerance) || 0 : 0,
        marks: Math.round(Number(d.marks)), explanation: d.explanation.trim(), published: d.published, yearGroups: d.yearGroups,
        // An Oak picture (a link, no upload id) is left out so the server keeps it; removing it sends null.
        ...(d.image?.id ? { image: { id: d.image.id, alt: d.imageAlt.trim() } } : d.image?.url ? {} : { image: null }),
      };
      const saved = d.id ? await put<Question>(hubPath(p.qs, `/questions/${d.id}`), body) : await post<Question>(hubPath(p.qs, "/questions"), body);
      onSaved({ ...(body as unknown as Question), ...saved, id: saved?.id ?? d.id ?? "" });
    } catch (e) { setErr(errMsg(e, "Couldn't save the question")); }
    finally { setBusy(false); }
  };

  const setOpt = (id: string, text: string) => set({ options: d.options.map((o) => (o.id === id ? { ...o, text } : o)) });
  const toggleCorrect = (id: string) => set({ correct: rule === "choice" ? [id] : d.correct.includes(id) ? d.correct.filter((x) => x !== id) : [...d.correct, id] });
  const addAccepted = () => { const v = acc.trim(); if (v && !d.accepted.includes(v)) set({ accepted: [...d.accepted, v] }); setAcc(""); };
  const setOptPic = (id: string, image: Pic | null) => set({ options: d.options.map((o) => (o.id === id ? { ...o, image } : o)) });
  // The preview shows the arrangement a child would get: the key nudged out of place (the server does the real shuffle per attempt).
  const rot = <T,>(a: T[]) => (a.length > 1 ? [...a.slice(1), a[0]] : a);
  // What a child would be dealt: one sample problem for the chosen generator (a fixed number pins it; otherwise "Try another" isn't needed — each attempt gets its own).
  const [sample, setSample] = useState(1);
  const toolProblem = rule === "tool" && PROBLEM_GENERATORS[d.toolGen] ? publicProblem(PROBLEM_GENERATORS[d.toolGen]!(d.toolSeed.trim() && Number(d.toolSeed) >= 1 ? Number(d.toolSeed) : sample)) : undefined;
  const previewQ = {
    toolProblem,
    id: "preview", prompt: d.prompt, marks: Math.max(1, Math.round(Number(d.marks) || 1)), options: filled, image: d.image?.url ? { url: d.image.url, alt: d.imageAlt } : null,
    terms: fullPairs.map((x) => ({ text: x.term.trim(), ...(x.termImage ? { image: x.termImage } : {}) })),
    definitions: rot(fullPairs).map((x) => ({ text: x.definition.trim(), ...(x.definitionImage ? { image: x.definitionImage } : {}) })),
    items: rot(fullItems).map((x) => x.text.trim()),
  };
  const setPair = (id: string, patch: Partial<PairRow>) => set({ pairs: d.pairs.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setItem = (id: string, text: string) => set({ items: d.items.map((x) => (x.id === id ? { ...x, text } : x)) });
  const moveItem = (i: number, by: -1 | 1) => { const a = [...d.items]; const j = i + by; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ items: a }); };
  // Paste a screenshot / copied picture anywhere in the form to attach it to the question.
  const onPaste = (e: React.ClipboardEvent) => {
    const f = imageFrom(e.clipboardData);
    if (!f) return;
    e.preventDefault();
    setPasted(f);
  };
  const [pasted, setPasted] = useState<File | null>(null);

  return (
    <Modal wide title={d.id ? "Edit question" : "New question"} onClose={onClose} id="hub-question-form"
      footer={<>
        <Button variant="ghost" className={TAP} onClick={onClose}>Cancel</Button>
        <Button variant="solid" className={`${TAP} !px-6`} onClick={save} disabled={busy} data-testid="hub-save-question">{busy ? "Saving…" : "Save question"}</Button>
      </>}>
      <div className="grid gap-5 md:grid-cols-[1fr_320px]" onPaste={onPaste}>
        <div className="grid content-start gap-4">
          {err && <Notice onDismiss={() => setErr(null)}>{err}</Notice>}
          <div className="grid gap-4">
            <div>
              <FieldLabel htmlFor="hq-topic">Topic</FieldLabel>
              <TopicPicker id="hq-topic" topics={topics} value={d.topicId} onChange={(topicId) => set({ topicId })}
                deleteSubject={p.canEdit && !p.readOnly ? { qs: p.qs, done: (subject) => { forgetSubject(subject); setD((x) => (topics.find((t) => t.id === x.topicId)?.subject.toLowerCase() === subject.toLowerCase() ? { ...x, topicId: topics.find((t) => t.subject.toLowerCase() !== subject.toLowerCase())?.id ?? "" } : x)); } } : undefined} />
              <NewTopicInline qs={p.qs} topics={topics} subject={topics.find((t) => t.id === d.topicId)?.subject} canCreate={p.canEdit && !p.readOnly} testId="question-new-topic"
                onCreated={(t) => { rememberTopic(t); set({ topicId: t.id }); }} />
            </div>
            <div>
              <span id="hq-kind-label" className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Question type</span>
              <div role="radiogroup" aria-labelledby="hq-kind-label" id="hq-kind" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {kinds.map((k) => {
                  const on = k.id === d.kind;
                  const m = KIND_LOOK[k.mark] ?? KIND_LOOK.manual!;
                  return (
                    <button key={k.id} type="button" role="radio" aria-checked={on} onClick={() => changeKind(k.id)} data-testid={`hq-kind-${k.id}`}
                      className={`flex items-start gap-2 rounded-xl border-2 p-2 text-left transition ${FOCUS} ${on ? "border-[var(--brand-2)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand-2)]"}`}>
                      <span aria-hidden className="text-[18px] leading-none">{m.icon}</span>
                      <span className="min-w-0"><span className="block text-[13px] font-extrabold text-[var(--ink)]">{k.label}</span><span className="block text-[11.5px] leading-snug text-[var(--ink-2)]">{m.hint}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <span id="hq-years-label" className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Year groups <span className="normal-case tracking-normal">· who is this question for?</span></span>
            <div role="group" aria-labelledby="hq-years-label" className="flex flex-wrap gap-1.5" data-testid="hq-years">
              {p.config.yearGroups.map((y) => {
                const on = d.yearGroups.includes(y);
                return <button key={y} type="button" aria-pressed={on} onClick={() => set({ yearGroups: on ? d.yearGroups.filter((x) => x !== y) : [...d.yearGroups, y] })}
                  className={`min-h-[36px] rounded-full border px-3 text-[12.5px] font-bold transition ${FOCUS} ${on ? "border-[var(--brand-2)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}>{y}</button>;
              })}
            </div>
            {d.yearGroups.length === 0 && <p className="m-0 mt-1 text-[11.5px] text-[var(--ink-3)]">Not set — pick the year groups so it only turns up in the right quizzes.</p>}
          </div>

          <div>
            <FieldLabel htmlFor="hq-prompt">Question</FieldLabel>
            <textarea id="hq-prompt" data-autofocus rows={3} value={d.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder="e.g. Solve x² − 5x + 6 = 0"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            {rule !== "tool" && (() => { const t = topics.find((x) => x.id === d.topicId); return t ? <QuestionTools variant="tutor" prompt={d.prompt} ctx={{ subject: t.subject, year: yearFromLabel(d.yearGroups[0]), unit: [t.topic, t.subtopic].filter(Boolean).join(" ") }} /> : null; })()}
          </div>

          <ImageField value={d.image} alt={d.imageAlt} onPic={(p) => set({ image: p, imageAlt: p ? d.imageAlt : "" })} onAlt={(a) => set({ imageAlt: a })} altError={!!d.image && !d.imageAlt.trim()} pasted={pasted} onPastedTaken={() => setPasted(null)} />

          {(rule === "choice" || rule === "multi") && (
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-1.5 p-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Options <span className="normal-case tracking-normal">· tick {rule === "choice" ? "the correct one" : "every correct one"}. Add a picture to any option to make a picture-answer question.</span></legend>
              <div className="grid gap-2">
                {d.options.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <label className={`grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-xl border-2 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--brand)] ${d.correct.includes(o.id) ? "border-[var(--green)] bg-[var(--green-soft)]" : "border-[var(--line)] bg-[var(--surface)]"}`} title="Correct answer">
                      <input type={rule === "choice" ? "radio" : "checkbox"} name="hq-correct" checked={d.correct.includes(o.id)} onChange={() => toggleCorrect(o.id)} className="sr-only" aria-label={`Option ${i + 1} is correct`} />
                      <span aria-hidden className="text-[16px] font-extrabold" style={{ color: d.correct.includes(o.id) ? "var(--hub-green-ink)" : "var(--ink-3)" }}>{d.correct.includes(o.id) ? "✓" : String.fromCharCode(65 + i)}</span>
                    </label>
                    <Input aria-label={`Option ${i + 1} text`} value={o.text} onChange={(e) => setOpt(o.id, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="min-h-[44px] min-w-0 flex-1" />
                    <OptionPic value={o.image} label={`Option ${i + 1}`} onPic={(p) => setOptPic(o.id, p)} />
                    <button type="button" aria-label={`Remove option ${i + 1}`} disabled={d.options.length <= 2} onClick={() => set({ options: d.options.filter((x) => x.id !== o.id), correct: d.correct.filter((x) => x !== o.id) })} className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[18px] text-[var(--ink-3)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>×</button>
                  </div>
                ))}
              </div>
              {d.options.length < 8 && <button type="button" onClick={() => set({ options: [...d.options, { id: newOptionId(), text: "" }] })} className={`mt-2 min-h-[44px] rounded-lg px-2 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>+ Add an option</button>}
            </fieldset>
          )}

          {rule === "match" && (
            <fieldset className="m-0 min-w-0 border-0 p-0" data-testid="hub-match-editor">
              <legend className="mb-1.5 p-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Pairs <span className="normal-case tracking-normal">· {MATCH_MIN} to {MATCH_MAX}. Students see the terms in this order and the matches shuffled.</span></legend>
              <div className="grid gap-2">
                {d.pairs.map((x, i) => (
                  <div key={x.id} className="flex items-center gap-2">
                    <Input aria-label={`Pair ${i + 1} term`} value={x.term} onChange={(e) => setPair(x.id, { term: e.target.value })} placeholder="Term" maxLength={300} className="min-h-[44px] min-w-0 flex-1" />
                    <span aria-hidden className="flex-none text-[var(--ink-3)]">↔</span>
                    <Input aria-label={`Pair ${i + 1} match`} value={x.definition} onChange={(e) => setPair(x.id, { definition: e.target.value })} placeholder="Its match" maxLength={300} className="min-h-[44px] min-w-0 flex-[1.4]" />
                    <button type="button" aria-label={`Remove pair ${i + 1}`} disabled={d.pairs.length <= MATCH_MIN} onClick={() => set({ pairs: d.pairs.filter((y) => y.id !== x.id) })} className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[18px] text-[var(--ink-3)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>×</button>
                  </div>
                ))}
              </div>
              {d.pairs.length < MATCH_MAX && <button type="button" onClick={() => set({ pairs: [...d.pairs, { id: newOptionId(), term: "", definition: "" }] })} className={`mt-2 min-h-[44px] rounded-lg px-2 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>+ Add a pair</button>}
              {d.pairs.some((x) => x.termImage || x.definitionImage) && <p className="m-0 mt-1 text-[11.5px] text-[var(--ink-3)]">Pictures that came with this question are kept as they are.</p>}
            </fieldset>
          )}

          {rule === "order" && (
            <fieldset className="m-0 min-w-0 border-0 p-0" data-testid="hub-order-editor">
              <legend className="mb-1.5 p-0 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Items <span className="normal-case tracking-normal">· write them in the CORRECT order, first to last ({ORDER_MIN} to {ORDER_MAX}). Students get them shuffled.</span></legend>
              <div className="grid gap-2">
                {d.items.map((x, i) => (
                  <div key={x.id} className="flex items-center gap-2">
                    <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[12.5px] font-extrabold text-[var(--brand-strong)]">{i + 1}</span>
                    <Input aria-label={`Item ${i + 1}`} value={x.text} onChange={(e) => setItem(x.id, e.target.value)} placeholder={i === 0 ? "First" : i === d.items.length - 1 ? "Last" : "Next"} maxLength={300} className="min-h-[44px] min-w-0 flex-1" />
                    <button type="button" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => moveItem(i, -1)} className={`grid h-11 w-9 flex-none place-items-center rounded-xl text-[15px] text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>↑</button>
                    <button type="button" aria-label={`Move item ${i + 1} down`} disabled={i === d.items.length - 1} onClick={() => moveItem(i, 1)} className={`grid h-11 w-9 flex-none place-items-center rounded-xl text-[15px] text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>↓</button>
                    <button type="button" aria-label={`Remove item ${i + 1}`} disabled={d.items.length <= ORDER_MIN} onClick={() => set({ items: d.items.filter((y) => y.id !== x.id) })} className={`grid h-11 w-11 flex-none place-items-center rounded-xl text-[18px] text-[var(--ink-3)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>×</button>
                  </div>
                ))}
              </div>
              {d.items.length < ORDER_MAX && <button type="button" onClick={() => set({ items: [...d.items, { id: newOptionId(), text: "" }] })} className={`mt-2 min-h-[44px] rounded-lg px-2 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>+ Add an item</button>}
            </fieldset>
          )}

          {rule === "exact" && (
            <div className="grid gap-3">
              <div>
                <FieldLabel htmlFor="hq-exact">Correct answer</FieldLabel>
                <Input id="hq-exact" value={d.exact} onChange={(e) => set({ exact: e.target.value })} placeholder="e.g. photosynthesis" className="min-h-[44px] w-full" />
                <p className="m-0 mt-1 text-[11.5px] text-[var(--ink-3)]">Capital letters and extra spaces are ignored when a student is marked.</p>
              </div>
              <div>
                <FieldLabel htmlFor="hq-accepted">Also accept <span className="normal-case tracking-normal">(optional)</span></FieldLabel>
                <div className="flex gap-2">
                  <Input id="hq-accepted" value={acc} onChange={(e) => setAcc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAccepted(); } }} placeholder="Another answer that's also right" className="min-h-[44px] min-w-0 flex-1" />
                  <Button variant="ghost" className={TAP} onClick={addAccepted} disabled={!acc.trim()}>Add</Button>
                </div>
                {d.accepted.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.accepted.map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-soft)] py-0.5 pl-3 pr-1 text-[12px] font-bold text-[var(--brand-strong)]">{a}
                        <button type="button" aria-label={`Remove ${a}`} onClick={() => set({ accepted: d.accepted.filter((x) => x !== a) })} className={`grid h-7 w-7 place-items-center rounded-full hover:bg-white/60 ${FOCUS}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {rule === "numeric" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="hq-num">Correct number</FieldLabel>
                <Input id="hq-num" inputMode="decimal" value={d.numeric} onChange={(e) => set({ numeric: e.target.value })} placeholder="e.g. 3.14" className="min-h-[44px] w-full tabular-nums" />
              </div>
              <div>
                <FieldLabel htmlFor="hq-tol">Allowed error ±</FieldLabel>
                <Input id="hq-tol" inputMode="decimal" value={d.tolerance} onChange={(e) => set({ tolerance: e.target.value })} placeholder="0" className="min-h-[44px] w-full tabular-nums" />
              </div>
            </div>
          )}

          {rule === "tool" && (
            <div className="grid gap-3">
              <Notice tone="info"><b>Marked automatically.</b> The child works with real instruments (ruler, protractor, compasses, coordinate grid) and the answer is checked in millimetres and degrees. Unless you fix the problem, every child — and every retake — gets fresh numbers.</Notice>
              <div>
                <FieldLabel htmlFor="hq-toolgen">What does the pupil have to do?</FieldLabel>
                <select id="hq-toolgen" value={d.toolGen} onChange={(e) => set({ toolGen: e.target.value })} className={`min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
                  <option value="">Choose…</option>
                  {Object.entries(GENERATOR_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <FieldLabel htmlFor="hq-toolseed">Same problem every time <span className="normal-case tracking-normal">(optional — a number pins one exact problem)</span></FieldLabel>
                  <Input id="hq-toolseed" inputMode="numeric" value={d.toolSeed} onChange={(e) => set({ toolSeed: e.target.value.replace(/\D/g, "") })} placeholder="blank = new numbers each attempt" className="min-h-[44px] w-64 tabular-nums" />
                </div>
                {!d.toolSeed.trim() && d.toolGen && <Button onClick={() => setSample((x) => x + 1)}>Show another example</Button>}
              </div>
              {d.toolGen && <p className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">The question wording is generated from the problem. Anything you write above appears first as extra instructions.</p>}
            </div>
          )}

          {rule === "manual" && <Notice tone="info"><b>Written, you mark this.</b> Students type an answer and you mark it by hand in the Marking tab. Until you do, a quiz that includes it shows the auto-marked score with this part still to be reviewed.</Notice>}

          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div>
              <FieldLabel htmlFor="hq-marks">Marks</FieldLabel>
              <Input id="hq-marks" type="number" min={1} max={100} value={d.marks} onChange={(e) => set({ marks: e.target.value })} className="min-h-[44px] w-full tabular-nums" />
            </div>
            <div className="flex items-end"><Switch on={d.published} onChange={(v) => set({ published: v })} label={d.published ? "Published, can be used in quizzes" : "Draft, hidden from quizzes"} /></div>
          </div>

          <div>
            <FieldLabel htmlFor="hq-expl">Explanation <span className="normal-case tracking-normal">(shown to students after marking, if your Teaching Hub settings allow)</span></FieldLabel>
            <textarea id="hq-expl" rows={2} value={d.explanation} onChange={(e) => set({ explanation: e.target.value })} placeholder="Why is that the right answer?"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
          </div>
        </div>

        <aside aria-label="Student preview" className="md:sticky md:top-0 md:self-start">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">What the student sees</div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
            <div className="rounded-xl bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)]">
              <QuestionView key={d.kind} q={previewQ} rule={rule} value={preview} onChange={setPreview} />
            </div>
            <p className="m-0 mt-2 text-[11px] text-[var(--ink-3)]">Try it. Nothing here is saved or marked.</p>
          </div>
          <div className="mt-3 text-[11px] text-[var(--ink-3)]" style={display}>{problems.length ? `${problems.length} thing${problems.length === 1 ? "" : "s"} to fix: ${problems.join(" ")}` : "Ready to save."}</div>
        </aside>
      </div>
    </Modal>
  );
}

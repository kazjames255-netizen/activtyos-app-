"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui";
import { ImageField } from "../../quiz/ImageField";
import type { Pic } from "../../shared-assess/api";
import { FOCUS } from "../../kit";
import { LessonStyles } from "../lessonUi";
import { SlideDeck } from "../slides/SlideDeck";
import { KIND_LABEL, type Block, type Slide, type SlideKind } from "../slides/types";

// The tutor's slide builder — the "New lesson" editor for an interactive lesson. It writes exactly what an imported lesson
// stores (`lesson.slides`: a title band + a stack of blocks, optionally a picture), so the lesson plays in the same player:
// slides, tap-to-reveal, multiple choice, sorting, matching, key words. Inline markup in any text: **bold** and {highlight}.

// ── block catalogue ────────────────────────────────────────────────────────
type BlockT = "text" | "lead" | "callout" | "list" | "define" | "reveal" | "choice" | "sort" | "match";
const CATALOGUE: { t: BlockT; label: string; hint: string; icon: string; make: () => Block }[] = [
  { t: "text", label: "Paragraph", hint: "Normal text", icon: "¶", make: () => ({ t: "text", text: "" }) },
  { t: "lead", label: "Big text", hint: "A large line to open with", icon: "A", make: () => ({ t: "lead", text: "" }) },
  { t: "callout", label: "Highlight box", hint: "A rule or tip to remember", icon: "💡", make: () => ({ t: "callout", text: "" }) },
  { t: "list", label: "Bullet list", hint: "Points, one per line", icon: "≡", make: () => ({ t: "list", items: ["", ""] }) },
  { t: "define", label: "Key words", hint: "Tap a word to see its meaning", icon: "📖", make: () => ({ t: "define", items: [{ term: "", def: "" }] }) },
  { t: "reveal", label: "Tap to reveal", hint: "Hide an answer until tapped", icon: "👆", make: () => ({ t: "reveal", label: "Show the answer", text: "" }) },
  { t: "choice", label: "Multiple choice", hint: "One question, tap the right answer", icon: "✅", make: () => ({ t: "choice", q: "", options: ["", "", ""], answer: 0, why: "" }) },
  { t: "sort", label: "Sorting", hint: "Tap a word, then its column", icon: "🗂️", make: () => ({ t: "sort", q: "", columns: ["", ""], items: [{ text: "", col: 0 }, { text: "", col: 1 }] }) },
  { t: "match", label: "Matching", hint: "Pair each left item with its right", icon: "🔗", make: () => ({ t: "match", q: "", pairs: [{ a: "", b: "" }, { a: "", b: "" }] }) },
];
const NAME: Record<string, string> = Object.fromEntries(CATALOGUE.map((c) => [c.t, c.label]));

const TEMPLATES: { id: string; label: string; hint: string; make: () => Slide }[] = [
  { id: "explain", label: "Explain", hint: "Title and text", make: () => ({ kind: "explain", title: "", blocks: [{ t: "text", text: "" }] }) },
  { id: "question", label: "Question", hint: "Multiple choice", make: () => ({ kind: "check", title: "", blocks: [{ t: "choice", q: "", options: ["", "", ""], answer: 0, why: "" }] }) },
  { id: "words", label: "Key words", hint: "Tap for meanings", make: () => ({ kind: "explain", title: "Key words", blocks: [{ t: "define", items: [{ term: "", def: "" }] }] }) },
  { id: "picture", label: "Picture", hint: "A photo with a caption", make: () => ({ kind: "explain", title: "", blocks: [{ t: "text", text: "" }] }) },
];

// ── emptiness / validation ─────────────────────────────────────────────────
const blank = (v: unknown) => typeof v !== "string" || !v.trim();
/** A block with nothing filled in — dropped on save. */
function emptyBlock(b: Block): boolean {
  switch (b.t) {
    case "text": case "lead": case "callout": return blank(b.text);
    case "list": return b.items.every(blank);
    case "define": return b.items.every((x) => blank(x.term) && blank(x.def));
    case "reveal": return blank(b.text);
    case "choice": return blank(b.q) && b.options.every(blank);
    case "sort": return blank(b.q) && b.items.every((x) => blank(x.text));
    case "match": return blank(b.q) && b.pairs.every((p) => blank(p.a) && blank(p.b));
    default: return false;
  }
}
/** Trim a block to what the player can use, or a reason it can't be saved. */
function tidyBlock(b: Block): { block: Block } | { error: string } {
  switch (b.t) {
    case "text": case "lead": case "callout": return { block: { ...b, text: b.text.trim() } };
    case "list": return { block: { ...b, items: b.items.map((x) => x.trim()).filter(Boolean) } };
    case "define": {
      const items = b.items.filter((x) => !(blank(x.term) && blank(x.def))).map((x) => ({ term: x.term.trim(), def: x.def.trim() }));
      if (items.some((x) => !x.term || !x.def)) return { error: "each key word needs both the word and its meaning" };
      return { block: { ...b, items } };
    }
    case "reveal": return { block: { ...b, label: b.label?.trim() || "Show the answer", text: b.text.trim() } };
    case "choice": {
      if (blank(b.q)) return { error: "the multiple-choice question has no question" };
      const kept = b.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      if (kept.length < 2) return { error: "a multiple-choice question needs at least two answers" };
      const answer = kept.findIndex((x) => x.i === b.answer);
      if (answer < 0) return { error: "pick which answer is right in the multiple-choice question" };
      return { block: { t: "choice", q: b.q.trim(), options: kept.map((x) => x.o), answer, ...(b.why?.trim() ? { why: b.why.trim() } : {}) } };
    }
    case "sort": {
      const columns = b.columns.map((c) => c.trim());
      if (blank(b.q)) return { error: "the sorting activity has no instruction" };
      if (columns.some((c) => !c)) return { error: "every sorting column needs a name" };
      const items = b.items.filter((x) => !blank(x.text)).map((x) => ({ text: x.text.trim(), col: x.col }));
      if (items.length < 2) return { error: "a sorting activity needs at least two words to sort" };
      return { block: { ...b, q: b.q.trim(), columns, items } };
    }
    case "match": {
      const pairs = b.pairs.filter((p) => !(blank(p.a) && blank(p.b)));
      if (blank(b.q)) return { error: "the matching activity has no instruction" };
      if (pairs.length < 2 || pairs.some((p) => blank(p.a) || blank(p.b))) return { error: "a matching activity needs at least two complete pairs" };
      return { block: { ...b, q: b.q.trim(), pairs: pairs.map((p) => ({ a: p.a.trim(), b: p.b.trim() })) } };
    }
    default: return { block: b };
  }
}
/** The deck ready to save (empty blocks / slides dropped), or the first problem in plain words. */
export function finishSlides(slides: Slide[]): { slides: Slide[] } | { error: string } {
  const out: Slide[] = [];
  for (const [n, s] of slides.entries()) {
    const blocks: Block[] = [];
    for (const b of s.blocks) {
      if (emptyBlock(b)) continue;
      const r = tidyBlock(b);
      if ("error" in r) return { error: `Slide ${n + 1}: ${r.error}.` };
      blocks.push(r.block);
    }
    if (!blocks.length && !s.title.trim() && !s.image) continue; // an untouched slide
    if (!blocks.length) return { error: `Slide ${n + 1} has no content — add some text or an activity, or delete the slide.` };
    if (s.image && blank(s.image.alt)) return { error: `Slide ${n + 1}: describe the picture (alt text) so it works for everyone.` };
    out.push({ ...s, title: s.title.trim(), blocks });
  }
  return { slides: out };
}
/** A plain-text version of the deck (search, screen readers, "text only" view). */
export function slidesToText(slides: Slide[]): string {
  const lines: string[] = [];
  for (const s of slides) {
    if (s.title.trim()) lines.push(`## ${s.title.trim()}`, "");
    for (const b of s.blocks) {
      if (b.t === "text" || b.t === "lead" || b.t === "callout") lines.push(b.text, "");
      else if (b.t === "list") lines.push(...b.items.map((x) => `- ${x}`), "");
      else if (b.t === "define") lines.push(...b.items.map((x) => `- **${x.term}**: ${x.def}`), "");
      else if (b.t === "choice") lines.push(`Question: ${b.q}`, "");
    }
  }
  return lines.join("\n").replace(/[{}]/g, "").trim();
}
export const newSlide = (): Slide => TEMPLATES[0]!.make();

// ── small field helpers ────────────────────────────────────────────────────
const labelCls = "mb-1 block text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]";
const areaCls = `w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[14px] leading-[1.5] text-[var(--ink)] focus:border-[var(--brand-2)] ${FOCUS}`;
const iconBtn = `grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px] font-black text-[var(--ink-2)] hover:bg-[var(--panel)] hover:text-[var(--ink)] disabled:opacity-30 ${FOCUS}`;

function Text({ label, value, onChange, rows, placeholder, testId }: { label?: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; testId?: string }) {
  return (
    <label className="block">
      {label && <span className={labelCls}>{label}</span>}
      {rows
        ? <textarea rows={rows} value={value} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} className={areaCls} />
        : <Input value={value} placeholder={placeholder} data-testid={testId} onChange={(e) => onChange(e.target.value)} className="min-h-[40px] w-full" />}
    </label>
  );
}
const AddRow = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className={`justify-self-start rounded-full px-2 py-1 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>+ {children}</button>
);
const Remove = ({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) => (
  <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={iconBtn}>✕</button>
);
const swap = <T,>(a: T[], i: number, j: number) => { const n = [...a]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; };

// ── one block's editor ─────────────────────────────────────────────────────
function BlockEditor({ b, onChange }: { b: Block; onChange: (b: Block) => void }) {
  switch (b.t) {
    case "text": case "lead": case "callout":
      return <Text value={b.text} rows={b.t === "lead" ? 2 : 4} onChange={(text) => onChange({ ...b, text })} placeholder={b.t === "callout" ? "e.g. Multiply the length by the width" : "Type your text. **bold**, {highlight}"} />;
    case "list":
      return (
        <div className="grid gap-1.5">
          {b.items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input value={it} placeholder={`Point ${i + 1}`} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? e.target.value : x)) })} className="min-h-[40px] w-full" />
              <Remove label={`Remove point ${i + 1}`} disabled={b.items.length <= 1} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })} />
            </div>
          ))}
          <AddRow onClick={() => onChange({ ...b, items: [...b.items, ""] })}>Add a point</AddRow>
        </div>
      );
    case "define":
      return (
        <div className="grid gap-2">
          {b.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-1.5 rounded-xl bg-[var(--panel)] p-2">
              <div className="grid gap-1.5">
                <Input value={it.term} placeholder="Word" aria-label={`Word ${i + 1}`} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, term: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                <Input value={it.def} placeholder="What it means" aria-label={`Meaning ${i + 1}`} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, def: e.target.value } : x)) })} className="min-h-[40px] w-full" />
              </div>
              <Remove label={`Remove word ${i + 1}`} disabled={b.items.length <= 1} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })} />
            </div>
          ))}
          <AddRow onClick={() => onChange({ ...b, items: [...b.items, { term: "", def: "" }] })}>Add a word</AddRow>
        </div>
      );
    case "reveal":
      return (
        <div className="grid gap-2">
          <Text label="Button says" value={b.label ?? ""} onChange={(label) => onChange({ ...b, label })} placeholder="Show the answer" />
          <Text label="Hidden text" value={b.text} rows={2} onChange={(text) => onChange({ ...b, text })} placeholder="What appears when it is tapped" />
        </div>
      );
    case "choice":
      return (
        <div className="grid gap-2">
          <Text label="Question" value={b.q} rows={2} onChange={(q) => onChange({ ...b, q })} placeholder="e.g. What is 3 × 4?" testId="sb-choice-q" />
          <div>
            <span className={labelCls}>Answers — tap the circle beside the right one</span>
            <div className="grid gap-1.5" role="radiogroup" aria-label="Correct answer">
              {b.options.map((o, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <button type="button" role="radio" aria-checked={b.answer === i} aria-label={`Answer ${i + 1} is correct`} onClick={() => onChange({ ...b, answer: i })}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[13px] font-black ${FOCUS}`}
                    style={b.answer === i ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : { borderColor: "var(--line)", color: "transparent" }}>✓</button>
                  <Input value={o} placeholder={`Answer ${i + 1}`} data-testid={`sb-choice-opt-${i}`} onChange={(e) => onChange({ ...b, options: b.options.map((x, k) => (k === i ? e.target.value : x)) })} className="min-h-[40px] w-full" />
                  <Remove label={`Remove answer ${i + 1}`} disabled={b.options.length <= 2}
                    onClick={() => onChange({ ...b, options: b.options.filter((_, k) => k !== i), answer: b.answer === i ? 0 : b.answer > i ? b.answer - 1 : b.answer })} />
                </div>
              ))}
              {b.options.length < 6 && <AddRow onClick={() => onChange({ ...b, options: [...b.options, ""] })}>Add an answer</AddRow>}
            </div>
          </div>
          <Text label="Why it's right (optional)" value={b.why ?? ""} onChange={(why) => onChange({ ...b, why })} placeholder="Shown after the pupil answers" />
        </div>
      );
    case "sort":
      return (
        <div className="grid gap-2">
          <Text label="Instruction" value={b.q} onChange={(q) => onChange({ ...b, q })} placeholder="e.g. Sort these into living and non-living" />
          <div>
            <span className={labelCls}>Columns</span>
            <div className="flex flex-wrap gap-1.5">
              {b.columns.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input value={c} placeholder={`Column ${i + 1}`} aria-label={`Column ${i + 1}`} onChange={(e) => onChange({ ...b, columns: b.columns.map((x, k) => (k === i ? e.target.value : x)) })} className="min-h-[40px] w-[150px]" />
                  <Remove label={`Remove column ${i + 1}`} disabled={b.columns.length <= 2}
                    onClick={() => onChange({ ...b, columns: b.columns.filter((_, k) => k !== i), items: b.items.map((x) => ({ ...x, col: x.col === i ? 0 : x.col > i ? x.col - 1 : x.col })) })} />
                </div>
              ))}
              {b.columns.length < 4 && <AddRow onClick={() => onChange({ ...b, columns: [...b.columns, ""] })}>Column</AddRow>}
            </div>
          </div>
          <div>
            <span className={labelCls}>Words and where they belong</span>
            <div className="grid gap-1.5">
              {b.items.map((it, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input value={it.text} placeholder={`Word ${i + 1}`} aria-label={`Word ${i + 1}`} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                  <select aria-label={`Column for word ${i + 1}`} value={it.col} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, col: Number(e.target.value) } : x)) })}
                    className={`min-h-[40px] max-w-[45%] shrink-0 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] text-[var(--ink)] ${FOCUS}`}>
                    {b.columns.map((c, ci) => <option key={ci} value={ci}>{c.trim() || `Column ${ci + 1}`}</option>)}
                  </select>
                  <Remove label={`Remove word ${i + 1}`} disabled={b.items.length <= 2} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })} />
                </div>
              ))}
              <AddRow onClick={() => onChange({ ...b, items: [...b.items, { text: "", col: 0 }] })}>Add a word</AddRow>
            </div>
          </div>
        </div>
      );
    case "match":
      return (
        <div className="grid gap-2">
          <Text label="Instruction" value={b.q} onChange={(q) => onChange({ ...b, q })} placeholder="e.g. Match each shape to its number of sides" />
          <div className="grid gap-1.5">
            {b.pairs.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input value={p.a} placeholder="Left" aria-label={`Left ${i + 1}`} onChange={(e) => onChange({ ...b, pairs: b.pairs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                <span aria-hidden className="text-[var(--ink-3)]">↔</span>
                <Input value={p.b} placeholder="Right" aria-label={`Right ${i + 1}`} onChange={(e) => onChange({ ...b, pairs: b.pairs.map((x, k) => (k === i ? { ...x, b: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                <Remove label={`Remove pair ${i + 1}`} disabled={b.pairs.length <= 2} onClick={() => onChange({ ...b, pairs: b.pairs.filter((_, k) => k !== i) })} />
              </div>
            ))}
            {b.pairs.length < 8 && <AddRow onClick={() => onChange({ ...b, pairs: [...b.pairs, { a: "", b: "" }] })}>Add a pair</AddRow>}
          </div>
        </div>
      );
    default:
      return <p className="m-0 text-[13px] text-[var(--ink-3)]">This part can&apos;t be edited here.</p>;
  }
}

// ── the builder ────────────────────────────────────────────────────────────
export function SlideBuilder({ slides, onChange, disabled = false }: { slides: Slide[]; onChange: (s: Slide[]) => void; disabled?: boolean }) {
  const [sel, setSel] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [preview, setPreview] = useState(false);
  const idx = Math.min(sel, Math.max(0, slides.length - 1));
  const slide = slides[idx];

  const setSlide = (s: Slide) => onChange(slides.map((x, i) => (i === idx ? s : x)));
  const setBlock = (bi: number, b: Block) => setSlide({ ...slide!, blocks: slide!.blocks.map((x, i) => (i === bi ? b : x)) });
  const addSlide = (make: () => Slide) => { onChange([...slides.slice(0, idx + 1), make(), ...slides.slice(idx + 1)]); setSel(slides.length ? idx + 1 : 0); setAdding(false); setPreview(false); };
  const dropSlide = () => { onChange(slides.filter((_, i) => i !== idx)); setSel(Math.max(0, idx - 1)); };
  const dupSlide = () => { onChange([...slides.slice(0, idx + 1), JSON.parse(JSON.stringify(slide)) as Slide, ...slides.slice(idx + 1)]); setSel(idx + 1); };
  const moveSlide = (d: -1 | 1) => { onChange(swap(slides, idx, idx + d)); setSel(idx + d); };

  const pic: Pic | null = slide?.image ? { id: slide.image.id, url: slide.image.url, alt: slide.image.alt } : null;
  const titleOf = (s: Slide, i: number) => s.title.trim() || (s.blocks.find((b): b is Extract<Block, { t: "text" | "lead" }> => b.t === "text" || b.t === "lead")?.text.trim().slice(0, 40)) || `Slide ${i + 1}`;

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2.5 sm:p-3" data-testid="slide-builder">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Slides">
        {slides.map((s, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === idx} disabled={disabled} onClick={() => { setSel(i); setPreview(false); }} data-testid={`sb-slide-${i}`}
            className={`min-h-[52px] w-[128px] shrink-0 rounded-xl border-2 px-2.5 py-1.5 text-left transition ${FOCUS} ${i === idx ? "border-[var(--brand-2)] bg-[var(--surface)] shadow-sm" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand-2)]"}`}>
            <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Slide {i + 1}</span>
            <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{titleOf(s, i)}</span>
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={() => setAdding((v) => !v)} aria-expanded={adding} data-testid="sb-new-slide"
          className={`min-h-[52px] shrink-0 rounded-xl border-2 border-dashed border-[var(--brand-2)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--surface)] ${FOCUS}`}>+ New slide</button>
      </div>

      {adding && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="menu" aria-label="Choose a slide layout">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" role="menuitem" onClick={() => addSlide(t.make)} data-testid={`sb-template-${t.id}`}
              className={`rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-2.5 text-left hover:border-[var(--brand-2)] ${FOCUS}`}>
              <span className="block text-[13px] font-extrabold text-[var(--ink)]">{t.label}</span>
              <span className="block text-[11.5px] text-[var(--ink-2)]">{t.hint}</span>
            </button>
          ))}
        </div>
      )}

      {!slide ? (
        <div className="rounded-xl bg-[var(--surface)] px-4 py-8 text-center">
          <p className="m-0 mb-1 text-[15px] font-extrabold text-[var(--ink)]">Build your lesson slide by slide</p>
          <p className="m-0 mb-3 text-[13px] text-[var(--ink-2)]">Add text, pictures, multiple-choice questions, sorting and matching — students play it like an interactive lesson.</p>
          <button type="button" onClick={() => setAdding(true)} className={`rounded-xl bg-[var(--brand)] px-5 py-2.5 text-[14px] font-extrabold text-white ${FOCUS}`}>+ Add the first slide</button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl bg-[var(--surface)] p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-auto text-[13px] font-extrabold text-[var(--ink)]">Slide {idx + 1} of {slides.length}</span>
            <button type="button" onClick={() => setPreview((v) => !v)} aria-pressed={preview} data-testid="sb-preview"
              className={`min-h-[36px] rounded-full border-2 px-3.5 text-[12.5px] font-extrabold ${FOCUS} ${preview ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] text-[var(--brand)]"}`}>{preview ? "Back to editing" : "Preview"}</button>
            <button type="button" aria-label="Move slide earlier" disabled={idx === 0} onClick={() => moveSlide(-1)} className={iconBtn}>←</button>
            <button type="button" aria-label="Move slide later" disabled={idx === slides.length - 1} onClick={() => moveSlide(1)} className={iconBtn}>→</button>
            <button type="button" aria-label="Duplicate slide" onClick={dupSlide} className={iconBtn}>⧉</button>
            <button type="button" aria-label="Delete slide" onClick={dropSlide} data-testid="sb-delete-slide" className={`${iconBtn} hover:!bg-[var(--red-soft)] hover:!text-[var(--red)]`}>🗑</button>
          </div>

          {preview ? (
            <div className="overflow-hidden rounded-xl border border-[var(--line)] p-2" data-testid="sb-preview-pane">
              <LessonStyles />
              <SlideDeck key={JSON.stringify(slide)} slides={(() => { const r = finishSlides([slide]); return "slides" in r && r.slides.length ? r.slides : [{ ...slide, blocks: [{ t: "text", text: "Nothing on this slide yet." }] }]; })()} addXP={() => {}} onDone={() => {}} onBack={() => {}} />
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_190px]">
                <Text label="Slide title" value={slide.title} onChange={(title) => setSlide({ ...slide, title })} placeholder="e.g. Adding fractions" testId="sb-title" />
                <label className="block">
                  <span className={labelCls}>Style</span>
                  <select value={slide.kind} onChange={(e) => setSlide({ ...slide, kind: e.target.value as SlideKind })} className={`min-h-[40px] w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] text-[var(--ink)] ${FOCUS}`}>
                    {(Object.keys(KIND_LABEL) as SlideKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </label>
              </div>

              {slide.blocks.map((b, bi) => (
                <section key={bi} aria-label={NAME[b.t] ?? b.t} className="grid gap-2 rounded-xl border border-[var(--line)] p-2.5" data-testid={`sb-block-${bi}`}>
                  <div className="flex items-center gap-1">
                    <span className="mr-auto text-[12px] font-extrabold uppercase tracking-[0.05em] text-[var(--brand)]">{NAME[b.t] ?? b.t}</span>
                    <button type="button" aria-label="Move up" disabled={bi === 0} onClick={() => setSlide({ ...slide, blocks: swap(slide.blocks, bi, bi - 1) })} className={iconBtn}>↑</button>
                    <button type="button" aria-label="Move down" disabled={bi === slide.blocks.length - 1} onClick={() => setSlide({ ...slide, blocks: swap(slide.blocks, bi, bi + 1) })} className={iconBtn}>↓</button>
                    <Remove label={`Remove ${NAME[b.t] ?? "part"}`} onClick={() => setSlide({ ...slide, blocks: slide.blocks.filter((_, i) => i !== bi) })} />
                  </div>
                  <BlockEditor b={b} onChange={(nb) => setBlock(bi, nb)} />
                </section>
              ))}

              <div>
                <button type="button" onClick={() => setAddingBlock((v) => !v)} aria-expanded={addingBlock} data-testid="sb-add-block"
                  className={`min-h-[40px] rounded-xl border-2 border-dashed border-[var(--line)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:border-[var(--brand-2)] ${FOCUS}`}>+ Add to this slide</button>
                {addingBlock && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="menu" aria-label="Add to this slide">
                    {CATALOGUE.map((c) => (
                      <button key={c.t} type="button" role="menuitem" data-testid={`sb-add-${c.t}`} onClick={() => { setSlide({ ...slide, blocks: [...slide.blocks, c.make()] }); setAddingBlock(false); }}
                        className={`flex items-start gap-2 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-2 text-left hover:border-[var(--brand-2)] ${FOCUS}`}>
                        <span aria-hidden className="text-[18px] leading-none">{c.icon}</span>
                        <span><span className="block text-[13px] font-extrabold text-[var(--ink)]">{c.label}</span><span className="block text-[11.5px] leading-snug text-[var(--ink-2)]">{c.hint}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className={labelCls}>Picture (optional)</span>
                <ImageField value={pic} alt={slide.image?.alt ?? ""}
                  onPic={(p) => setSlide(p?.id ? { ...slide, image: { id: p.id, alt: slide.image?.alt ?? p.alt ?? "", ...(p.url ? { url: p.url } : {}) }, artLock: true } : (() => { const { image: _i, ...rest } = slide; void _i; return rest; })())}
                  onAlt={(alt) => slide.image && setSlide({ ...slide, image: { ...slide.image, alt } })} />
              </div>
              <p className="m-0 text-[11.5px] text-[var(--ink-3)]">Tip: use <b>**two stars**</b> for bold and <b>{"{curly brackets}"}</b> to colour a word.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

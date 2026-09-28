"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui";
import { ImageField } from "../../quiz/ImageField";
import type { Pic } from "../../shared-assess/api";
import { FOCUS } from "../../kit";
import { useT } from "@/lib/i18n/provider";
import { rich } from "../tRich";
import { LessonStyles } from "../lessonUi";
import { SlideDeck } from "../slides/SlideDeck";
import { KIND_LABEL, type Block, type Slide, type SlideKind } from "../slides/types";

// The tutor's slide builder — the "New lesson" editor for an interactive lesson. It writes exactly what an imported lesson
// stores (`lesson.slides`: a title band + a stack of blocks, optionally a picture), so the lesson plays in the same player:
// slides, tap-to-reveal, multiple choice, sorting, matching, key words. Inline markup in any text: **bold** and {highlight}.

// ── block catalogue ────────────────────────────────────────────────────────
type BlockT = "text" | "lead" | "callout" | "list" | "define" | "reveal" | "choice" | "sort" | "match";
/** `labelKey` / `hintKey` are i18n keys (resolve with t()). */
const CATALOGUE: { t: BlockT; labelKey: string; hintKey: string; icon: string; make: () => Block }[] = [
  { t: "text", labelKey: "hublessons.sbParagraph", hintKey: "hublessons.sbHintText", icon: "¶", make: () => ({ t: "text", text: "" }) },
  { t: "lead", labelKey: "hublessons.sbBigText", hintKey: "hublessons.sbHintLead", icon: "A", make: () => ({ t: "lead", text: "" }) },
  { t: "callout", labelKey: "hublessons.sbHighlight", hintKey: "hublessons.sbHintCallout", icon: "💡", make: () => ({ t: "callout", text: "" }) },
  { t: "list", labelKey: "hublessons.sbBulletList", hintKey: "hublessons.sbHintList", icon: "≡", make: () => ({ t: "list", items: ["", ""] }) },
  { t: "define", labelKey: "hublessons.keyWordsTag", hintKey: "hublessons.sbHintDefine", icon: "📖", make: () => ({ t: "define", items: [{ term: "", def: "" }] }) },
  { t: "reveal", labelKey: "hublessons.sbTapReveal", hintKey: "hublessons.sbHintReveal", icon: "👆", make: () => ({ t: "reveal", text: "" }) },
  { t: "choice", labelKey: "hublessons.sbMultipleChoice", hintKey: "hublessons.sbHintChoice", icon: "✅", make: () => ({ t: "choice", q: "", options: ["", "", ""], answer: 0, why: "" }) },
  { t: "sort", labelKey: "hublessons.sbSorting", hintKey: "hublessons.sbHintSort", icon: "🗂️", make: () => ({ t: "sort", q: "", columns: ["", ""], items: [{ text: "", col: 0 }, { text: "", col: 1 }] }) },
  { t: "match", labelKey: "hublessons.sbMatching", hintKey: "hublessons.sbHintMatch", icon: "🔗", make: () => ({ t: "match", q: "", pairs: [{ a: "", b: "" }, { a: "", b: "" }] }) },
];
const NAME_KEY: Record<string, string> = Object.fromEntries(CATALOGUE.map((c) => [c.t, c.labelKey]));

// (The "Key words" slide's title is stored DATA: KeyWordsCard recognises the slide by it, so it stays literal.)
const TEMPLATES: { id: string; labelKey: string; hintKey: string; make: () => Slide }[] = [
  { id: "explain", labelKey: "hublessons.tplExplain", hintKey: "hublessons.tplHintExplain", make: () => ({ kind: "explain", title: "", blocks: [{ t: "text", text: "" }] }) },
  { id: "question", labelKey: "hublessons.sfQuestion", hintKey: "hublessons.sbHintChoice", make: () => ({ kind: "check", title: "", blocks: [{ t: "choice", q: "", options: ["", "", ""], answer: 0, why: "" }] }) },
  { id: "words", labelKey: "hublessons.keyWordsTag", hintKey: "hublessons.tplHintWords", make: () => ({ kind: "explain", title: "Key words", blocks: [{ t: "define", items: [{ term: "", def: "" }] }] }) },
  { id: "picture", labelKey: "hublessons.csPicture", hintKey: "hublessons.tplHintPicture", make: () => ({ kind: "explain", title: "", blocks: [{ t: "text", text: "" }] }) },
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
      if (items.some((x) => !x.term || !x.def)) return { error: "hublessons.sbErrKeyWord" };
      return { block: { ...b, items } };
    }
    case "reveal": { const { label: _l, ...rest } = b; void _l; return { block: { ...rest, ...(b.label?.trim() ? { label: b.label.trim() } : {}), text: b.text.trim() } }; }
    case "choice": {
      if (blank(b.q)) return { error: "hublessons.sbErrNoQuestion" };
      const kept = b.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      if (kept.length < 2) return { error: "hublessons.sbErrTwoAnswers" };
      const answer = kept.findIndex((x) => x.i === b.answer);
      if (answer < 0) return { error: "hublessons.sbErrPickRight" };
      return { block: { t: "choice", q: b.q.trim(), options: kept.map((x) => x.o), answer, ...(b.why?.trim() ? { why: b.why.trim() } : {}) } };
    }
    case "sort": {
      const columns = b.columns.map((c) => c.trim());
      if (blank(b.q)) return { error: "hublessons.sbErrSortNoInstr" };
      if (columns.some((c) => !c)) return { error: "hublessons.sbErrSortColName" };
      const items = b.items.filter((x) => !blank(x.text)).map((x) => ({ text: x.text.trim(), col: x.col }));
      if (items.length < 2) return { error: "hublessons.sbErrSortTwoWords" };
      return { block: { ...b, q: b.q.trim(), columns, items } };
    }
    case "match": {
      const pairs = b.pairs.filter((p) => !(blank(p.a) && blank(p.b)));
      if (blank(b.q)) return { error: "hublessons.sbErrMatchNoInstr" };
      if (pairs.length < 2 || pairs.some((p) => blank(p.a) || blank(p.b))) return { error: "hublessons.sbErrMatchPairs" };
      return { block: { ...b, q: b.q.trim(), pairs: pairs.map((p) => ({ a: p.a.trim(), b: p.b.trim() })) } };
    }
    default: return { block: b };
  }
}
/** The deck ready to save (empty blocks / slides dropped), or the first problem in plain words (translated with `t`). */
export function finishSlides(slides: Slide[], t: (k: string, v?: Record<string, string | number>) => string): { slides: Slide[] } | { error: string } {
  const out: Slide[] = [];
  for (const [n, s] of slides.entries()) {
    const blocks: Block[] = [];
    for (const b of s.blocks) {
      if (emptyBlock(b)) continue;
      const r = tidyBlock(b);
      if ("error" in r) return { error: t("hublessons.sbErrSlideN", { n: n + 1, err: t(r.error) }) };
      blocks.push(r.block);
    }
    if (!blocks.length && !s.title.trim() && !s.image) continue; // an untouched slide
    if (!blocks.length) return { error: t("hublessons.sbErrNoContent", { n: n + 1 }) };
    if (s.image && blank(s.image.alt)) return { error: t("hublessons.sbErrAlt", { n: n + 1 }) };
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
  const t = useT();
  switch (b.t) {
    case "text": case "lead": case "callout":
      return <Text value={b.text} rows={b.t === "lead" ? 2 : 4} onChange={(text) => onChange({ ...b, text })} placeholder={b.t === "callout" ? t("hublessons.sbPhCallout") : t("hublessons.sbPhText")} />;
    case "list":
      return (
        <div className="grid gap-1.5">
          {b.items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input value={it} placeholder={t("hublessons.sbPointN", { n: i + 1 })} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? e.target.value : x)) })} className="min-h-[40px] w-full" />
              <Remove label={t("hublessons.sbRemovePointN", { n: i + 1 })} disabled={b.items.length <= 1} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })} />
            </div>
          ))}
          <AddRow onClick={() => onChange({ ...b, items: [...b.items, ""] })}>{t("hublessons.sbAddPoint")}</AddRow>
        </div>
      );
    case "define":
      return (
        <div className="grid gap-2">
          {b.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-1.5 rounded-xl bg-[var(--panel)] p-2">
              <div className="grid gap-1.5">
                <Input value={it.term} placeholder={t("hublessons.sfWord")} aria-label={t("hublessons.sbWordN", { n: i + 1 })} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, term: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                <Input value={it.def} placeholder={t("hublessons.sbPhMeaning")} aria-label={t("hublessons.sbMeaningN", { n: i + 1 })} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, def: e.target.value } : x)) })} className="min-h-[40px] w-full" />
              </div>
              <Remove label={t("hublessons.sbRemoveWordN", { n: i + 1 })} disabled={b.items.length <= 1} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })} />
            </div>
          ))}
          <AddRow onClick={() => onChange({ ...b, items: [...b.items, { term: "", def: "" }] })}>{t("hublessons.sbAddWord")}</AddRow>
        </div>
      );
    case "reveal":
      return (
        <div className="grid gap-2">
          <Text label={t("hublessons.sbButtonSays")} value={b.label ?? ""} onChange={(label) => onChange({ ...b, label })} placeholder={t("hublessons.bkShowAnswer")} />
          <Text label={t("hublessons.sbHiddenText")} value={b.text} rows={2} onChange={(text) => onChange({ ...b, text })} placeholder={t("hublessons.sbPhHidden")} />
        </div>
      );
    case "choice":
      return (
        <div className="grid gap-2">
          <Text label={t("hublessons.sfQuestion")} value={b.q} rows={2} onChange={(q) => onChange({ ...b, q })} placeholder={t("hublessons.sbPhChoiceQ")} testId="sb-choice-q" />
          <div>
            <span className={labelCls}>{t("hublessons.sbAnswersHelp")}</span>
            <div className="grid gap-1.5" role="radiogroup" aria-label={t("hublessons.sbCorrectAnswer")}>
              {b.options.map((o, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <button type="button" role="radio" aria-checked={b.answer === i} aria-label={t("hublessons.sbAnswerNCorrect", { n: i + 1 })} onClick={() => onChange({ ...b, answer: i })}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[13px] font-black ${FOCUS}`}
                    style={b.answer === i ? { background: "var(--green)", borderColor: "var(--green)", color: "#fff" } : { borderColor: "var(--line)", color: "transparent" }}>✓</button>
                  <Input value={o} placeholder={t("hublessons.sbAnswerN", { n: i + 1 })} data-testid={`sb-choice-opt-${i}`} onChange={(e) => onChange({ ...b, options: b.options.map((x, k) => (k === i ? e.target.value : x)) })} className="min-h-[40px] w-full" />
                  <Remove label={t("hublessons.sbRemoveAnswerN", { n: i + 1 })} disabled={b.options.length <= 2}
                    onClick={() => onChange({ ...b, options: b.options.filter((_, k) => k !== i), answer: b.answer === i ? 0 : b.answer > i ? b.answer - 1 : b.answer })} />
                </div>
              ))}
              {b.options.length < 6 && <AddRow onClick={() => onChange({ ...b, options: [...b.options, ""] })}>{t("hublessons.sbAddAnswer")}</AddRow>}
            </div>
          </div>
          <Text label={t("hublessons.sbWhyRight")} value={b.why ?? ""} onChange={(why) => onChange({ ...b, why })} placeholder={t("hublessons.sbPhWhy")} />
        </div>
      );
    case "sort":
      return (
        <div className="grid gap-2">
          <Text label={t("hublessons.sbInstruction")} value={b.q} onChange={(q) => onChange({ ...b, q })} placeholder={t("hublessons.sbPhSortQ")} />
          <div>
            <span className={labelCls}>{t("hublessons.sbColumns")}</span>
            <div className="flex flex-wrap gap-1.5">
              {b.columns.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input value={c} placeholder={t("hublessons.sbColumnN", { n: i + 1 })} aria-label={t("hublessons.sbColumnN", { n: i + 1 })} onChange={(e) => onChange({ ...b, columns: b.columns.map((x, k) => (k === i ? e.target.value : x)) })} className="min-h-[40px] w-[150px]" />
                  <Remove label={t("hublessons.sbRemoveColumnN", { n: i + 1 })} disabled={b.columns.length <= 2}
                    onClick={() => onChange({ ...b, columns: b.columns.filter((_, k) => k !== i), items: b.items.map((x) => ({ ...x, col: x.col === i ? 0 : x.col > i ? x.col - 1 : x.col })) })} />
                </div>
              ))}
              {b.columns.length < 4 && <AddRow onClick={() => onChange({ ...b, columns: [...b.columns, ""] })}>{t("hublessons.sfColumn")}</AddRow>}
            </div>
          </div>
          <div>
            <span className={labelCls}>{t("hublessons.sbWordsBelong")}</span>
            <div className="grid gap-1.5">
              {b.items.map((it, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Input value={it.text} placeholder={t("hublessons.sbWordN", { n: i + 1 })} aria-label={t("hublessons.sbWordN", { n: i + 1 })} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                  <select aria-label={t("hublessons.sbColumnForWordN", { n: i + 1 })} value={it.col} onChange={(e) => onChange({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, col: Number(e.target.value) } : x)) })}
                    className={`min-h-[40px] max-w-[45%] shrink-0 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] text-[var(--ink)] ${FOCUS}`}>
                    {b.columns.map((c, ci) => <option key={ci} value={ci}>{c.trim() || t("hublessons.sbColumnN", { n: ci + 1 })}</option>)}
                  </select>
                  <Remove label={t("hublessons.sbRemoveWordN", { n: i + 1 })} disabled={b.items.length <= 2} onClick={() => onChange({ ...b, items: b.items.filter((_, k) => k !== i) })} />
                </div>
              ))}
              <AddRow onClick={() => onChange({ ...b, items: [...b.items, { text: "", col: 0 }] })}>{t("hublessons.sbAddWord")}</AddRow>
            </div>
          </div>
        </div>
      );
    case "match":
      return (
        <div className="grid gap-2">
          <Text label={t("hublessons.sbInstruction")} value={b.q} onChange={(q) => onChange({ ...b, q })} placeholder={t("hublessons.sbPhMatchQ")} />
          <div className="grid gap-1.5">
            {b.pairs.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input value={p.a} placeholder={t("hublessons.sfLeft")} aria-label={t("hublessons.sbLeftN", { n: i + 1 })} onChange={(e) => onChange({ ...b, pairs: b.pairs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                <span aria-hidden className="text-[var(--ink-3)]">↔</span>
                <Input value={p.b} placeholder={t("hublessons.sfRight")} aria-label={t("hublessons.sbRightN", { n: i + 1 })} onChange={(e) => onChange({ ...b, pairs: b.pairs.map((x, k) => (k === i ? { ...x, b: e.target.value } : x)) })} className="min-h-[40px] w-full" />
                <Remove label={t("hublessons.sbRemovePairN", { n: i + 1 })} disabled={b.pairs.length <= 2} onClick={() => onChange({ ...b, pairs: b.pairs.filter((_, k) => k !== i) })} />
              </div>
            ))}
            {b.pairs.length < 8 && <AddRow onClick={() => onChange({ ...b, pairs: [...b.pairs, { a: "", b: "" }] })}>{t("hublessons.sbAddPair")}</AddRow>}
          </div>
        </div>
      );
    default:
      return <p className="m-0 text-[13px] text-[var(--ink-3)]">{t("hublessons.sbCantEdit")}</p>;
  }
}

// ── the builder ────────────────────────────────────────────────────────────
export function SlideBuilder({ slides, onChange, disabled = false }: { slides: Slide[]; onChange: (s: Slide[]) => void; disabled?: boolean }) {
  const t = useT();
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
  const titleOf = (s: Slide, i: number) => s.title.trim() || (s.blocks.find((b): b is Extract<Block, { t: "text" | "lead" }> => b.t === "text" || b.t === "lead")?.text.trim().slice(0, 40)) || t("hublessons.sdSlideN", { n: i + 1 });

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2.5 sm:p-3" data-testid="slide-builder">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("hublessons.sdSlides")}>
        {slides.map((s, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === idx} disabled={disabled} onClick={() => { setSel(i); setPreview(false); }} data-testid={`sb-slide-${i}`}
            className={`min-h-[52px] w-[128px] shrink-0 rounded-xl border-2 px-2.5 py-1.5 text-start transition ${FOCUS} ${i === idx ? "border-[var(--brand-2)] bg-[var(--surface)] shadow-sm" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand-2)]"}`}>
            <span className="block text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("hublessons.sdSlideN", { n: i + 1 })}</span>
            <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">{titleOf(s, i)}</span>
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={() => setAdding((v) => !v)} aria-expanded={adding} data-testid="sb-new-slide"
          className={`min-h-[52px] shrink-0 rounded-xl border-2 border-dashed border-[var(--brand-2)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--surface)] ${FOCUS}`}>{t("hublessons.sbNewSlide")}</button>
      </div>

      {adding && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="menu" aria-label={t("hublessons.sbChooseLayout")}>
          {TEMPLATES.map((tp) => (
            <button key={tp.id} type="button" role="menuitem" onClick={() => addSlide(tp.make)} data-testid={`sb-template-${tp.id}`}
              className={`rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-2.5 text-start hover:border-[var(--brand-2)] ${FOCUS}`}>
              <span className="block text-[13px] font-extrabold text-[var(--ink)]">{t(tp.labelKey)}</span>
              <span className="block text-[11.5px] text-[var(--ink-2)]">{t(tp.hintKey)}</span>
            </button>
          ))}
        </div>
      )}

      {!slide ? (
        <div className="rounded-xl bg-[var(--surface)] px-4 py-8 text-center">
          <p className="m-0 mb-1 text-[15px] font-extrabold text-[var(--ink)]">{t("hublessons.sbBuildTitle")}</p>
          <p className="m-0 mb-3 text-[13px] text-[var(--ink-2)]">{t("hublessons.sbBuildHelp")}</p>
          <button type="button" onClick={() => setAdding(true)} className={`rounded-xl bg-[var(--brand)] px-5 py-2.5 text-[14px] font-extrabold text-white ${FOCUS}`}>{t("hublessons.sbAddFirst")}</button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl bg-[var(--surface)] p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-auto text-[13px] font-extrabold text-[var(--ink)]">{t("hublessons.sdSlideXofY", { n: idx + 1, total: slides.length })}</span>
            <button type="button" onClick={() => setPreview((v) => !v)} aria-pressed={preview} data-testid="sb-preview"
              className={`min-h-[36px] rounded-full border-2 px-3.5 text-[12.5px] font-extrabold ${FOCUS} ${preview ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] text-[var(--brand)]"}`}>{preview ? t("hublessons.sbBackToEditing") : t("hublessons.sbPreview")}</button>
            <button type="button" aria-label={t("hublessons.sbMoveEarlier")} disabled={idx === 0} onClick={() => moveSlide(-1)} className={iconBtn}><span aria-hidden className="rtl:-scale-x-100">←</span></button>
            <button type="button" aria-label={t("hublessons.sbMoveLater")} disabled={idx === slides.length - 1} onClick={() => moveSlide(1)} className={iconBtn}><span aria-hidden className="rtl:-scale-x-100">→</span></button>
            <button type="button" aria-label={t("hublessons.sbDuplicate")} onClick={dupSlide} className={iconBtn}>⧉</button>
            <button type="button" aria-label={t("hublessons.sdDeleteSlide")} onClick={dropSlide} data-testid="sb-delete-slide" className={`${iconBtn} hover:!bg-[var(--red-soft)] hover:!text-[var(--red)]`}>🗑</button>
          </div>

          {preview ? (
            <div className="overflow-hidden rounded-xl border border-[var(--line)] p-2" data-testid="sb-preview-pane">
              <LessonStyles />
              <SlideDeck key={JSON.stringify(slide)} slides={(() => { const r = finishSlides([slide], t); return "slides" in r && r.slides.length ? r.slides : [{ ...slide, blocks: [{ t: "text", text: t("hublessons.sbNothingYet") }] }]; })()} addXP={() => {}} onDone={() => {}} onBack={() => {}} />
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_190px]">
                <Text label={t("hublessons.sbSlideTitle")} value={slide.title} onChange={(title) => setSlide({ ...slide, title })} placeholder={t("hublessons.sbPhTitle")} testId="sb-title" />
                <label className="block">
                  <span className={labelCls}>{t("hublessons.sbStyle")}</span>
                  <select value={slide.kind} onChange={(e) => setSlide({ ...slide, kind: e.target.value as SlideKind })} className={`min-h-[40px] w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] text-[var(--ink)] ${FOCUS}`}>
                    {(Object.keys(KIND_LABEL) as SlideKind[]).map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
                  </select>
                </label>
              </div>

              {slide.blocks.map((b, bi) => (
                <section key={bi} aria-label={NAME_KEY[b.t] ? t(NAME_KEY[b.t]!) : b.t} className="grid gap-2 rounded-xl border border-[var(--line)] p-2.5" data-testid={`sb-block-${bi}`}>
                  <div className="flex items-center gap-1">
                    <span className="me-auto text-[12px] font-extrabold uppercase tracking-[0.05em] text-[var(--brand)]">{NAME_KEY[b.t] ? t(NAME_KEY[b.t]!) : b.t}</span>
                    <button type="button" aria-label={t("hublessons.sbMoveUp")} disabled={bi === 0} onClick={() => setSlide({ ...slide, blocks: swap(slide.blocks, bi, bi - 1) })} className={iconBtn}>↑</button>
                    <button type="button" aria-label={t("hublessons.sbMoveDown")} disabled={bi === slide.blocks.length - 1} onClick={() => setSlide({ ...slide, blocks: swap(slide.blocks, bi, bi + 1) })} className={iconBtn}>↓</button>
                    <Remove label={t("hublessons.sbRemoveName", { name: NAME_KEY[b.t] ? t(NAME_KEY[b.t]!) : t("hublessons.sbPart") })} onClick={() => setSlide({ ...slide, blocks: slide.blocks.filter((_, i) => i !== bi) })} />
                  </div>
                  <BlockEditor b={b} onChange={(nb) => setBlock(bi, nb)} />
                </section>
              ))}

              <div>
                <button type="button" onClick={() => setAddingBlock((v) => !v)} aria-expanded={addingBlock} data-testid="sb-add-block"
                  className={`min-h-[40px] rounded-xl border-2 border-dashed border-[var(--line)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:border-[var(--brand-2)] ${FOCUS}`}>{t("hublessons.sbAddToSlide")}</button>
                {addingBlock && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="menu" aria-label={t("hublessons.sbAddToSlideAria")}>
                    {CATALOGUE.map((c) => (
                      <button key={c.t} type="button" role="menuitem" data-testid={`sb-add-${c.t}`} onClick={() => { setSlide({ ...slide, blocks: [...slide.blocks, c.make()] }); setAddingBlock(false); }}
                        className={`flex items-start gap-2 rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] p-2 text-start hover:border-[var(--brand-2)] ${FOCUS}`}>
                        <span aria-hidden className="text-[18px] leading-none">{c.icon}</span>
                        <span><span className="block text-[13px] font-extrabold text-[var(--ink)]">{t(c.labelKey)}</span><span className="block text-[11.5px] leading-snug text-[var(--ink-2)]">{t(c.hintKey)}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className={labelCls}>{t("hublessons.sbPictureOptional")}</span>
                <ImageField value={pic} alt={slide.image?.alt ?? ""}
                  onPic={(p) => setSlide(p?.id ? { ...slide, image: { id: p.id, alt: slide.image?.alt ?? p.alt ?? "", ...(p.url ? { url: p.url } : {}) }, artLock: true } : (() => { const { image: _i, ...rest } = slide; void _i; return rest; })())}
                  onAlt={(alt) => slide.image && setSlide({ ...slide, image: { ...slide.image, alt } })} />
              </div>
              <p className="m-0 text-[11.5px] text-[var(--ink-3)]">{rich(t("hublessons.sbTip"), { stars: <b>**</b>, curly: <b>{"{ }"}</b> })}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

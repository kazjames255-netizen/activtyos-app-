"use client";

import { useT } from "@/lib/i18n/provider";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "../../shared-assess/ui";
import { Btn, StepCard } from "../lessonUi";
import { SlideEditor } from "./SlideEditor";
import { SlidePicture } from "./SlidePicture";
import { CanvasSlide, maxStep } from "./CanvasSlide";
import { CanvasPicture, type PictureTarget } from "./CanvasPicture";
import { BlockView, keyWordsItems, KeyWordsCard } from "./blocks";
import { SlideArt, hasArt } from "./SlideArt";
import { lessonOutlineSlide, outcomeSlide, themeBlock } from "./slideTheme";
import { KIND_LABEL, canvasOf, isDecorativePic, type Block, type CanvasBlock, type CanvasEl, type CanvasImg, type Slide, type SlideKind } from "./types";

// The lesson's slides, one at a time: a coloured title band (its colour tells the pupil what kind of slide it is), the slide's
// blocks, and Back / Next with a progress bar. ←/→ move between slides (not while typing). Pure practice: nothing is saved.

const BAND: Record<SlideKind, [string, string]> = {
  intro: ["var(--brand-strong)", "var(--brand-2)"],
  explain: ["var(--brand-strong)", "var(--brand)"],
  practice: ["color-mix(in srgb, var(--green) 78%, #000)", "var(--green)"],
  check: ["color-mix(in srgb, var(--gold) 62%, #000)", "var(--gold)"],
  summary: ["color-mix(in srgb, var(--violet) 75%, #000)", "var(--violet)"],
};
const ICON: Record<SlideKind, string> = { intro: "🚀", explain: "💡", practice: "✏️", check: "🤔", summary: "⭐" };

/** A canvas slide with its elements changed (`fn` gets the current ones). */
function withEls(slide: Slide, fn: (els: CanvasEl[]) => CanvasEl[]): Slide {
  const cv = canvasOf(slide);
  if (!cv) return slide;
  const next: CanvasBlock = { ...cv, els: fn(cv.els) };
  return { ...slide, blocks: [next] };
}
/** A canvas slide with its block's own settings changed (e.g. `theme: "original"`). */
function withBlock(slide: Slide, patch: Partial<CanvasBlock>): Slide {
  const cv = canvasOf(slide);
  if (!cv) return slide;
  const next = { ...cv, ...patch } as CanvasBlock;
  if (next.theme === undefined) delete next.theme;
  return { ...slide, blocks: [next] };
}
/** A "Key words" slide with its `define` block's terms/definitions changed (KeyWordsCard's own inline editing). */
function withDefineItems(slide: Slide, items: { term: string; def: string }[]): Slide {
  const idx = slide.blocks.findIndex((b) => b.t === "define");
  if (idx < 0) return slide;
  return { ...slide, blocks: slide.blocks.map((b, k) => (k === idx ? ({ ...b, items } as Block) : b)) };
}

// The "this slide is interactive" cues: the Next button and the tap-to-reveal pill breathe gently (not at all for reduced motion).
const CUE_CSS = `@keyframes sd-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand-2) 45%,transparent)}55%{box-shadow:0 0 0 7px transparent}}
.sd-pulse{animation:sd-pulse 1.9s ease-in-out infinite}
@keyframes sd-nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.sd-cue{animation:sd-nudge 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sd-pulse,.sd-cue{animation:none!important}}`;

/** Tutor preview only: the deck can be edited in place. `save` writes the whole (new) deck. */
export interface DeckEditor { save: (slides: Slide[]) => Promise<void> }

/** Slide 0 ("cover": subject/title/unit, plain per-element render) is skipped in the step-through whenever slide 1 is
 *  the Outcome slide — adjacent only, so a real slide sitting between them is never jumped over. Exported so callers
 *  that show a slide COUNT ahead of stepping through the deck (LessonPlayer's Start step) can match what's actually shown. */
export function coverSlideSkipped(slides: Slide[]): boolean {
  if (slides.length < 2) return false;
  const cv0 = canvasOf(slides[0]!);
  const cv1 = canvasOf(slides[1]!);
  return !(cv0 && outcomeSlide(cv0)) && !!(cv1 && outcomeSlide(cv1));
}

export function SlideDeck({ slides, addXP, onDone, onBack, editor, onIndex, followIndex, toolbar, subject, lessonTitle, lessonUnit, lessonAgeGroup, lessonTopic, lessonKeyConcepts }: { slides: Slide[]; addXP: (n: number) => void; onDone: () => void; onBack: () => void; editor?: DeckEditor;
  /** Extra controls above a real-deck (canvas) slide, e.g. the "Summary slides instead" switch. */
  toolbar?: ReactNode;
  /** Live lessons: told the current slide index (the tutor's deck drives the students' one). */
  onIndex?: (i: number) => void;
  /** Live lessons: jump to this slide whenever it changes (following the tutor). */
  followIndex?: number | null;
  /** The lesson's own metadata — passed straight through to the canvas slide for its redesigned "Outcome" slide (LessonIntroCard.tsx). */
  subject?: string;
  lessonTitle?: string;
  lessonUnit?: string;
  lessonAgeGroup?: string;
  lessonTopic?: string;
  lessonKeyConcepts?: string[] }) {
  // Slide 0 ("cover": subject/title/unit, plain per-element render) is immediately redundant whenever slide 1 is the
  // Outcome slide (CanvasSlide.tsx/LessonIntroCard already shows that same subject/title/unit info, better, right
  // after it) — genuinely adjacent only: a slide between cover and Outcome is real content, never skipped past.
  // Nothing about the stored deck changes; this purely hides slide 0 from the forward step-through (tutor preview
  // included, matching the pupil view) so decks WITHOUT this exact adjacency (no Outcome slide, or one further into
  // the deck) render slide 0 completely normally.
  const t = useT();
  const coverSkippable = coverSlideSkipped(slides);
  const visible = coverSkippable ? slides.map((_, k) => k).filter((k) => k !== 0) : slides.map((_, k) => k);
  const [i, setI] = useState(() => (followIndex != null && followIndex >= 0 && followIndex < slides.length ? followIndex : (coverSkippable ? 1 : 0)));
  const [editing, setEditing] = useState(false);
  const [picture, setPicture] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Position within the VISIBLE sequence (the hidden cover slide, if skipped, is never counted) — drives progress
  // display and Back/Next; `i` itself stays the real index into `slides` (editor saves/deletes still key off it).
  const pos = visible.indexOf(i);
  const last = pos === visible.length - 1;
  // Canvas slides (Oak's real deck): unsaved text edits live here until the tutor saves; `rev` = clicks made on the current slide.
  const [drafts, setDrafts] = useState<Record<number, Slide>>({});
  const [rev, setRev] = useState({ i: -1, n: 0 });
  const [target, setTarget] = useState<PictureTarget | null>(null);
  // Tutor preview of an interactive slide: "final" = the finished slide (editable), "steps" = stepping through it like a pupil.
  const [view, setView] = useState<"final" | "steps">("final");
  const [selReq, setSelReq] = useState<{ index: number; n: number } | undefined>();
  useEffect(() => { setDrafts({}); }, [slides]);
  const s = drafts[i] ?? slides[i];
  const cv = s ? canvasOf(s) : null;
  const steps = cv ? maxStep(cv) : 0;
  const stepping = !!cv && steps > 0 && (!editor || view === "steps");
  const reveal = stepping && rev.i === i ? rev.n : 0;
  const editing0 = !!editor && !!cv && !stepping;
  const merged = () => slides.map((x, k) => drafts[k] ?? x);
  const advance = () => { if (stepping && reveal < steps) setRev({ i, n: reveal + 1 }); else go(pos + 1); };
  const retreat = () => { if (stepping && reveal > 0) setRev({ i, n: reveal - 1 }); else go(pos - 1); };
  const replay = () => setRev({ i, n: 0 });
  const setEls = (els: CanvasEl[]) => setDrafts((d) => ({ ...d, [i]: withEls(drafts[i] ?? slides[i]!, () => els) }));
  const setKwItems = (items: { term: string; def: string }[]) => setDrafts((d) => ({ ...d, [i]: withDefineItems(drafts[i] ?? slides[i]!, items) }));

  useEffect(() => { box.current?.focus({ preventScroll: true }); }, [i]);
  useEffect(() => { onIndex?.(i); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(() => { if (followIndex != null && followIndex >= 0 && followIndex < slides.length) setI(followIndex); }, [followIndex, slides.length]);
  // `n` is a position in the VISIBLE sequence (not a raw slide index) — Back from the first visible slide leaves the
  // deck (never reveals a hidden cover slide behind it), Next past the last one finishes.
  const go = (n: number) => { if (n < 0) onBack(); else if (n >= visible.length) { addXP(10); onDone(); } else setI(visible[n]!); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (t && /^(BUTTON|A|SUMMARY)$/.test(t.tagName) && e.key === " ") return; // Space on a focused control presses it
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); advance(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); retreat(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, slides.length, reveal, steps, !!editor, drafts, view]);

  if (!s) return null;
  const [a, b] = BAND[s.kind];
  // The vocab-preview slide gets its own dark-card layout (KeyWordsCard) instead of the usual coloured band. A slide
  // that also carries a real picture keeps it — KeyWordsCard renders it in its own light chip — so nothing is lost.
  const kwItems = !cv ? keyWordsItems(s) : null;
  const kwIntro = kwItems ? (s.blocks.find((blk) => blk.t === "text") as { t: "text"; text: string } | undefined)?.text : undefined;
  // The redesigned Outcome slide (CanvasSlide.tsx/LessonIntroCard) has no per-element pictures a tutor could usefully
  // "add" or "change" — its only editable content is the objective text, edited inline on the card itself — so the
  // generic canvas picture tools (which operate on `cv.els`, never shown in that layout) are hidden for it.
  const isOutcome = !!cv && !!outcomeSlide(cv);
  // The redesigned "Lesson outline" slide (CanvasSlide.tsx/LessonOutlineCard) has the same "no per-element picture
  // tools" shape as the Outcome slide above — its own pill/dot pictures (if the deck baked them as raster) are its
  // own template chrome, never a tutor-editable content picture, and the layout has no other picture slot.
  const isOutline = !!cv && !isOutcome && !!lessonOutlineSlide(cv);
  // Oak's own raw decks repeat the lesson-outline slide once before EACH learning cycle/part (confirmed against
  // real deck data), so the same slide can legitimately appear 2-3+ times across one deck. Rather than the card
  // showing the identical static list every time, it takes this occurrence count (0-based, among ALL outline
  // slides up to and including the one on screen) so it can mark earlier parts done and this one current — real
  // deck position, not invented progress. O(deck length), only walked when the current slide actually is one.
  let outlinePart: number | undefined;
  if (isOutline) {
    let occ = -1;
    for (let k = 0; k <= i; k++) {
      const sk = drafts[k] ?? slides[k];
      const ck = sk ? canvasOf(sk) : null;
      if (ck && !outcomeSlide(ck) && lessonOutlineSlide(ck)) occ++;
    }
    outlinePart = occ;
  }
  return (
    <StepCard key={i} className="!p-0 !overflow-visible">
      <div ref={box} tabIndex={-1} className="outline-none" aria-label={t("hublessons.sdSlideXofY", { n: Math.max(0, pos) + 1, total: visible.length })} data-testid="slide" data-slide={i} data-canvas={cv ? "" : undefined}>
        {/* The canvas branch below shows `toolbar` itself (its own slide-tools row). Every other slide kind (Key words'
            dark card, plain block slides) never had that row, so a `toolbar` passed for one of those — e.g. the
            "Lesson slides" button that reverts out of "Summary slides instead" — would otherwise be silently dropped:
            summary slides are plain block slides, not canvas, so the toggle-back button never rendered anywhere. */}
        {!cv && toolbar && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[var(--line)] px-4 py-2 sm:px-5" data-testid="slide-toolbar-top">
            <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("hublessons.sdSlideTools")}>{toolbar}</span>
          </div>
        )}
        {cv ? (
          <>
            <style>{CUE_CSS}</style>
            {(toolbar || editor) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2 sm:px-5">
                <span className="min-w-0 truncate text-[12px] font-extrabold text-[var(--ink-3)]">{editor ? (editing0 ? t("hublessons.sdEditHint") : t("hublessons.sdSteppingHint")) : ""}</span>
                <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("hublessons.sdSlideTools")}>
                  {toolbar}
                  {editor && steps > 0 && (
                    <span role="group" aria-label={t("hublessons.sdPreviewMode")} className="inline-flex overflow-hidden rounded-xl border-2 border-[var(--line)]" data-testid="canvas-view-toggle">
                      {(["final", "steps"] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={view === m} data-testid={`canvas-view-${m}`} onClick={() => { setView(m); if (m === "steps") setRev({ i, n: 0 }); }}
                          className={`min-h-[32px] px-2.5 text-[12px] font-extrabold ${view === m ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--brand)]"}`}>{m === "final" ? t("hublessons.sdFinished") : t("hublessons.sdStepThrough")}</button>
                      ))}
                    </span>
                  )}
                  {editor && !isOutcome && !isOutline && <Btn tone="ghost" onClick={() => setTarget({ mode: "add" })} data-testid="canvas-add-picture" className="!min-h-[36px] !px-3 !text-[12.5px]">{t("hublessons.sdAddPicture")}</Btn>}
                  {editor && <Btn tone="ghost" onClick={() => { setErr(null); setDeleting(true); }} data-testid="slide-delete" className="!min-h-[36px] !px-3 !text-[12.5px]">{t("hublessons.sdDeleteSlideBtn")}</Btn>}
                </span>
              </div>
            )}
            {editor && Object.keys(drafts).length > 0 && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-[var(--gold-soft)] px-4 py-2 text-[13px] font-bold text-[var(--ink)] sm:px-5" data-testid="canvas-unsaved">
                <span>{t("hublessons.sdUnsavedN", { n: Object.keys(drafts).length })}</span>
                <span className="flex gap-2">
                  <Btn tone="ghost" onClick={() => setDrafts({})} className="!min-h-[34px] !px-3 !text-[12.5px]">{t("hublessons.sdDiscard")}</Btn>
                  <Btn disabled={busy} data-testid="canvas-save" className="!min-h-[34px] !px-3 !text-[12.5px]" onClick={async () => {
                    setBusy(true); setErr(null);
                    try { await editor.save(merged()); } catch (e) { setErr(e instanceof Error ? e.message : t("hublessons.sdCouldntSave")); } finally { setBusy(false); }
                  }}>{busy ? t("hublessons.saving") : t("hublessons.sdSaveChanges")}</Btn>
                </span>
              </div>
            )}
            {err && !deleting && <p role="alert" className="m-0 px-4 py-2 text-[13px] font-bold text-[var(--red)] sm:px-5">{err}</p>}
            <CanvasSlide block={cv} reveal={reveal} edit={editing0} label={s.title || t("hublessons.sdSlideN", { n: i + 1 })} subject={subject}
              lessonTitle={lessonTitle} lessonUnit={lessonUnit} lessonAgeGroup={lessonAgeGroup} lessonTopic={lessonTopic} lessonKeyConcepts={lessonKeyConcepts} outlinePart={outlinePart}
              onChange={setEls} onPick={(idx) => setTarget({ mode: "replace", index: idx })} selectRequest={selReq}
              onAdvance={stepping && reveal < steps ? advance : undefined}
              cue={steps > 0 ? (
                stepping ? (
                  reveal < steps ? (
                    <>
                      <button type="button" data-testid="reveal-cue" onClick={advance} className="sd-pulse sd-cue"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, color: "#fff", background: "linear-gradient(100deg, var(--sb-a-dk), var(--sb-a))", border: "2px solid rgba(255,255,255,.85)", cursor: "pointer" }}>
                        <span aria-hidden="true">👆</span>{t("hublessons.sdTapReveal", { n: reveal + 1, total: steps })}
                      </button>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--sb-ink2)" }}>{t("hublessons.sdRevealHelp")}</span>
                    </>
                  ) : (
                    <>
                      <button type="button" data-testid="reveal-done" onClick={replay}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, color: "var(--sb-a)", background: "#fff", border: "2px solid var(--sb-a)", cursor: "pointer" }}>
                        <span aria-hidden="true">✓</span>{t("hublessons.sdAllRevealed", { n: steps })} · <span aria-hidden="true">↺</span> {t("hublessons.replay")}
                      </button>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--sb-ink2)" }}>{t("hublessons.sdNextMovesOn")}</span>
                    </>
                  )
                ) : (
                  <>
                    <button type="button" data-testid="interactive-cue" onClick={() => { setView("steps"); setRev({ i, n: 0 }); }} className="sd-pulse"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, color: "#fff", background: "linear-gradient(100deg, var(--sb-a-dk), var(--sb-a))", border: "2px solid rgba(255,255,255,.85)", cursor: "pointer" }}>
                      <span aria-hidden="true">⚡</span>{t("hublessons.sdInteractive", { n: steps })}
                    </button>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--sb-ink2)" }}>{t("hublessons.sdInteractiveHint", { n: steps })}</span>
                  </>
                )
              ) : undefined} />
            <span className="sr-only" role="status" aria-live="polite">{stepping ? t("hublessons.sdRevealedXofY", { n: reveal, total: steps }) : ""}</span>
            {editor && !isOutcome && !isOutline && (() => {
              // Elements the "lesson outline" pill/dot re-skin (slideTheme.ts's themeBlock) has claimed as its own
              // template art — a re-skinned pill/dot/rail/step-overlay picture is exactly as un-changeable as the
              // generic hairline/swatch decoration isDecorativePic already catches; a tutor never wants to "change"
              // any of it, only a genuine content picture. Computed here (not in themeBlock's own hide flag) because
              // the pill/dot pair themselves are DRAWN (outlineImg), not hidden — they still need excluding from this
              // list even though they're visible on the slide.
              const plan = themeBlock(cv)?.els;
              const isOutlineArt = (idx: number) => !!plan?.[idx] && (plan[idx]!.hide || !!plan[idx]!.outlineImg);
              const changeable = (e: CanvasEl, idx: number): e is CanvasImg => e.k === "img" && !isDecorativePic(e, cv) && !isOutlineArt(idx);
              return (
                <details open className="border-t border-[var(--line)] px-4 py-2 sm:px-5" data-testid="canvas-pictures">
                  <summary className="cursor-pointer text-[12.5px] font-extrabold text-[var(--ink-2)]">{t("hublessons.sdPicturesOnSlide", { n: cv.els.filter(changeable).length })}</summary>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                    {cv.els.map((e, idx, all) => changeable(e, idx) ? (
                      <li key={idx} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg bg-white">{e.url ? <img src={e.url} alt="" className="max-h-10 max-w-10 object-contain" /> : <span aria-hidden="true">🖼</span>}</span>
                        <span className="max-w-[140px] truncate text-[12px] text-[var(--ink-2)]">{e.alt || t("hublessons.sdPictureN", { n: all.slice(0, idx + 1).filter(changeable).length })}</span>
                        <Btn tone="ghost" onClick={() => setTarget({ mode: "replace", index: idx })} data-testid="canvas-picture-change" data-i={idx} className="!min-h-[34px] !px-2.5 !text-[12px]">{t("hublessons.sdChange")}</Btn>
                      </li>
                    ) : null)}
                  </ul>
                </details>
              );
            })()}
          </>
        ) : kwItems ? (
          <>
            {editor && drafts[i] && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--gold-soft)] px-4 py-2 text-[13px] font-bold text-[var(--ink)] sm:px-5" data-testid="kw-unsaved">
                <span>{t("hublessons.sdKwUnsaved")}</span>
                <span className="flex gap-2">
                  <Btn tone="ghost" onClick={() => setDrafts((d) => { const n = { ...d }; delete n[i]; return n; })} className="!min-h-[34px] !px-3 !text-[12.5px]">{t("hublessons.sdDiscard")}</Btn>
                  <Btn disabled={busy} data-testid="kw-save" className="!min-h-[34px] !px-3 !text-[12.5px]" onClick={async () => {
                    setBusy(true); setErr(null);
                    try { await editor!.save(merged()); setDrafts((d) => { const n = { ...d }; delete n[i]; return n; }); } catch (e) { setErr(e instanceof Error ? e.message : t("hublessons.sdCouldntSave")); } finally { setBusy(false); }
                  }}>{busy ? t("hublessons.saving") : t("hublessons.sdSaveChanges")}</Btn>
                </span>
              </div>
            )}
            {err && <p role="alert" className="m-0 px-4 py-2 text-[13px] font-bold text-[var(--red)] sm:px-5">{err}</p>}
          <KeyWordsCard title={s.title} intro={kwIntro} items={kwItems} art={s}
            editable={!!editor} onItemsChange={editor ? setKwItems : undefined}
            corner={editor && (
              <span className="flex gap-1.5" role="group" aria-label={t("hublessons.sdEditSlide")}>
                <button type="button" onClick={() => setEditing(true)} data-testid="slide-edit" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">{t("hublessons.sdEditText")}</button>
                <button type="button" onClick={() => setPicture(true)} data-testid="slide-picture" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">{hasArt(s) ? t("hublessons.sdChangePicture") : t("hublessons.sdAddPicture")}</button>
                <button type="button" onClick={() => { setErr(null); setDeleting(true); }} data-testid="slide-delete" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">{t("hublessons.sdDeleteSlideBtn")}</button>
              </span>
            )} />
          </>
        ) : (
          <>
        <div className="rounded-t-2xl px-5 pb-4 pt-3 text-white sm:px-6" style={{ background: `linear-gradient(120deg, ${a}, ${b})`, borderRadius: "16px 16px 28px 28px / 16px 16px 16px 16px" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-[2px] text-[11px] font-black uppercase tracking-[0.06em]"><span aria-hidden="true">{ICON[s.kind]}</span>{t(KIND_LABEL[s.kind])}</span>
            {editor && (
              <span className="flex gap-1.5" role="group" aria-label={t("hublessons.sdEditSlide")}>
                <button type="button" onClick={() => setEditing(true)} data-testid="slide-edit" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">{t("hublessons.sdEditText")}</button>
                <button type="button" onClick={() => setPicture(true)} data-testid="slide-picture" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">{hasArt(s) ? t("hublessons.sdChangePicture") : t("hublessons.sdAddPicture")}</button>
                <button type="button" onClick={() => { setErr(null); setDeleting(true); }} data-testid="slide-delete" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">{t("hublessons.sdDeleteSlideBtn")}</button>
              </span>
            )}
          </div>
          {s.title && <h2 className="m-0 mt-1.5 text-[19px] font-extrabold leading-tight sm:text-[23px]" style={{ fontFamily: "var(--ff-display)" }}>{s.title}</h2>}
        </div>
        <div className={`grid gap-4 px-5 py-4 sm:px-6 ${hasArt(s) ? (s.image || s.pics?.length ? "md:grid-cols-[minmax(0,1fr)_240px]" : "md:grid-cols-[minmax(0,1fr)_170px]") : ""}`}>
          <div className="min-w-0">
            {s.blocks.map((blk, k) => <BlockView key={`${i}-${k}`} b={blk} k={k} xp={addXP} />)}
          </div>
          {hasArt(s) && <SlideArt slide={s} tint={[a, b]} />}
        </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-10 rounded-b-2xl border-t border-[var(--line)] bg-[var(--surface)]/95 px-5 pb-3 pt-2.5 backdrop-blur sm:px-6">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={1} aria-valuemax={visible.length} aria-valuenow={Math.max(0, pos) + 1} aria-label={t("hublessons.sdSlides")}>
          <span className="block h-full rounded-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${((Math.max(0, pos) + 1) / visible.length) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Btn tone="ghost" onClick={retreat} className="!min-h-[40px] !px-4 !text-[14px]">{t("hublessons.back")}</Btn>
            {stepping && reveal > 0 && <Btn tone="ghost" onClick={replay} data-testid="reveal-replay" title={t("hublessons.sdReplayTitle")} className="!min-h-[40px] !px-3 !text-[14px]"><span aria-hidden="true">↺</span> {t("hublessons.replay")}</Btn>}
          </span>
          <span className="text-[12px] font-extrabold text-[var(--ink-3)]" aria-hidden="true">{stepping ? `${reveal}/${steps} · ` : ""}{Math.max(0, pos) + 1} / {visible.length}</span>
          <Btn onClick={advance} data-testid="lesson-next" className={`!min-h-[40px] !px-5 !text-[14px] ${stepping && reveal < steps ? "sd-pulse" : ""}`}>{stepping && reveal < steps ? t("hublessons.sdReveal") : last ? t("hublessons.continue") : t("hublessons.next")}</Btn>
        </div>
      </div>
      {editing && editor && (
        <SlideEditor slide={s} onClose={() => setEditing(false)} onSave={(ns) => editor.save(slides.map((x, k) => (k === i ? ns : x)))} />
      )}
      {target && editor && cv && (
        <CanvasPicture block={cv} target={target} onClose={() => setTarget(null)}
          onSave={async (els) => {
            await editor.save(slides.map((x, k) => (k === i ? withEls(drafts[k] ?? x, () => els) : (drafts[k] ?? x))));
            if (target.mode === "add") setSelReq({ index: els.length - 1, n: Date.now() }); // the new picture arrives selected, ready to place
          }} />
      )}
      {picture && editor && !cv && (
        <SlidePicture slide={s} tint={[a, b]} onClose={() => setPicture(false)} onSave={(ns) => editor.save(slides.map((x, k) => (k === i ? ns : x)))} />
      )}
      {deleting && editor && (
        <Modal title={t("hublessons.sdDeleteQ")} onClose={() => setDeleting(false)}
          footer={<><Btn tone="ghost" onClick={() => setDeleting(false)}>{t("hublessons.sdKeepIt")}</Btn>
            <Btn disabled={busy} data-testid="slide-delete-confirm" onClick={async () => {
              setBusy(true); setErr(null);
              try { await editor.save(slides.filter((_, k) => k !== i)); setI((n) => Math.max(0, Math.min(n, slides.length - 2))); setDeleting(false); }
              catch (e) { setErr(e instanceof Error ? e.message : t("hublessons.sdCouldntDelete")); }
              finally { setBusy(false); }
            }}>{busy ? t("hublessons.sdDeleting") : t("hublessons.sdDeleteSlide")}</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{t("hublessons.sdDeleteBody", { title: s.title || t("hublessons.sdThisSlide"), n: i + 1, total: slides.length })}</p>
          {err && <p role="alert" className="m-0 mt-2 text-[13px] font-bold text-[var(--red)]">{err}</p>}
        </Modal>
      )}
    </StepCard>
  );
}

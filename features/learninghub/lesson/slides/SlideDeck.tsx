"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "../../shared-assess/ui";
import { Btn, StepCard } from "../lessonUi";
import { SlideEditor } from "./SlideEditor";
import { SlidePicture } from "./SlidePicture";
import { CanvasSlide, maxStep } from "./CanvasSlide";
import { CanvasPicture, type PictureTarget } from "./CanvasPicture";
import { BlockView } from "./blocks";
import { SlideArt, hasArt } from "./SlideArt";
import { KIND_LABEL, canvasOf, type CanvasBlock, type CanvasEl, type Slide, type SlideKind } from "./types";

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

// The "this slide is interactive" cues: the Next button and the tap-to-reveal pill breathe gently (not at all for reduced motion).
const CUE_CSS = `@keyframes sd-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--brand-2) 45%,transparent)}55%{box-shadow:0 0 0 7px transparent}}
.sd-pulse{animation:sd-pulse 1.9s ease-in-out infinite}
@keyframes sd-nudge{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.sd-cue{animation:sd-nudge 2.4s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sd-pulse,.sd-cue{animation:none!important}}`;

/** Tutor preview only: the deck can be edited in place. `save` writes the whole (new) deck. */
export interface DeckEditor { save: (slides: Slide[]) => Promise<void> }

export function SlideDeck({ slides, addXP, onDone, onBack, editor, onIndex, followIndex, toolbar }: { slides: Slide[]; addXP: (n: number) => void; onDone: () => void; onBack: () => void; editor?: DeckEditor;
  /** Extra controls above a real-deck (canvas) slide, e.g. the "Summary slides instead" switch. */
  toolbar?: ReactNode;
  /** Live lessons: told the current slide index (the tutor's deck drives the students' one). */
  onIndex?: (i: number) => void;
  /** Live lessons: jump to this slide whenever it changes (following the tutor). */
  followIndex?: number | null }) {
  const [i, setI] = useState(() => (followIndex != null && followIndex >= 0 && followIndex < slides.length ? followIndex : 0));
  const [editing, setEditing] = useState(false);
  const [picture, setPicture] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const last = i === slides.length - 1;
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
  const advance = () => { if (stepping && reveal < steps) setRev({ i, n: reveal + 1 }); else go(i + 1); };
  const retreat = () => { if (stepping && reveal > 0) setRev({ i, n: reveal - 1 }); else go(i - 1); };
  const replay = () => setRev({ i, n: 0 });
  const setEls = (els: CanvasEl[]) => setDrafts((d) => ({ ...d, [i]: withEls(drafts[i] ?? slides[i]!, () => els) }));

  useEffect(() => { box.current?.focus({ preventScroll: true }); }, [i]);
  useEffect(() => { onIndex?.(i); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(() => { if (followIndex != null && followIndex >= 0 && followIndex < slides.length) setI(followIndex); }, [followIndex, slides.length]);
  const go = (n: number) => { if (n < 0) onBack(); else if (n >= slides.length) { addXP(10); onDone(); } else setI(n); };
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
  return (
    <StepCard key={i} className="!p-0 !overflow-visible">
      <div ref={box} tabIndex={-1} className="outline-none" aria-label={`Slide ${i + 1} of ${slides.length}`} data-testid="slide" data-slide={i} data-canvas={cv ? "" : undefined}>
        {cv ? (
          <>
            <style>{CUE_CSS}</style>
            {(toolbar || editor) && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2 sm:px-5">
                <span className="min-w-0 truncate text-[12px] font-extrabold text-[var(--ink-3)]">{editor ? (editing0 ? "Click text to edit it · click a picture to select, move and resize it" : "Stepping through like a pupil — switch to the finished slide to edit") : ""}</span>
                <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Slide tools">
                  {toolbar}
                  {editor && steps > 0 && (
                    <span role="group" aria-label="Preview mode" className="inline-flex overflow-hidden rounded-xl border-2 border-[var(--line)]" data-testid="canvas-view-toggle">
                      {(["final", "steps"] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={view === m} data-testid={`canvas-view-${m}`} onClick={() => { setView(m); if (m === "steps") setRev({ i, n: 0 }); }}
                          className={`min-h-[32px] px-2.5 text-[12px] font-extrabold ${view === m ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--brand)]"}`}>{m === "final" ? "Finished slide" : "Step through"}</button>
                      ))}
                    </span>
                  )}
                  {editor && editing0 && <Btn tone="ghost" onClick={() => setDrafts((d) => ({ ...d, [i]: withBlock(drafts[i] ?? slides[i]!, { theme: cv.theme === "original" ? undefined : "original" }) }))} aria-pressed={cv.theme === "original"} data-testid="canvas-theme-toggle" title="Draw this slide in its own colours (use it when recolouring would hurt, e.g. colour-coded pictures)" className="!min-h-[36px] !px-3 !text-[12.5px]">{cv.theme === "original" ? "🎨 Use our colours" : "🎨 Original colours"}</Btn>}
                  {editor && <Btn tone="ghost" onClick={() => setTarget({ mode: "add" })} data-testid="canvas-add-picture" className="!min-h-[36px] !px-3 !text-[12.5px]">🖼 Add picture</Btn>}
                  {editor && <Btn tone="ghost" onClick={() => { setErr(null); setDeleting(true); }} data-testid="slide-delete" className="!min-h-[36px] !px-3 !text-[12.5px]">🗑 Delete slide</Btn>}
                </span>
              </div>
            )}
            {editor && Object.keys(drafts).length > 0 && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-[var(--gold-soft)] px-4 py-2 text-[13px] font-bold text-[var(--ink)] sm:px-5" data-testid="canvas-unsaved">
                <span>Unsaved changes on {Object.keys(drafts).length} {Object.keys(drafts).length === 1 ? "slide" : "slides"}.</span>
                <span className="flex gap-2">
                  <Btn tone="ghost" onClick={() => setDrafts({})} className="!min-h-[34px] !px-3 !text-[12.5px]">Discard</Btn>
                  <Btn disabled={busy} data-testid="canvas-save" className="!min-h-[34px] !px-3 !text-[12.5px]" onClick={async () => {
                    setBusy(true); setErr(null);
                    try { await editor.save(merged()); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); } finally { setBusy(false); }
                  }}>{busy ? "Saving…" : "Save changes"}</Btn>
                </span>
              </div>
            )}
            {err && !deleting && <p role="alert" className="m-0 px-4 py-2 text-[13px] font-bold text-[var(--red)] sm:px-5">{err}</p>}
            <CanvasSlide block={cv} reveal={reveal} edit={editing0} label={s.title || `Slide ${i + 1}`}
              onChange={setEls} onPick={(idx) => setTarget({ mode: "replace", index: idx })} selectRequest={selReq}
              onAdvance={stepping && reveal < steps ? advance : undefined}
              cue={steps > 0 ? (
                stepping ? (
                  reveal < steps ? (
                    <>
                      <button type="button" data-testid="reveal-cue" onClick={advance} className="sd-pulse sd-cue"
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, color: "#fff", background: "linear-gradient(100deg, var(--sb-a-dk), var(--sb-a))", border: "2px solid rgba(255,255,255,.85)", cursor: "pointer" }}>
                        <span aria-hidden="true">👆</span>Tap to reveal · {reveal + 1} of {steps}
                      </button>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--sb-ink2)" }}>Click the slide, press Space or → for the next part · ← goes back</span>
                    </>
                  ) : (
                    <>
                      <button type="button" data-testid="reveal-done" onClick={replay}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, color: "var(--sb-a)", background: "#fff", border: "2px solid var(--sb-a)", cursor: "pointer" }}>
                        <span aria-hidden="true">✓</span>All {steps} revealed · <span aria-hidden="true">↺</span> Replay
                      </button>
                      <span className="text-[12px] font-semibold" style={{ color: "var(--sb-ink2)" }}>Next moves on to the next slide</span>
                    </>
                  )
                ) : (
                  <>
                    <button type="button" data-testid="interactive-cue" onClick={() => { setView("steps"); setRev({ i, n: 0 }); }} className="sd-pulse"
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 800, color: "#fff", background: "linear-gradient(100deg, var(--sb-a-dk), var(--sb-a))", border: "2px solid rgba(255,255,255,.85)", cursor: "pointer" }}>
                      <span aria-hidden="true">⚡</span>Interactive · {steps} {steps === 1 ? "reveal" : "reveals"} — ▶ Step through
                    </button>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--sb-ink2)" }}>This slide reveals in {steps} {steps === 1 ? "click" : "clicks"} for pupils; you are seeing the finished slide.</span>
                  </>
                )
              ) : undefined} />
            <span className="sr-only" role="status" aria-live="polite">{stepping ? `Revealed ${reveal} of ${steps}` : ""}</span>
            {editor && (
              <details open className="border-t border-[var(--line)] px-4 py-2 sm:px-5" data-testid="canvas-pictures">
                <summary className="cursor-pointer text-[12.5px] font-extrabold text-[var(--ink-2)]">Pictures on this slide ({cv.els.filter((e) => e.k === "img").length})</summary>
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                  {cv.els.map((e, idx, all) => e.k === "img" ? (
                    <li key={idx} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg bg-white">{e.url ? <img src={e.url} alt="" className="max-h-10 max-w-10 object-contain" /> : <span aria-hidden="true">🖼</span>}</span>
                      <span className="max-w-[140px] truncate text-[12px] text-[var(--ink-2)]">{e.alt || `Picture ${all.slice(0, idx + 1).filter((x) => x.k === "img").length}`}</span>
                      <Btn tone="ghost" onClick={() => setTarget({ mode: "replace", index: idx })} data-testid="canvas-picture-change" data-i={idx} className="!min-h-[34px] !px-2.5 !text-[12px]">Change</Btn>
                    </li>
                  ) : null)}
                </ul>
              </details>
            )}
          </>
        ) : (
          <>
        <div className="rounded-t-2xl px-5 pb-4 pt-3 text-white sm:px-6" style={{ background: `linear-gradient(120deg, ${a}, ${b})`, borderRadius: "16px 16px 28px 28px / 16px 16px 16px 16px" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-[2px] text-[11px] font-black uppercase tracking-[0.06em]"><span aria-hidden="true">{ICON[s.kind]}</span>{KIND_LABEL[s.kind]}</span>
            {editor && (
              <span className="flex gap-1.5" role="group" aria-label="Edit this slide">
                <button type="button" onClick={() => setEditing(true)} data-testid="slide-edit" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">✏️ Edit text</button>
                <button type="button" onClick={() => setPicture(true)} data-testid="slide-picture" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">🖼 {hasArt(s) ? "Change picture" : "Add picture"}</button>
                <button type="button" onClick={() => { setErr(null); setDeleting(true); }} data-testid="slide-delete" className="rounded-full bg-white/25 px-3 py-1 text-[12px] font-extrabold text-white hover:bg-white/35">🗑 Delete slide</button>
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
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1} aria-label="Slides">
          <span className="block h-full rounded-full bg-[var(--brand)] transition-[width] duration-300" style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Btn tone="ghost" onClick={retreat} className="!min-h-[40px] !px-4 !text-[14px]">Back</Btn>
            {stepping && reveal > 0 && <Btn tone="ghost" onClick={replay} data-testid="reveal-replay" title="Hide the reveals and start this slide again" className="!min-h-[40px] !px-3 !text-[14px]"><span aria-hidden="true">↺</span> Replay</Btn>}
          </span>
          <span className="text-[12px] font-extrabold text-[var(--ink-3)]" aria-hidden="true">{stepping ? `${reveal}/${steps} · ` : ""}{i + 1} / {slides.length}</span>
          <Btn onClick={advance} data-testid="lesson-next" className={`!min-h-[40px] !px-5 !text-[14px] ${stepping && reveal < steps ? "sd-pulse" : ""}`}>{stepping && reveal < steps ? "Reveal ▸" : last ? "Continue →" : "Next"}</Btn>
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
        <Modal title="Delete this slide?" onClose={() => setDeleting(false)}
          footer={<><Btn tone="ghost" onClick={() => setDeleting(false)}>Keep it</Btn>
            <Btn disabled={busy} data-testid="slide-delete-confirm" onClick={async () => {
              setBusy(true); setErr(null);
              try { await editor.save(slides.filter((_, k) => k !== i)); setI((n) => Math.max(0, Math.min(n, slides.length - 2))); setDeleting(false); }
              catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t delete"); }
              finally { setBusy(false); }
            }}>{busy ? "Deleting…" : "Delete slide"}</Btn></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">“{s.title || "This slide"}” ({slides[i] ? i + 1 : ""} of {slides.length}) will be removed from this lesson for everyone.</p>
          {err && <p role="alert" className="m-0 mt-2 text-[13px] font-bold text-[var(--red)]">{err}</p>}
        </Modal>
      )}
    </StepCard>
  );
}

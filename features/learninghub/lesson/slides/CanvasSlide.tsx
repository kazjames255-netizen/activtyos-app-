"use client";

import { useT } from "@/lib/i18n/provider";
import { roomBelow } from "./roomBelow";
import { normalizeEls } from "./normalize";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { loadLib, type Lib } from "./SlideArt";
import { TeachingHubGlyph } from "../../TeachingHubMark";
import { useSlideBrand } from "./brand";
import { applyDrag, nudge, reorderEl, type Guides, type Handle, type Order, type Rect } from "./canvasEdit";
import { LessonIntroCard, OBJECTIVE_CLASS } from "./LessonIntroCard";
import { rich } from "../tRich";
import { ITEM_TITLE_CLASS, LessonOutlineCard } from "./LessonOutlineCard";
import { brandVars, fontStack, lessonOutlineSlide, mapTextColor, outcomeSlide, themeBlock, type ElTheme, type TextTheme } from "./slideTheme";
import { isDecorativePic, type CanvasBlock, type CanvasEl, type CanvasImg, type CanvasPara, type CanvasRun, type CanvasShape, type CanvasText } from "./types";

// A whole slide drawn on a canvas — real slide decks imported as our own editable slides (server/src/oak/deckConvert.ts).
//
//  • The slide is a 16:9 (whatever the deck's ratio is) box that scales with its container's WIDTH: geometry is percentages, every
//    length (font size, padding, line width) is `cqw` (1% of the slide's width), so nothing is recomputed when the window resizes.
//  • THEME (slideTheme.ts): at draw time the deck's own palette / fonts are mapped onto the provider's brand (Setup → Branding colour,
//    name, logo) — bands, tints, ink, headings, cards, soft motion. Pictures are never touched. `block.theme = "original"` turns it off.
//    The slide itself stays a light "paper" in a dark portal: the pictures are line art with transparent backgrounds.
//  • Elements are drawn in z-order. `step` elements (and single paragraphs with a paragraph `step`) appear on the pupil's clicks
//    (`reveal`), `until` ones go away again; `delay` = an after-previous / auto-start entrance.
//  • edit (tutor preview, finished-slide view): text is edited in place (contentEditable, plain text; run styling kept); a picture / text
//    box is SELECTED by a click and then dragged, resized by its 8 handles (ratio locked; Shift = free; Alt = no snapping), nudged with
//    the arrow keys, sent forward / back or deleted. Nothing is saved here: every change goes up through `onChange(els)`.

const BASE_LH = 1.22;
/** Handwriting (Kalam) sets narrower than our body font: draw it a touch smaller so it still fits its bubble / box. */
const HAND_SCALE = 0.9;
const LIGHT_VARS = {
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--surface": "#ffffff", "--brand-2": "#2f6bd8", "--red": "#e21d27", "--green": "#15b364", "--gold": "#f5b81f", "--violet": "#6a4fd0",
} as CSSProperties;

const ZWSP = /​/g;
const sameStyle = (a: CanvasRun, b: CanvasRun) => a.size === b.size && !a.bold === !b.bold && !a.italic === !b.italic && !a.underline === !b.underline && a.color === b.color && a.f === b.f && a.link === b.link;

// Some imported decks carry a third-party trademark/attribution disclaimer as a real text element, copied verbatim
// from the source PowerPoint (e.g. "Google Sheets is a trademark of Google LLC and this content is not endorsed by
// or affiliated with Google in any way."). It's never our own copy (mirrors isOakWordmarkText in deckConvert.ts,
// which drops Oak's own wordmark at import time) — this is the render-time equivalent for plain text, matched by
// disclaimer PHRASING (not just a brand name) so a slide that legitimately mentions a product in passing is never hidden.
const TRADEMARK_RE = /\bis\s+an?\s+(?:registered\s+)?trademark\s+of\b|\bnot\s+endorsed\s+by\b|\bnot\s+affiliated\s+with\b|\bno\s+affiliation\s+with\b|\ball\s+trademarks?\s+(?:are\s+)?(?:the\s+)?property\s+of\b/i;
const isTrademarkBoilerplate = (el: CanvasEl): boolean =>
  el.k === "text" && TRADEMARK_RE.test(el.paras.map((p) => p.runs.map((r) => r.t).join("")).join(" "));

/** The text of an edited element, read back from the DOM: paragraphs and runs keep the styling of the paragraph / run they came from. */
export function readParas(root: HTMLElement, el: CanvasText): CanvasPara[] {
  const out: CanvasPara[] = [];
  for (const b of Array.from(root.children) as HTMLElement[]) {
    if (b.dataset.grip !== undefined) continue;
    const pi = Number(b.dataset.p);
    const tpl = el.paras[Number.isFinite(pi) && el.paras[pi] ? pi : el.paras.length - 1];
    if (!tpl) continue;
    const base: CanvasRun = tpl.runs[0] ?? { t: "", size: 18 };
    const runs: CanvasRun[] = [];
    const add = (t: string, style: CanvasRun) => {
      t = t.replace(ZWSP, "");
      if (!t) return;
      const last = runs[runs.length - 1];
      if (last && sameStyle(last, style)) last.t += t; else runs.push({ ...style, t });
    };
    const walk = (n: Node, style: CanvasRun) => {
      if (n.nodeType === 3) { add(n.textContent ?? "", style); return; }
      if (!(n instanceof HTMLElement) || n.dataset.bu !== undefined) return;
      if (n.tagName === "BR") { add("\n", style); return; }
      const st = n.dataset.r !== undefined && tpl.runs[Number(n.dataset.r)] ? tpl.runs[Number(n.dataset.r)]! : style;
      n.childNodes.forEach((c) => walk(c, st));
    };
    b.childNodes.forEach((c) => walk(c, base));
    const last = runs[runs.length - 1];
    if (last && last.t.endsWith("\n")) { last.t = last.t.slice(0, -1); if (!last.t) runs.pop(); } // a lone <br> is only a caret placeholder
    out.push({ ...tpl, runs: runs.length ? runs : [{ ...base, t: "" }] });
  }
  return out;
}

/** The highest click on the slide (how many clicks it takes to show everything): elements and paragraph builds, appear and exit. */
export const maxStep = (b: CanvasBlock) => b.els.reduce((m: number, e: CanvasEl) => Math.max(m, e.step ?? 0, e.until ?? 0, ...(e.k === "text" ? e.paras.map((p) => Math.max(p.step ?? 0, p.until ?? 0)) : [0])), 0);

const boxOf = (e: CanvasEl): Rect => ({ x: e.x, y: e.y, w: e.w, h: e.h });
const HANDLES: { h: Handle; style: CSSProperties; cursor: string }[] = [
  { h: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" }, { h: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" }, { h: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { h: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" }, { h: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  { h: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" }, { h: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" }, { h: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
];

interface Live { i: number; r: Rect; guides: Guides }

export function CanvasSlide({ block, reveal = 0, edit = false, onChange, onPick, label, onAdvance, cue, selectRequest, subject, lessonTitle, lessonUnit, lessonAgeGroup, lessonTopic, lessonKeyConcepts, outlinePart }: {
  block: CanvasBlock;
  /** How many clicks have been made (elements with `step` ≤ reveal are shown). */
  reveal?: number;
  /** Tutor edit (the finished slide): text in place, pictures / text boxes selectable, movable and resizable. */
  edit?: boolean;
  /** Tutor edit: these are the slide's elements now (a text edit, a move / resize, a reorder, a delete). */
  onChange?: (els: CanvasEl[]) => void;
  /** Tutor edit: open the Change-picture dialog for element `index`. */
  onPick?: (index: number) => void;
  label?: string;
  /** Pupil view: a click / tap on the slide advances the reveal. */
  onAdvance?: () => void;
  /** Drawn in a strip under the slide (the "tap to reveal" cue) so it never covers the slide's own content. */
  cue?: ReactNode;
  /** Select this element (e.g. a picture that was just added); `n` makes a repeat request count. */
  selectRequest?: { index: number; n: number };
  /** The lesson's own metadata — used only by the redesigned "Outcome" slide (LessonIntroCard.tsx), never by anything else here. */
  subject?: string;
  lessonTitle?: string;
  lessonUnit?: string;
  lessonAgeGroup?: string;
  lessonTopic?: string;
  lessonKeyConcepts?: string[];
  /** Lesson-outline slide only: 0-based, which occurrence of this repeated slide is showing (SlideDeck.tsx counts
   *  them across the whole deck — Oak's own decks legitimately repeat this slide once before each learning cycle,
   *  see LessonOutlineCard.tsx). Undefined renders every item plain, with no done/here status. */
  outlinePart?: number;
}) {
  const t = useT();
  const [lib, setLib] = useState<Lib | null>(null);
  const wantsLib = useMemo(() => block.els.some((e) => e.k === "img" && e.picId), [block.els]);
  useEffect(() => {
    if (!wantsLib) return;
    let live = true;
    loadLib().then((l) => { if (live) setLib(l); }).catch(() => { /* library pictures just don't draw */ });
    return () => { live = false; };
  }, [wantsLib]);
  const [ver, setVer] = useState<Record<number, number>>({});
  const uid = useId().replace(/:/g, "");
  const u = (pt: number) => `${(pt / block.w) * 100}cqw`;
  const brand = useSlideBrand();
  const vars = useMemo(() => brandVars(brand.color), [brand.color]);
  const plan = useMemo(() => themeBlock(block), [block]);
  const themed = !!plan;
  // The redesigned "Outcome" slide (LessonIntroCard.tsx: the lesson's own title/unit/objective on the left, a small
  // "this continues digitally" dashboard mock on the right) fully replaces the generic per-element render below — a
  // different LAYOUT, not a re-skin — in BOTH the student view and the tutor's own edit/preview, so a tutor always
  // edits and checks their work against the exact thing students see. The only per-slide-editable field here is the
  // objective statement itself (subject/title/unit are lesson-wide metadata, edited elsewhere); it's wired to the
  // same contentEditable-in-place / onChange mechanism as every other canvas text box (see readParas/onCommit below).
  const outcome = outcomeSlide(block);
  const outcomeEl = outcome && block.els[outcome.idx]?.k === "text" ? (block.els[outcome.idx] as CanvasText) : undefined;
  // The redesigned "Lesson outline" slide (LessonOutlineCard.tsx: a brand header + a rounded-white-card list, one per
  // outline item) — same "different layout, not a reskin" treatment as the Outcome slide above, in both student view
  // and tutor edit. Mutually exclusive with `outcome` (they're different Oak templates); only tried when this slide
  // ISN'T an Outcome slide, so nothing here can shadow that detection.
  const outline = !outcome ? lessonOutlineSlide(block) : null;

  // ── selection / drag (edit) ──
  const paper = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [lock, setLock] = useState(true);
  const R = useRef({ els: block.els, onChange, lock, W: block.w, H: block.h });
  R.current = { els: block.els, onChange, lock, W: block.w, H: block.h };
  const drag = useRef<{ i: number; h: Handle; sx: number; sy: number; start: Rect; moved: boolean } | null>(null);
  const selEl = sel !== null ? block.els[sel] : undefined;
  useEffect(() => { if (sel !== null && !block.els[sel]) setSel(null); }, [block.els, sel]);
  useEffect(() => { if (selectRequest && block.els[selectRequest.index]) setSel(selectRequest.index); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectRequest?.n]);
  useEffect(() => { if (!edit) { setSel(null); setLive(null); } }, [edit]);
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (edit && sel !== null && block.els[sel]?.k === "img") frameRef.current?.focus({ preventScroll: true }); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, edit]);

  const commit = useCallback((els: CanvasEl[]) => R.current.onChange?.(els), []);
  const beginDrag = (e: RPointerEvent, i: number, h: Handle) => {
    if (!edit || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = R.current.els[i];
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    setSel(i);
    const d = { i, h, sx: e.clientX, sy: e.clientY, start: boxOf(el), moved: false };
    drag.current = d;
    const others = () => R.current.els.filter((o, k) => k !== i && o.k !== "shape" && o.w * o.h > 0.0004).map(boxOf);
    const move = (ev: PointerEvent) => {
      const box = paper.current?.getBoundingClientRect();
      if (!box || !box.width) return;
      const px = ev.clientX - d.sx, py = ev.clientY - d.sy;
      if (!d.moved && Math.abs(px) + Math.abs(py) < 4) return;
      d.moved = true;
      const r = applyDrag(d.h, d.start, px / box.width, py / box.height, { lock: R.current.lock !== ev.shiftKey, snap: !ev.altKey, W: R.current.W, H: R.current.H, others: others() });
      setLive({ i, r: r.rect, guides: r.guides });
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      setLive((lv) => {
        if (lv && d.moved) { const els = R.current.els.map((o, k) => (k === i ? ({ ...o, ...lv.r } as CanvasEl) : o)); queueMicrotask(() => commit(els)); }
        return null;
      });
      drag.current = null;
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const setOrder = (dir: Order) => {
    if (sel === null) return;
    const r = reorderEl(block.els, sel, dir);
    if (r.els !== block.els) { commit(r.els); setSel(r.idx); }
  };
  const remove = () => { if (sel === null) return; commit(block.els.filter((_, k) => k !== sel)); setSel(null); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!edit || sel === null || !selEl) return;
    const t = e.target as HTMLElement;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === "BUTTON" && t.dataset.selFocus === undefined)) return;
    const step = e.shiftKey ? 0.02 : 0.005;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (arrows[e.key]) { e.preventDefault(); e.stopPropagation(); const [dx, dy] = arrows[e.key]!; commit(block.els.map((o, k) => (k === sel ? ({ ...o, ...nudge(boxOf(o), dx, dy) } as CanvasEl) : o))); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); }
    else if (e.key === "Escape") { setSel(null); }
    else if (e.key === "]") { e.preventDefault(); setOrder(e.shiftKey ? "front" : "forward"); }
    else if (e.key === "[") { e.preventDefault(); setOrder(e.shiftKey ? "backmost" : "back"); }
    else if ((e.key === "Enter" || e.key === " ") && selEl.k === "img" && t === frameRef.current) { e.preventDefault(); onPick?.(sel); }
  };

  const r = edit ? maxStep(block) : reveal;
  const norm = useMemo(() => normalizeEls(block.els), [block.els]);
  const bg = plan ? plan.bg : (block.bg ?? "#ffffff");
  const g = (i: number, el: CanvasEl): Rect => (live && live.i === i ? live.r : boxOf(el));
  const frameEl = selEl && sel !== null ? (edit ? g(sel, selEl) : null) : null;
  const advance = !edit && onAdvance;

  return (
    <div data-testid="canvas-frame" style={{ ...vars, ...LIGHT_VARS, borderRadius: "15px 15px 0 0", overflow: "hidden", background: "var(--sb-paper)" }}>
      <div aria-hidden="true" style={{ height: 4, background: "linear-gradient(90deg, var(--sb-a-dk), var(--sb-a) 40%, var(--sb-b) 75%, var(--sb-c))" }} />
      <div ref={paper} data-testid="canvas-slide" data-canvas-edit={edit ? "" : undefined} data-themed={themed ? "" : "original"} data-advance={advance ? "" : undefined} role="group" aria-label={label ?? t("hublessons.csSlide")}
        onKeyDown={onKey}
        onPointerDown={edit ? (e) => { if (!(e.target as HTMLElement).closest("[data-canvas-img],[data-el-wrap],[data-frame],[data-sel-toolbar]")) setSel(null); } : undefined}
        onClick={advance ? (e) => { if ((e.target as HTMLElement).closest("a,button")) return; if (window.getSelection()?.toString()) return; onAdvance?.(); } : undefined}
        style={{ position: "relative", width: "100%", aspectRatio: `${block.w} / ${block.h}`, containerType: "inline-size", overflow: "hidden", background: bg, color: themed ? "var(--sb-ink)" : "#000", fontFamily: fontStack(undefined, false), cursor: advance ? "pointer" : undefined, userSelect: edit ? undefined : "none" }}>
        <style>{`${lib?.css ?? ""}
/* Text is measured synchronously by the fit routine: a font-size transition (the hub's reduced-motion rule gives EVERY element a 0.01ms one) would leave getComputedStyle / scrollHeight on the OLD size for a frame and the fit would flip-flop. */
[data-canvas-text],[data-canvas-text] *{transition:none!important}
[data-canvas-edit] [data-canvas-text]{cursor:text;border-radius:2px}
[data-canvas-edit] [data-canvas-text]:hover{outline:2px dashed rgba(47,107,216,.7);outline-offset:1px}
[data-canvas-edit] [data-canvas-text]:focus{outline:2px solid #2f6bd8;outline-offset:1px;background:rgba(47,107,216,.06)}
[data-canvas-edit] [data-canvas-img]{cursor:move;touch-action:none}
[data-canvas-edit] [data-canvas-img]:hover{outline:2px dashed rgba(47,107,216,.7);outline-offset:1px}
[data-sr]{transition:opacity .4s ease var(--dl,0s),translate .5s cubic-bezier(.2,.8,.2,1) var(--dl,0s),scale .5s cubic-bezier(.2,.8,.2,1) var(--dl,0s),visibility 0s linear 0s}
[data-sr="off"]{opacity:0;visibility:hidden;translate:0 1.1cqw;scale:.975;transition:opacity .22s ease,translate .22s ease,scale .22s ease,visibility 0s linear .22s}
[data-sr="fresh"]{animation:sr-glow 1.1s ease-out .05s}
[data-sr-auto]{animation:sr-in .6s cubic-bezier(.2,.8,.2,1) var(--dl,0s) backwards}
@keyframes sr-in{from{opacity:0;translate:0 1.1cqw;scale:.975}to{opacity:1;translate:0 0;scale:1}}
@keyframes sr-glow{0%{filter:drop-shadow(0 0 0 transparent)}30%{filter:drop-shadow(0 0 1.1cqw var(--sb-glow2))}100%{filter:drop-shadow(0 0 0 transparent)}}
@keyframes sr-pulse{0%,100%{box-shadow:0 0 0 0 var(--sb-glow2)}60%{box-shadow:0 0 0 .8cqw transparent}}
@media (prefers-reduced-motion:reduce){[data-sr],[data-sr="off"],[data-sr-auto],[data-sr="fresh"]{transition:none!important;animation:none!important;translate:none!important;scale:none!important}}
[data-canvas-edit] [data-grip]{opacity:.8}
@media (hover:hover){[data-canvas-edit] [data-grip]{opacity:0}[data-canvas-edit] [data-el-wrap]:hover>[data-grip],[data-canvas-edit] [data-el-wrap]:focus-within>[data-grip],[data-canvas-edit] [data-grip]:focus-visible{opacity:1}}
[data-hd]::before{content:"";position:absolute;inset:-9px}`}</style>
        {outcome ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <LessonIntroCard lesson={{
              subject: subject ?? "", title: lessonTitle ?? label ?? "", unit: lessonUnit, ageGroup: lessonAgeGroup,
              topic: lessonTopic, objective: outcome.statement, keyConcepts: lessonKeyConcepts,
            }} objectiveEditable={edit && outcomeEl ? (
              <div data-testid="lesson-intro-objective" data-canvas-text="" contentEditable suppressContentEditableWarning spellCheck
                role="textbox" aria-multiline="true" aria-label={t("hublessons.csObjectiveEdit")}
                className={OBJECTIVE_CLASS} style={{ outline: "none", cursor: "text", whiteSpace: "pre-wrap" }}
                onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
                onBlur={(e) => {
                  const paras = readParas(e.currentTarget, outcomeEl);
                  if (JSON.stringify(paras) !== JSON.stringify(outcomeEl.paras)) commit(block.els.map((o, k) => (k === outcome.idx && o.k === "text" ? { ...o, paras } : o)));
                }}>
                {outcomeEl.paras.map((p, pi) => (
                  <p key={pi} data-p={pi} style={{ margin: 0 }}>
                    {p.runs.map((r, ri) => (
                      <span key={ri} data-r={ri} style={{ fontWeight: r.bold ? 700 : undefined, fontStyle: r.italic ? "italic" : undefined, textDecoration: r.underline ? "underline" : undefined }}>{r.t || "​"}</span>
                    ))}
                  </p>
                ))}
              </div>
            ) : undefined} />
          </div>
        ) : outline ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <LessonOutlineCard subject={subject ?? ""} heading={lessonTitle || label || ""} currentPart={outlinePart} items={outline.items.map(({ title, idx }) => {
              const el = block.els[idx];
              const textEl = el && el.k === "text" ? (el as CanvasText) : undefined;
              return {
                title,
                editable: edit && textEl ? (
                  <div data-testid="lesson-outline-item" data-canvas-text="" contentEditable suppressContentEditableWarning spellCheck
                    role="textbox" aria-multiline="true" aria-label={t("hublessons.csStepTitleEdit")}
                    className={ITEM_TITLE_CLASS} style={{ outline: "none", cursor: "text", whiteSpace: "pre-wrap", color: "var(--sb-ink, #171534)" }}
                    onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
                    onBlur={(e) => {
                      const paras = readParas(e.currentTarget, textEl);
                      if (JSON.stringify(paras) !== JSON.stringify(textEl.paras)) commit(block.els.map((o, k) => (k === idx && o.k === "text" ? { ...o, paras } : o)));
                    }}>
                    {textEl.paras.map((p, pi) => (
                      <p key={pi} data-p={pi} style={{ margin: 0 }}>
                        {p.runs.map((r, ri) => (
                          <span key={ri} data-r={ri} style={{ fontWeight: r.bold ? 700 : undefined, fontStyle: r.italic ? "italic" : undefined, textDecoration: r.underline ? "underline" : undefined }}>{r.t || "​"}</span>
                        ))}
                      </p>
                    ))}
                  </div>
                ) : undefined,
              };
            })} />
          </div>
        ) : block.els.map((el, i) => {
          const th = plan?.els[i];
          if (th?.hide || isTrademarkBoilerplate(el) || norm.hide.has(i)) return null;
          const gi = g(i, el);
          const until = el.until ?? norm.until.get(i);
          const hidden = (!!el.step && el.step > r) || (!!until && r >= until);
          const auto = !el.step && !!el.delay && !edit;
          const fresh = !edit && !hidden && !!el.step && el.step === reveal && reveal > 0;
          const pos: CSSProperties & Record<string, string | number | undefined> = {
            position: "absolute", left: `${gi.x * 100}%`, top: `${gi.y * 100}%`, width: `${gi.w * 100}%`, height: `${gi.h * 100}%`,
            ...(el.delay && !hidden ? { "--dl": `${el.delay}s` } : {}),
          };
          const sr = { "data-sr": hidden ? "off" : fresh ? "fresh" : "on", ...(auto ? { "data-sr-auto": "" } : {}) } as Record<string, string>;
          if (el.k === "img") return <ImgEl key={i} el={el} ar={block.w / block.h} pos={pos} sr={sr} th={th} lib={lib} edit={edit} labelled={hasTextOn(block.els, i)} onDown={(e) => beginDrag(e, i, "move")} />;
          if (el.k === "shape") return <ShapeEl key={i} el={el} pos={pos} sr={sr} th={th} block={block} u={u} id={`${uid}-${i}`} />;
          return (
            <TextEl key={`${i}-${ver[i] ?? 0}`} el={el} pos={pos} sr={sr} th={th} themed={themed} u={u} edit={edit} r={r} capH={roomBelow(block.els, i)}
              onGrip={(e) => beginDrag(e, i, "move")} onFocusText={() => setSel(i)}
              onCommit={(paras) => { setVer((v) => ({ ...v, [i]: (v[i] ?? 0) + 1 })); commit(block.els.map((o, k) => (k === i && o.k === "text" ? { ...o, paras } : o))); }} />
          );
        })}

        {edit && frameEl && selEl && (
          <>
            {live && live.guides.v.map((x) => <span key={`v${x}`} aria-hidden="true" style={{ position: "absolute", left: `${x * 100}%`, top: 0, bottom: 0, width: 1, background: "#e22295", pointerEvents: "none", zIndex: 50 }} />)}
            {live && live.guides.h.map((y) => <span key={`h${y}`} aria-hidden="true" style={{ position: "absolute", top: `${y * 100}%`, left: 0, right: 0, height: 1, background: "#e22295", pointerEvents: "none", zIndex: 50 }} />)}
            <div ref={frameRef} data-frame="" data-testid="canvas-frame-sel" data-sel-focus="" tabIndex={0} role="group" aria-label={selEl.k === "img" ? t("hublessons.csSelPicture") : t("hublessons.csSelTextBox")}
              onPointerDown={selEl.k === "img" ? (e) => beginDrag(e, sel!, "move") : undefined}
              style={{ position: "absolute", left: `${frameEl.x * 100}%`, top: `${frameEl.y * 100}%`, width: `${frameEl.w * 100}%`, height: `${frameEl.h * 100}%`, boxSizing: "border-box", border: "2px solid #2f6bd8", boxShadow: "0 0 0 1px #fff", outline: "none",
                cursor: selEl.k === "img" ? "move" : "default", pointerEvents: selEl.k === "img" ? "auto" : "none", touchAction: "none", zIndex: 40, ...(selEl.rot ? { transform: `rotate(${selEl.rot}deg)` } : {}) }}>
              {!selEl.rot && HANDLES.map((h) => (
                <span key={h.h} data-hd="" data-handle={h.h} onPointerDown={(e) => beginDrag(e, sel!, h.h)}
                  style={{ position: "absolute", ...h.style, width: 11, height: 11, marginLeft: -5.5, marginTop: -5.5, background: "#fff", border: "2px solid #2f6bd8", borderRadius: 3, boxSizing: "border-box", cursor: h.cursor, touchAction: "none", pointerEvents: "auto" }} />
              ))}
            </div>
          </>
        )}
      </div>
      {cue && <div data-testid="canvas-cue" className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5" style={{ background: "var(--sb-paper)", borderTop: "1px solid var(--sb-a-line)" }}>{cue}</div>}
      {edit && !outcome && !outline && (
        <div role="toolbar" aria-label={t("hublessons.csPlacement")} data-sel-toolbar="" data-testid="canvas-sel-toolbar" className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]" style={{ borderRadius: 0 }}>
          {selEl && sel !== null ? (
            <>
              <strong className="me-1 text-[var(--ink)]">{selEl.k === "img" ? t("hublessons.csPicture") : selEl.k === "text" ? t("hublessons.csTextBox") : t("hublessons.csShape")}</strong>
              {selEl.k === "img" && onPick && !isDecorativePic(selEl, block) && !(plan?.els[sel] && (plan.els[sel]!.hide || !!plan.els[sel]!.outlineImg)) && <TB onClick={() => onPick(sel)} testid="canvas-sel-change">{t("hublessons.csChangeEllipsis")}</TB>}
              <TB onClick={() => setOrder("forward")} testid="canvas-sel-forward" title={t("hublessons.csBringForward")}>{t("hublessons.csForward")}</TB>
              <TB onClick={() => setOrder("back")} testid="canvas-sel-back" title={t("hublessons.csSendBack")}>{t("hublessons.back")}</TB>
              <TB onClick={remove} testid="canvas-sel-delete" title={t("hublessons.csDeleteKey")} danger>{t("hublessons.csDelete")}</TB>
              <label className="ms-1 inline-flex cursor-pointer items-center gap-1 font-semibold"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} data-testid="canvas-sel-lock" /> {t("hublessons.csKeepProportions")} <span className="text-[var(--ink-3)]">{t("hublessons.csShiftFree")}</span></label>
              <span className="ms-auto hidden text-[var(--ink-3)] md:inline">{t("hublessons.csDragHelp")}</span>
            </>
          ) : <span className="text-[var(--ink-3)]">{rich(t("hublessons.csClickHelp"), { grip: <b aria-hidden="true">✥</b> })}</span>}
        </div>
      )}
      {(brand.name || brand.logo) && (
        <div data-testid="canvas-brand" className="flex items-center gap-2 px-3 py-1.5" style={{ background: "var(--sb-paper)", borderTop: "1px solid var(--sb-a-line)" }}>
          {brand.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={brand.logo} alt="" className="h-5 w-auto max-w-[72px] object-contain" />
            : <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-md text-[10px] font-black text-white" style={{ background: "var(--sb-a)" }}>{(brand.name ?? "").trim().charAt(0).toUpperCase()}</span>}
          {brand.name && <span className="truncate text-[11.5px] font-extrabold tracking-[0.01em]" style={{ color: "var(--sb-ink2)", fontFamily: "var(--ff-display), var(--ff), sans-serif" }}>{brand.name}</span>}
        </div>
      )}
    </div>
  );
}

function TB({ children, onClick, testid, title, danger }: { children: ReactNode; onClick: () => void; testid: string; title?: string; danger?: boolean }) {
  return <button type="button" onClick={onClick} data-testid={testid} title={title} className={`rounded-lg border border-[var(--line)] bg-[var(--panel,var(--surface))] px-2.5 py-1 text-[12px] font-extrabold hover:border-[var(--brand-2)] ${danger ? "text-[var(--red)]" : "text-[var(--ink)]"}`}>{children}</button>;
}

const rotOf = (el: { rot?: number; flipH?: true; flipV?: true }) => {
  const t = [el.rot ? `rotate(${el.rot}deg)` : "", el.flipH ? "scaleX(-1)" : "", el.flipV ? "scaleY(-1)" : ""].filter(Boolean).join(" ");
  return t ? { transform: t } : {};
};

const CARD: CSSProperties = { position: "absolute", inset: "-.6cqw -1.3cqw", zIndex: -1, pointerEvents: "none", background: "var(--sb-card)", borderRadius: "1.5cqw", boxShadow: "inset .5cqw 0 0 var(--sb-a-line), 0 .2cqw .9cqw var(--sb-glow)" };

// Oak's own generic/stock decoration, identified by exact stored-file id — never lesson content, so a match is treated
// exactly like "no picture stored" (draw our own mark instead). Each one was confirmed against real deck data before
// being added here (a large full-bleed "hero" picture is decorative only when it's one of these, not by size/position
// alone): a generic subject-cover illustration reused verbatim across many unrelated lessons (an abacus, on ~1 in 4 of
// a 300-note sample spanning maths, science, French, Spanish and English decks alike), and Oak's own small platform
// logo bug, which showed up on all but 2 of that same 300-note sample — i.e. effectively every deck's cover slide.
const GENERIC_STOCK_SIDS = new Set([
  "c49baf7e54e71d045c226cd3903feb3bc2f42ce95e85fe8d7171713fbcdf4b1a.webp", // generic "abacus" subject-cover illustration
  "b86832f0daa938790e69ae939fb48a4518d87e7cfb0d13d9413d612ded2c430b.webp", // Oak's own small logo bug
  "fa38355dede565428042f721d7c357b8ed3df0ce7a2316f4906e93c747de06e6.webp", // Oak's acorn mark, a bottom-right corner occurrence the
  // import-time perceptual-hash check (deckConvert.ts isOakLogo/OAK_LOGO_DHASH) didn't catch: confirmed by eye against the real
  // stored file (a Science "Increasing levels of CO2" chart slide) — its dhash is ~34/64 bits off the known acorn hash, most likely
  // because this occurrence went through our own storage re-encode (resize/webp) before it could be hashed the same way.
]);

/** Text written ON a small picture (a speech bubble, a labelled box): the whole text box sits inside the picture's stored frame, so the words were placed against
 *  that (possibly stretched) frame. Big pictures (backdrops, panels, photos with a caption strip) are left to the normal fit. */
function hasTextOn(els: CanvasEl[], i: number): boolean {
  const g = els[i];
  if (g.w * g.h > 0.45) return false;
  const tol = 0.01;
  return els.some((t, j) => j > i && t.k === "text" && t.paras.some((p) => p.runs.some((r) => /\S/.test(r.t)))
    && t.x >= g.x - tol && t.x + t.w <= g.x + g.w + tol && t.y >= g.y - tol && t.y + t.h <= g.y + g.h + tol);
}

function ImgEl({ el, ar, pos, sr, th, lib, edit, labelled = false, onDown }: { el: CanvasImg; ar: number; pos: CSSProperties; sr: Record<string, string>; th?: ElTheme; lib: Lib | null; edit: boolean; labelled?: boolean; onDown: (e: RPointerEvent) => void }) {
  if (th?.panel) return <div aria-hidden="true" {...sr} style={{ ...pos, background: "var(--sb-card)", borderRadius: "2.4cqw", boxShadow: "0 .3cqw 1.6cqw var(--sb-glow), inset 0 0 0 .18cqw var(--sb-a-line)" }} />;
  if (th?.outlineImg) return <div aria-hidden="true" {...sr} style={{ ...pos, background: th.fill, borderRadius: th.outlineImg === "dot" ? "50%" : "999px", boxShadow: "0 .25cqw 1cqw var(--sb-glow), inset 0 0 0 .1cqw var(--sb-a-line)" }} />;
  const pic = el.picId ? lib?.byId[el.picId] : undefined;
  const c = el.crop;
  // Aspect lock for CROPPED pictures: the crop window (in the picture's own pixels) is drawn to fill the box, so a box whose shape differs from the window's
  // squeezes / stretches it. Once the picture's natural size is known, a window that drifts > 6% from the box shape is fitted inside the box (contain), centred.
  // Except a LABELLED picture (text sits on it): the words were placed against the stretched frame the author drew, so the frame is kept (speech bubbles: the
  // fitted bubble came out smaller than its own sentence and its outline cut through the text — calibration cluster overlap:text-img). The same for an uncropped
  // labelled picture: `contain` letterboxed a stretched speech-bubble outline inside its frame, so its sentence stuck out of it (clean-sample misses).
  const [nat, setNat] = useState<[number, number] | null>(null);
  let fw = 1, fh = 1;
  if (c && nat) {
    const ra = (nat[0] * Math.max(0.05, 1 - c[0] - c[2])) / (nat[1] * Math.max(0.05, 1 - c[1] - c[3]));
    const ba = (el.w * ar) / Math.max(1e-6, el.h);
    if (!labelled && ra > 0 && ba > 0 && Math.abs(ra / ba - 1) > 0.06) { if (ra > ba) fh = ba / ra; else fw = ra / ba; }
  }
  const sx = c ? 1 / Math.max(0.05, 1 - c[0] - c[2]) : 1, sy = c ? 1 / Math.max(0.05, 1 - c[1] - c[3]) : 1;
  const genericStock = !!el.sid && GENERIC_STOCK_SIDS.has(el.sid);
  const inner = pic
    ? <div role="img" aria-label={pic.alt} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }} dangerouslySetInnerHTML={{ __html: pic.svg }} />
    : el.url && !genericStock
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={el.url} alt={el.alt} draggable={false} loading="lazy"
          ref={c ? (im) => { if (im && im.complete && im.naturalWidth && im.naturalHeight) setNat((o) => (o && o[0] === im.naturalWidth && o[1] === im.naturalHeight ? o : [im.naturalWidth, im.naturalHeight])); } : undefined}
          onLoad={c ? (e) => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setNat([im.naturalWidth, im.naturalHeight]); } : undefined}
          style={c ? { position: "absolute", maxWidth: "none", width: `${sx * 100}%`, height: `${sy * 100}%`, left: `${-c[0] * sx * 100}%`, top: `${-c[1] * sy * 100}%` } : { width: "100%", height: "100%", objectFit: labelled ? "fill" : "contain", display: "block" }} />
      // no real picture stored (or one Oak's own generic/stock art was dropped from): our own mark, never Oak's placeholder art
      : <div aria-hidden="true" style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "var(--sb-card, rgba(0,0,0,.05))", borderRadius: "8%" }}>
          <div style={{ width: "42%", height: "42%" }}><TeachingHubGlyph /></div>
        </div>;
  const interactive = edit ? { onPointerDown: onDown } : {};
  return (
    <div data-testid="canvas-img" data-canvas-img="" data-crop-fit={c ? (nat ? (fw < 1 || fh < 1 ? "fitted" : "ok") : "pending") : undefined} data-src={el.sid ?? el.imageId ?? el.picId} {...sr} style={{ ...pos, overflow: c ? "hidden" : "visible", ...rotOf(el) }} {...interactive}>
      {c && (fw < 1 || fh < 1) ? <div style={{ position: "absolute", left: `${(1 - fw) * 50}%`, top: `${(1 - fh) * 50}%`, width: `${fw * 100}%`, height: `${fh * 100}%`, overflow: "hidden" }}>{inner}</div> : inner}
    </div>
  );
}

function ShapeEl({ el, pos, sr, th, block, u, id }: { el: CanvasShape; pos: CSSProperties; sr: Record<string, string>; th?: ElTheme; block: CanvasBlock; u: (pt: number) => string; id: string }) {
  const lineC = th?.line ?? el.line?.c;
  const dl = (pos as Record<string, unknown>)["--dl"];
  const dlVar = (dl ? { ["--dl"]: dl } : {}) as CSSProperties;
  if (el.geom === "line") {
    if (!el.line) return null;
    const W = block.w, H = block.h;
    let x1 = el.x * W, y1 = el.y * H, x2 = (el.x + el.w) * W, y2 = (el.y + el.h) * H;
    if (el.flipH) [x1, x2] = [x2, x1];
    if (el.flipV) [y1, y2] = [y2, y1];
    const sw = Math.max(0.25, el.line.w), head = Math.max(4, sw * 3.2);
    const cx = (el.x + el.w / 2) * W, cy = (el.y + el.h / 2) * H;
    return (
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} {...sr} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", ...dlVar }}>
        {el.arrow && (
          <defs>
            <marker id={`m${id}`} markerUnits="userSpaceOnUse" markerWidth={head} markerHeight={head} refX={head * 0.85} refY={head / 2} orient="auto-start-reverse"><path d={`M0,0 L${head},${head / 2} L0,${head} z`} fill={lineC} /></marker>
          </defs>
        )}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineC} strokeWidth={sw} strokeLinecap="round" transform={el.rot ? `rotate(${el.rot} ${cx} ${cy})` : undefined}
          markerEnd={el.arrow === "end" || el.arrow === "both" ? `url(#m${id})` : undefined} markerStart={el.arrow === "start" || el.arrow === "both" ? `url(#m${id})` : undefined} />
      </svg>
    );
  }
  if (th?.band) {
    // The slide's title band: always the app's own sidebar colour (its gradient + dot texture, components/shell/Sidebar.tsx),
    // never the publisher's / a per-provider brand shade — every lesson's band reads as this app's chrome. `bandExtra` grows
    // it a touch further down when a "slide type" label (e.g. "Explanation") dips slightly below Oak's own band box, so the
    // label stays fully backed by the band instead of spilling, unstyled, onto the paper below.
    const height = th.bandExtra ? `calc(${typeof pos.height === "number" ? `${pos.height}px` : pos.height} + ${u(th.bandExtra * block.h)})` : pos.height;
    return <div aria-hidden="true" {...sr} data-band="" style={{ ...pos, height, backgroundImage: "radial-gradient(rgba(255,255,255,.16) 1px, transparent 1.6px), var(--side-bg)", backgroundSize: "1.6cqw 1.6cqw, cover", backgroundRepeat: "repeat, no-repeat", borderRadius: "0 0 1.7cqw 1.7cqw", boxShadow: "0 .35cqw 1.3cqw var(--sb-glow2)", zIndex: 1 }} />;
  }
  const radius = el.geom === "ellipse" ? "50%" : el.geom === "round" ? u((el.r ?? 0.16667) * Math.min(el.w * block.w, el.h * block.h)) : undefined;
  return (
    <div aria-hidden="true" {...sr} style={{ ...pos, boxSizing: "border-box", background: th?.fill ?? el.fill, border: el.line ? `${u(el.line.w)} solid ${lineC}` : undefined, borderRadius: radius,
      ...(th?.outlineCard ? { boxShadow: "0 .25cqw 1cqw var(--sb-glow), inset 0 0 0 .1cqw var(--sb-a-line)" } : {}), ...rotOf(el) }} />
  );
}

// Shrink-to-fit for pupil-facing text (never while a tutor is editing, so typing/box outlines aren't disturbed): a stored
// box's height came from the original PowerPoint, sized for its OWN fonts; our substituted fonts (Lexend/Abeezee/Kalam)
// plus the fixed BASE_LH line-height can render the same words taller, which — unclipped — spills onto whatever sits
// nearby (a speech bubble's border, a neighbouring sentence, a table caption). A binary search (capped at a few
// iterations, only on mount / content change / a real container resize / once webfonts finish loading — never per
// render, per reveal-click or per keystroke) finds the largest scale (down to MIN_FIT) whose rendered height fits the
// box, applied via one CSS custom property so every run in the element shrinks together without per-run JS writes.
// If even MIN_FIT still overflows by a lot, clipping is left OFF for that element: legitimate content that genuinely
// doesn't fit is left to spill (today's behaviour), never silently cut away.
const MIN_FIT = 0.55;
const MIN_CQW = 1.25;
const SPILL_TOLERANCE = 1.6;

/** The height the text actually needs (paddings + paragraphs + their margins), independent of how tall the box is. */
function contentHeight(node: HTMLElement): number {
  const cs = getComputedStyle(node);
  let h = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  for (const c of Array.from(node.children) as HTMLElement[]) { const m = getComputedStyle(c); h += c.offsetHeight + (parseFloat(m.marginTop) || 0) + (parseFloat(m.marginBottom) || 0); }
  return h;
}

function TextEl({ el, pos, sr, th, themed, u, edit, r, capH = 1, onCommit, onGrip, onFocusText }: {
  el: CanvasText; pos: CSSProperties; sr: Record<string, string>; th?: ElTheme; themed: boolean; u: (pt: number) => string; edit: boolean; r: number; capH?: number;
  onCommit: (paras: CanvasPara[]) => void; onGrip: (e: RPointerEvent) => void; onFocusText: () => void;
}) {
  const t = useT();
  const pad = el.pad ?? [0, 0, 0, 0];
  const j = el.anchor === "m" ? "center" : el.anchor === "b" ? "flex-end" : "flex-start";
  const tt: TextTheme | undefined = themed ? th?.text : undefined;
  const scale = (size: number, f?: string) => (themed && f === "kalam" ? size * HAND_SCALE : size);
  // Never smaller than MIN_PT (9pt on a 720pt slide = 1.25cqw): source decks contain 5-8pt worksheet text that is unreadable at any screen size.
  const uf = (pt: number) => `max(calc(${u(pt)} * var(--fit, 1)), ${MIN_CQW}cqw)`;

  const textRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [clip, setClip] = useState(false);
  // Box growth: text that still does not fit at MIN_FIT grows its box downward (when nothing sits below and the slide has room) instead of being cut off / spilling.
  const [grow, setGrow] = useState(false);
  // A tutor editing sees the same fitted text a pupil does — except in the box they are typing in (true size while typing).
  const [typing, setTyping] = useState(false);
  useLayoutEffect(() => {
    if (edit && typing) { textRef.current?.style.setProperty("--fit", "1"); setFit(1); setClip(false); return; }
    const node = textRef.current;
    if (!node) return;
    let stopped = false;
    let raf = 0;
    const run = () => {
      if (stopped || !node) return;
      node.style.height = "100%"; node.style.minHeight = "";
      const wrap = node.parentElement as HTMLElement | null;
      const box = node.clientHeight * capH;
      // With a neighbour below, only the CONTENT height counts (a short text in a tall box sits well inside its cap); scrollHeight would read the whole box.
      const used = () => (capH < 1 ? contentHeight(node) : node.scrollHeight);
      if (!node.clientHeight) return;
      node.style.setProperty("--fit", "1");
      const natural = used();
      if (natural <= box + 1) { setFit(1); setClip(false); setGrow(false); return; }
      let lo = MIN_FIT, hi = 1;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        node.style.setProperty("--fit", String(mid));
        if (used() <= box + 1) lo = mid; else hi = mid;
      }
      node.style.setProperty("--fit", String(lo));
      const finalH = used();
      setFit(lo);
      const room = wrap?.offsetParent ? (wrap.offsetParent as HTMLElement).clientHeight - wrap.offsetTop : 0;
      if (finalH > box + 1 && capH === 1 && finalH <= room + 1 && finalH <= box * 3) { node.style.height = "auto"; node.style.minHeight = "100%"; setGrow(true); setClip(false); return; }
      setGrow(false);
      setClip(finalH <= box * SPILL_TOLERANCE);
    };
    run();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); });
    ro.observe(node);
    let fontsCancelled = false;
    document.fonts?.ready?.then(() => { if (!fontsCancelled) run(); }).catch(() => { /* font-loading status unavailable: keep the initial-measure fit */ });
    // `fonts.ready` can resolve BEFORE the app font (first used by this very text) has downloaded; the wider real font then wraps to more lines and the
    // measured fit is stale. Re-fit whenever a font finishes loading, and once more shortly after mount.
    const onFont = () => { if (!fontsCancelled) run(); };
    document.fonts?.addEventListener?.("loadingdone", onFont);
    const late = window.setTimeout(onFont, 700);
    return () => { stopped = true; fontsCancelled = true; ro.disconnect(); cancelAnimationFrame(raf); document.fonts?.removeEventListener?.("loadingdone", onFont); window.clearTimeout(late); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit, typing, el, capH]);

  return (
    <div data-el-wrap="" {...sr} style={{ ...pos, ...rotOf(el), isolation: "isolate", ...(tt?.on === "band" ? { zIndex: 2 } : {}) }}>
      {tt?.card && <span aria-hidden="true" style={CARD} />}
      <div ref={textRef} data-testid="canvas-text" data-canvas-text="" contentEditable={edit || undefined} suppressContentEditableWarning spellCheck={edit}
        role={edit ? "textbox" : undefined} aria-multiline={edit || undefined} aria-label={edit ? t("hublessons.csTextEdit") : undefined}
        onFocus={edit ? () => { setTyping(true); onFocusText(); try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* not supported: Enter makes a div, still read back */ } } : undefined}
        onBlur={edit ? (e) => {
          setTyping(false);
          const paras = readParas(e.currentTarget, el);
          if (JSON.stringify(paras) !== JSON.stringify(el.paras)) onCommit(paras);
        } : undefined}
        onPaste={edit ? (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); } : undefined}
        onKeyDown={edit ? (e) => { if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key)) e.preventDefault(); } : undefined}
        style={{ display: "flex", flexDirection: "column", justifyContent: j, width: "100%", height: grow ? "auto" : "100%", minHeight: grow ? "100%" : undefined,
          boxSizing: "border-box", padding: `${u(pad[1])} ${u(pad[2])} ${u(pad[3])} ${u(pad[0])}`, overflowWrap: "break-word", whiteSpace: "pre-wrap", outline: "none",
          // Edit mode never shrinks text (a tutor needs true-size WYSIWYG feedback while typing — the earlier
          // shrink-to-fit fix deliberately left this alone), but it must still stay CONTAINED to its own box:
          // real imported decks routinely place two text boxes only a few points apart (confirmed on a real
          // "Key words" canvas slide, term/definition columns ~1.8pt apart), and letting one box's overflow
          // spill out with `overflow: visible` (the old behaviour) visually merges its text into the
          // neighbouring box's — indistinguishable from a genuine layout bug. `overflow-y: auto` keeps a
          // tutor able to scroll to and edit every word without any of it bleeding onto a sibling element.
          overflowY: edit ? "auto" : undefined, overflow: edit ? undefined : clip ? "hidden" : "visible",
          ...(edit && typing ? {} : { "--fit": fit }) } as CSSProperties & Record<string, string | number | undefined>}>
        {el.paras.map((p, pi) => {
          const first = p.runs[0];
          const ml = p.ind?.[0] ?? 0, id = p.ind?.[1] ?? 0;
          const off = !edit && ((!!p.step && p.step > r) || (!!p.until && r >= p.until));
          const psize = scale(first?.size ?? 18, first?.f);
          return (
            <p key={pi} data-p={pi} data-sr={p.step || p.until ? (off ? "off" : !edit && p.step === r && r > 0 ? "fresh" : "on") : undefined} style={{ margin: 0, marginTop: p.before ? u(p.before) : undefined, marginBottom: p.after ? u(p.after) : undefined, textAlign: p.algn === "c" ? "center" : p.algn === "r" ? "right" : p.algn === "j" ? "justify" : "left",
              lineHeight: (p.lh ?? 1) * BASE_LH, fontSize: uf(psize), paddingLeft: ml ? u(ml) : undefined, textIndent: id ? u(id) : undefined, letterSpacing: tt?.display ? "-0.012em" : undefined }}>
              {p.bu && <span data-bu="" contentEditable={false} style={{ display: "inline-block", width: id < 0 ? u(-id) : undefined, textIndent: 0, fontSize: uf(psize), fontFamily: fontStack(first?.f, false), color: tt?.on === "paper" && !tt.locked ? "var(--sb-a)" : undefined }}>{p.bu}</span>}
              {p.runs.map((ru, ri) => {
                const style: CSSProperties = { fontSize: uf(scale(ru.size, ru.f)), fontWeight: ru.bold || tt?.display ? 700 : 400, fontStyle: ru.italic ? "italic" : undefined, textDecoration: ru.underline || (ru.link && !edit) ? "underline" : undefined, color: themed ? mapTextColor(ru.color, ru.bold, tt) : ru.color, fontFamily: fontStack(ru.f, !!tt?.display) };
                const body = ru.t || "​";
                return <span key={ri} data-r={ri} style={style}>{ru.link && !edit ? <a href={ru.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{body}</a> : body}</span>;
              })}
            </p>
          );
        })}
      </div>
      {edit && <button type="button" data-grip="" data-sel-focus="" aria-label={t("hublessons.csMoveTextBox")} title={t("hublessons.csDragTextBox")} onPointerDown={onGrip}
        style={{ position: "absolute", left: 0, top: 0, transform: "translate(-30%,-105%)", width: "clamp(18px, 2.6cqw, 26px)", height: "clamp(18px, 2.6cqw, 26px)", display: "grid", placeItems: "center", borderRadius: 6, border: "1.5px solid #2f6bd8", background: "#fff", color: "#2f6bd8", fontSize: 12, lineHeight: 1, cursor: "grab", touchAction: "none", padding: 0, zIndex: 45 }}>✥</button>}
    </div>
  );
}

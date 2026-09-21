"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { loadLib, type Lib } from "./SlideArt";
import { useSlideBrand } from "./brand";
import { applyDrag, nudge, reorderEl, type Guides, type Handle, type Order, type Rect } from "./canvasEdit";
import { brandVars, fontStack, mapTextColor, themeBlock, type ElTheme, type TextTheme } from "./slideTheme";
import type { CanvasBlock, CanvasEl, CanvasImg, CanvasPara, CanvasRun, CanvasShape, CanvasText } from "./types";

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

export function CanvasSlide({ block, reveal = 0, edit = false, onChange, onPick, label, onAdvance, cue, selectRequest }: {
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
}) {
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
  const bg = plan ? plan.bg : (block.bg ?? "#ffffff");
  const g = (i: number, el: CanvasEl): Rect => (live && live.i === i ? live.r : boxOf(el));
  const frameEl = selEl && sel !== null ? (edit ? g(sel, selEl) : null) : null;
  const advance = !edit && onAdvance;

  return (
    <div data-testid="canvas-frame" style={{ ...vars, ...LIGHT_VARS, borderRadius: "15px 15px 0 0", overflow: "hidden", background: "var(--sb-paper)" }}>
      <div aria-hidden="true" style={{ height: 4, background: "linear-gradient(90deg, var(--sb-a-dk), var(--sb-a) 40%, var(--sb-b) 75%, var(--sb-c))" }} />
      <div ref={paper} data-testid="canvas-slide" data-canvas-edit={edit ? "" : undefined} data-themed={themed ? "" : "original"} data-advance={advance ? "" : undefined} role="group" aria-label={label ?? "Slide"}
        onKeyDown={onKey}
        onPointerDown={edit ? (e) => { if (!(e.target as HTMLElement).closest("[data-canvas-img],[data-el-wrap],[data-frame],[data-sel-toolbar]")) setSel(null); } : undefined}
        onClick={advance ? (e) => { if ((e.target as HTMLElement).closest("a,button")) return; if (window.getSelection()?.toString()) return; onAdvance?.(); } : undefined}
        style={{ position: "relative", width: "100%", aspectRatio: `${block.w} / ${block.h}`, containerType: "inline-size", overflow: "hidden", background: bg, color: themed ? "var(--sb-ink)" : "#000", fontFamily: fontStack(undefined, false), cursor: advance ? "pointer" : undefined, userSelect: edit ? undefined : "none" }}>
        <style>{`${lib?.css ?? ""}
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
        {block.els.map((el, i) => {
          const th = plan?.els[i];
          if (th?.hide) return null;
          const gi = g(i, el);
          const hidden = (!!el.step && el.step > r) || (!!el.until && r >= el.until);
          const auto = !el.step && !!el.delay && !edit;
          const fresh = !edit && !hidden && !!el.step && el.step === reveal && reveal > 0;
          const pos: CSSProperties & Record<string, string | number | undefined> = {
            position: "absolute", left: `${gi.x * 100}%`, top: `${gi.y * 100}%`, width: `${gi.w * 100}%`, height: `${gi.h * 100}%`,
            ...(el.delay && !hidden ? { "--dl": `${el.delay}s` } : {}),
          };
          const sr = { "data-sr": hidden ? "off" : fresh ? "fresh" : "on", ...(auto ? { "data-sr-auto": "" } : {}) } as Record<string, string>;
          if (el.k === "img") return <ImgEl key={i} el={el} pos={pos} sr={sr} th={th} lib={lib} edit={edit} onDown={(e) => beginDrag(e, i, "move")} />;
          if (el.k === "shape") return <ShapeEl key={i} el={el} pos={pos} sr={sr} th={th} block={block} u={u} id={`${uid}-${i}`} />;
          return (
            <TextEl key={`${i}-${ver[i] ?? 0}`} el={el} pos={pos} sr={sr} th={th} themed={themed} u={u} edit={edit} r={r}
              onGrip={(e) => beginDrag(e, i, "move")} onFocusText={() => setSel(i)}
              onCommit={(paras) => { setVer((v) => ({ ...v, [i]: (v[i] ?? 0) + 1 })); commit(block.els.map((o, k) => (k === i && o.k === "text" ? { ...o, paras } : o))); }} />
          );
        })}

        {edit && frameEl && selEl && (
          <>
            {live && live.guides.v.map((x) => <span key={`v${x}`} aria-hidden="true" style={{ position: "absolute", left: `${x * 100}%`, top: 0, bottom: 0, width: 1, background: "#e22295", pointerEvents: "none", zIndex: 50 }} />)}
            {live && live.guides.h.map((y) => <span key={`h${y}`} aria-hidden="true" style={{ position: "absolute", top: `${y * 100}%`, left: 0, right: 0, height: 1, background: "#e22295", pointerEvents: "none", zIndex: 50 }} />)}
            <div ref={frameRef} data-frame="" data-testid="canvas-frame-sel" data-sel-focus="" tabIndex={0} role="group" aria-label={selEl.k === "img" ? "Selected picture: arrow keys move it, [ and ] change its order, Delete removes it" : "Selected text box"}
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
      {edit && (
        <div role="toolbar" aria-label="Placement" data-sel-toolbar="" data-testid="canvas-sel-toolbar" className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] text-[var(--ink-2)]" style={{ borderRadius: 0 }}>
          {selEl && sel !== null ? (
            <>
              <strong className="mr-1 text-[var(--ink)]">{selEl.k === "img" ? "Picture" : selEl.k === "text" ? "Text box" : "Shape"}</strong>
              {selEl.k === "img" && onPick && <TB onClick={() => onPick(sel)} testid="canvas-sel-change">Change…</TB>}
              <TB onClick={() => setOrder("forward")} testid="canvas-sel-forward" title="Bring forward ( ] )">Forward</TB>
              <TB onClick={() => setOrder("back")} testid="canvas-sel-back" title="Send back ( [ )">Back</TB>
              <TB onClick={remove} testid="canvas-sel-delete" title="Delete ( Delete key )" danger>Delete</TB>
              <label className="ml-1 inline-flex cursor-pointer items-center gap-1 font-semibold"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} data-testid="canvas-sel-lock" /> Keep proportions <span className="text-[var(--ink-3)]">(Shift = free)</span></label>
              <span className="ml-auto hidden text-[var(--ink-3)] md:inline">Drag to move · handles resize · arrow keys nudge · Alt = no snapping</span>
            </>
          ) : <span className="text-[var(--ink-3)]">Click a picture to move or resize it · grab a text box by its <b aria-hidden="true">✥</b> handle · click any text to edit it</span>}
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

function ImgEl({ el, pos, sr, th, lib, edit, onDown }: { el: CanvasImg; pos: CSSProperties; sr: Record<string, string>; th?: ElTheme; lib: Lib | null; edit: boolean; onDown: (e: RPointerEvent) => void }) {
  if (th?.panel) return <div aria-hidden="true" {...sr} style={{ ...pos, background: "var(--sb-card)", borderRadius: "2.4cqw", boxShadow: "0 .3cqw 1.6cqw var(--sb-glow), inset 0 0 0 .18cqw var(--sb-a-line)" }} />;
  const pic = el.picId ? lib?.byId[el.picId] : undefined;
  const c = el.crop;
  const sx = c ? 1 / Math.max(0.05, 1 - c[0] - c[2]) : 1, sy = c ? 1 / Math.max(0.05, 1 - c[1] - c[3]) : 1;
  const inner = pic
    ? <div role="img" aria-label={pic.alt} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }} dangerouslySetInnerHTML={{ __html: pic.svg }} />
    : el.url
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={el.url} alt={el.alt} draggable={false} loading="lazy"
          style={c ? { position: "absolute", maxWidth: "none", width: `${sx * 100}%`, height: `${sy * 100}%`, left: `${-c[0] * sx * 100}%`, top: `${-c[1] * sy * 100}%` } : { width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
      : <div aria-hidden="true" style={{ width: "100%", height: "100%", background: "rgba(0,0,0,.06)", border: "1px dashed rgba(0,0,0,.25)" }} />;
  const interactive = edit ? { onPointerDown: onDown } : {};
  return (
    <div data-testid="canvas-img" data-canvas-img="" data-src={el.sid ?? el.imageId ?? el.picId} {...sr} style={{ ...pos, overflow: c ? "hidden" : "visible", ...rotOf(el) }} {...interactive}>
      {inner}
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
    return <div aria-hidden="true" {...sr} data-band="" style={{ ...pos, background: `radial-gradient(120% 260% at 100% 0%, rgba(255,255,255,.2), transparent 55%), linear-gradient(100deg, var(--sb-${th.band}-dk), var(--sb-${th.band}))`, borderRadius: "0 0 1.7cqw 1.7cqw", boxShadow: "0 .35cqw 1.3cqw var(--sb-glow2)", zIndex: 1 }} />;
  }
  const radius = el.geom === "ellipse" ? "50%" : el.geom === "round" ? u((el.r ?? 0.16667) * Math.min(el.w * block.w, el.h * block.h)) : undefined;
  return <div aria-hidden="true" {...sr} style={{ ...pos, boxSizing: "border-box", background: th?.fill ?? el.fill, border: el.line ? `${u(el.line.w)} solid ${lineC}` : undefined, borderRadius: radius, ...rotOf(el) }} />;
}

function TextEl({ el, pos, sr, th, themed, u, edit, r, onCommit, onGrip, onFocusText }: {
  el: CanvasText; pos: CSSProperties; sr: Record<string, string>; th?: ElTheme; themed: boolean; u: (pt: number) => string; edit: boolean; r: number;
  onCommit: (paras: CanvasPara[]) => void; onGrip: (e: RPointerEvent) => void; onFocusText: () => void;
}) {
  const pad = el.pad ?? [0, 0, 0, 0];
  const j = el.anchor === "m" ? "center" : el.anchor === "b" ? "flex-end" : "flex-start";
  const tt: TextTheme | undefined = themed ? th?.text : undefined;
  const scale = (size: number, f?: string) => (themed && f === "kalam" ? size * HAND_SCALE : size);
  return (
    <div data-el-wrap="" {...sr} style={{ ...pos, ...rotOf(el), isolation: "isolate", ...(tt?.on === "band" ? { zIndex: 2 } : {}) }}>
      {tt?.card && <span aria-hidden="true" style={CARD} />}
      <div data-testid="canvas-text" data-canvas-text="" contentEditable={edit || undefined} suppressContentEditableWarning spellCheck={edit}
        role={edit ? "textbox" : undefined} aria-multiline={edit || undefined} aria-label={edit ? "Slide text — click to edit" : undefined}
        onFocus={edit ? () => { onFocusText(); try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch { /* not supported: Enter makes a div, still read back */ } } : undefined}
        onBlur={edit ? (e) => {
          const paras = readParas(e.currentTarget, el);
          if (JSON.stringify(paras) !== JSON.stringify(el.paras)) onCommit(paras);
        } : undefined}
        onPaste={edit ? (e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); } : undefined}
        onKeyDown={edit ? (e) => { if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key)) e.preventDefault(); } : undefined}
        style={{ display: "flex", flexDirection: "column", justifyContent: j, width: "100%", minHeight: "100%", boxSizing: "border-box", padding: `${u(pad[1])} ${u(pad[2])} ${u(pad[3])} ${u(pad[0])}`, overflowWrap: "break-word", whiteSpace: "pre-wrap", outline: "none" }}>
        {el.paras.map((p, pi) => {
          const first = p.runs[0];
          const ml = p.ind?.[0] ?? 0, id = p.ind?.[1] ?? 0;
          const off = !edit && ((!!p.step && p.step > r) || (!!p.until && r >= p.until));
          const psize = scale(first?.size ?? 18, first?.f);
          return (
            <p key={pi} data-p={pi} data-sr={p.step || p.until ? (off ? "off" : !edit && p.step === r && r > 0 ? "fresh" : "on") : undefined} style={{ margin: 0, marginTop: p.before ? u(p.before) : undefined, marginBottom: p.after ? u(p.after) : undefined, textAlign: p.algn === "c" ? "center" : p.algn === "r" ? "right" : p.algn === "j" ? "justify" : "left",
              lineHeight: (p.lh ?? 1) * BASE_LH, fontSize: u(psize), paddingLeft: ml ? u(ml) : undefined, textIndent: id ? u(id) : undefined, letterSpacing: tt?.display ? "-0.012em" : undefined }}>
              {p.bu && <span data-bu="" contentEditable={false} style={{ display: "inline-block", width: id < 0 ? u(-id) : undefined, textIndent: 0, fontSize: u(psize), fontFamily: fontStack(first?.f, false), color: tt?.on === "paper" && !tt.locked ? "var(--sb-a)" : undefined }}>{p.bu}</span>}
              {p.runs.map((ru, ri) => {
                const style: CSSProperties = { fontSize: u(scale(ru.size, ru.f)), fontWeight: ru.bold || tt?.display ? 700 : 400, fontStyle: ru.italic ? "italic" : undefined, textDecoration: ru.underline || (ru.link && !edit) ? "underline" : undefined, color: themed ? mapTextColor(ru.color, ru.bold, tt) : ru.color, fontFamily: fontStack(ru.f, !!tt?.display) };
                const body = ru.t || "​";
                return <span key={ri} data-r={ri} style={style}>{ru.link && !edit ? <a href={ru.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{body}</a> : body}</span>;
              })}
            </p>
          );
        })}
      </div>
      {edit && <button type="button" data-grip="" data-sel-focus="" aria-label="Move this text box" title="Drag to move this text box" onPointerDown={onGrip}
        style={{ position: "absolute", left: 0, top: 0, transform: "translate(-30%,-105%)", width: "clamp(18px, 2.6cqw, 26px)", height: "clamp(18px, 2.6cqw, 26px)", display: "grid", placeItems: "center", borderRadius: 6, border: "1.5px solid #2f6bd8", background: "#fff", color: "#2f6bd8", fontSize: 12, lineHeight: 1, cursor: "grab", touchAction: "none", padding: 0, zIndex: 45 }}>✥</button>}
    </div>
  );
}

"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { Icon } from "../kit";
import { BareToolContext } from "../tools/bareContext";
import { panelZ } from "../zLayers";

// A generic floating, draggable, resizable, minimisable window — portaled to document.body (or #learning-hub,
// so it inherits the hub's theme vars — see AskTeacher.tsx's identical Portal for the same reason), position:
// fixed, never modal. Built fresh for the remote-sync tool windows (see HelpTools.tsx's manager, which owns
// open/close/cascade/z-order/state); FloatingVideo.tsx's `useFloatingTile` is a different, single-tile,
// bounded-container pattern and is intentionally left untouched.

const Portal = ({ children }: { children: ReactNode }) => {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.getElementById("learning-hub") ?? document.body);
};

export interface FloatingPanelProps {
  title: string;
  icon: string;
  x: number; y: number; w: number; h: number; z: number;
  minW: number; minH: number;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onReset: () => void;
  /** Focus is returned to this element when the panel closes. */
  restoreFocusRef?: { current: HTMLElement | null };
  children: ReactNode;
}

/** 80px of the header must stay reachable, whatever the viewport does. */
const HEADER_MIN_VISIBLE = 80;
const HEADER_H = 44;

export function FloatingPanel({ title, icon, x, y, w, h, z, minW, minH, onMove, onResize, onFocus, onClose, onMinimize, onReset, restoreFocusRef, children }: FloatingPanelProps) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  // See-through: one tap fades the whole window so the question picture / text underneath shows through; tap again to bring it back. Still movable + usable.
  // Just the tool: no window frame, no white box — only the tool itself sits on the question, with a small floating pill to move / fade / bring the window back.
  const [bare, setBareRaw] = useState(false);
  const [ghost, setGhostRaw] = useState(false);
  // Remember the bare / see-through choice per tool (a tutor who likes "Just the tool" should not have to re-pick it every question).
  const prefKey = `aos.toolwin.${title}`;
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(prefKey) ?? "{}") as { bare?: boolean; ghost?: boolean }; if (v.bare) setBareRaw(true); if (v.ghost) setGhostRaw(true); } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const savePref = (b: boolean, g: boolean) => { try { localStorage.setItem(prefKey, JSON.stringify({ bare: b, ghost: g })); } catch { /* storage blocked */ } };
  const setBare = (fn: (b: boolean) => boolean) => setBareRaw((b) => { const n = fn(b); savePref(n, ghost); return n; });
  const setGhost = (fn: (g: boolean) => boolean) => setGhostRaw((g) => { const n = fn(g); savePref(bare, n); return n; });
  const minimised = h <= HEADER_H + 4;
  const titleRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resize = useRef<{ id: number; startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Focus moves into the window on open; returns to whatever opened it on close (see the manager's
  // restoreFocusRef, a ref to the sidebar pill that was clicked).
  useEffect(() => {
    // Never steal the caret from an answer box when a tool auto-opens for a question.
    const a = document.activeElement as HTMLElement | null;
    const typing = !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
    if (!typing) titleRef.current?.focus();
    return () => { const r = restoreFocusRef?.current; if (r && document.contains(r)) r.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clampPos = (nx: number, ny: number) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.max(-(w - HEADER_MIN_VISIBLE), Math.min(vw - HEADER_MIN_VISIBLE, nx)),
      y: Math.max(0, Math.min(vh - HEADER_MIN_VISIBLE, ny)),
    };
  };

  // Dragging can start anywhere on the header, including its fade / window buttons: a press on a button only becomes a drag once the pointer has
  // moved a few pixels (a plain tap still clicks). Close stays a pure button.
  const pending = useRef(false);
  const dragged = useRef(false);
  const onHeaderDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (btn && btn.getAttribute("data-drag-ok") == null && btn.getAttribute("data-no-drag") != null) return;
    onFocus();
    dragged.current = false;
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    if (btn && btn.getAttribute("data-drag-ok") == null) { pending.current = true; return; }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  // Drag from ANYWHERE on the card (normal window and "Just the tool" alike). The rim around the tool always drags; a press on a button / link / label / plain area becomes a drag
  // after a few pixels of movement (a plain tap still clicks); only fields, sliders and canvas / svg drawing surfaces keep their own pointer handling.
  const onBodyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    // Hold Option / Alt to drag from ANY point, even over a drawing surface.
    if (t !== e.currentTarget && !e.altKey) {
      if (t.closest("input,select,textarea,canvas,svg,[role=slider],[contenteditable],[draggable=true],[data-no-drag]")) return;
    }
    // A finger on the tool body scrolls it (tall tools); the pill and the rim still drag.
    if (t !== e.currentTarget && e.pointerType === "touch") return;
    onFocus();
    dragged.current = false;
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    if (t !== e.currentTarget) { pending.current = true; return; }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHeaderMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    if (pending.current) {
      if (Math.hypot(e.clientX - drag.current.startX, e.clientY - drag.current.startY) < 5) return;
      pending.current = false;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    dragged.current = true;
    const p = clampPos(drag.current.origX + (e.clientX - drag.current.startX), drag.current.origY + (e.clientY - drag.current.startY));
    onMove(p.x, p.y);
  };
  const endDrag = () => { drag.current = null; pending.current = false; };
  const noClickAfterDrag = (fn: () => void) => () => { if (dragged.current) { dragged.current = false; return; } fn(); };

  const onHeaderKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 50 : 10;
    const d = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null;
    if (!d) return;
    e.preventDefault();
    const p = clampPos(x + d[0]!, y + d[1]!);
    onMove(p.x, p.y);
  };

  // The window is anchored by its PHYSICAL top-left (`left: x`) and grows right/down, so the resize grip stays at the physical bottom-right in RTL too
  // (a logical `end-0` grip would sit on the anchored edge there and the drag maths would feel reversed). Only the title/buttons follow the text direction.
  const onResizeDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onFocus();
    resize.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, origW: w, origH: h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resize.current || resize.current.id !== e.pointerId) return;
    onResize(Math.max(minW, resize.current.origW + (e.clientX - resize.current.startX)), Math.max(minH, resize.current.origH + (e.clientY - resize.current.startY)));
  };
  const endResize = () => { resize.current = null; };
  const onResizeKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 60 : 20;
    const d = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    onResize(Math.max(minW, w + d[0]!), Math.max(minH, h + d[1]!));
  };

  const iconBtn = (label: string, name: "minus" | "refresh" | "close", onClick: () => void, testId: string) => (
    <button type="button" data-no-drag="1" onClick={onClick} aria-label={label} title={label} data-testid={testId}
      className="grid h-11 w-11 flex-none place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
      <Icon name={name} size={16} />
    </button>
  );

  return (
    <Portal>
      <div ref={rootRef} role="dialog" aria-label={title} aria-modal="false" data-floating-root="1" data-testid={`floating-panel-${title}`}
        onPointerDown={onFocus}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || e.defaultPrevented) return;
          // Escape closes the innermost layer only: a tool's own open menu / popup / dialog gets it first.
          const tg = e.target as HTMLElement;
          const inner = tg.closest("select,[role=listbox],[role=menu],[role=dialog]:not([data-floating-root]),dialog,[popover]") || rootRef.current?.querySelector('[aria-expanded="true"],[role=listbox],[role=menu],[role=alertdialog]');
          if (inner) return;
          e.stopPropagation(); onClose();
        }}
        style={{ position: "fixed", left: x, top: y, width: w, height: h, zIndex: panelZ(z), pointerEvents: bare ? "none" : undefined }} data-ghost={ghost ? "1" : "0"} data-bare={bare ? "1" : "0"}
        className={`flex flex-col overflow-hidden rounded-xl ${bare ? "" : ghost ? "border border-[var(--line)] bg-transparent" : "border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_24px_rgba(0,0,0,0.16)]"}`}>
        <div onPointerDown={onHeaderDown} onPointerMove={onHeaderMove} onPointerUp={endDrag} onPointerCancel={endDrag}
          className={bare ? "pointer-events-auto mb-1 flex max-w-full flex-none cursor-grab touch-none select-none flex-wrap items-center gap-1 self-start rounded-3xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-1 shadow-md" : `flex flex-none cursor-grab touch-none select-none items-center gap-1.5 border-b border-[var(--line)] ps-1 ${ghost ? "bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] shadow-sm" : "bg-[var(--panel)]"}`}
          style={bare ? { minHeight: 48 } : { height: HEADER_H }}>
          <button ref={titleRef} type="button" data-drag-ok="1" onKeyDown={onHeaderKey}
            aria-label={t("hublive.dMoveAria", { title })}
            className={`flex h-11 min-w-0 items-center gap-1.5 rounded-lg px-2 text-start text-[12.5px] font-extrabold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${bare ? "" : "flex-1"}`}>
            <span aria-hidden className="text-[14px]">{bare ? "⠿" : icon}</span>{bare ? <span className="text-[12px]">{t("hubtoolsui.move")}</span> : <span className="truncate">{title}</span>}
          </button>
          <button type="button" onClick={noClickAfterDrag(() => setGhost((g) => !g))} aria-pressed={ghost} aria-label={ghost ? t("hublive.dMakeSolid") : t("hublive.dMakeGhostAria")} title={ghost ? t("hublive.dMakeSolid") : t("hublive.dSeeThrough")} data-testid="floating-panel-ghost"
            className={`flex h-11 min-w-[44px] flex-none items-center justify-center gap-1.5 rounded-full border px-2.5 text-[12px] font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${ghost ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--line)]"}`}>
            <span aria-hidden className="text-[16px] leading-none">◐</span><span>{ghost ? t("hubtoolsui.solid") : t("hubtoolsui.seeThrough")}</span>
          </button>
          <button type="button" onClick={noClickAfterDrag(() => setBare((b) => !b))} aria-pressed={bare} aria-label={bare ? t("hublive.dShowWindowAria") : t("hublive.dJustToolAria")} title={bare ? t("hublive.dShowWindow") : t("hublive.dJustTool")} data-testid="floating-panel-bare"
            className={`flex h-11 min-w-[44px] flex-none items-center justify-center gap-1.5 rounded-full border px-2.5 text-[12px] font-extrabold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${bare ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--line)]"}`}>
            <span aria-hidden className="text-[15px] leading-none">{bare ? "▣" : "▢"}</span><span>{bare ? t("hubtoolsui.backToWindow") : t("hublive.dJustTool")}</span>
          </button>
          {bare && (<span className="flex flex-none items-center gap-1">
            <button type="button" onClick={noClickAfterDrag(() => onResize(Math.max(minW, Math.round(w * 0.85)), Math.max(minH, Math.round(h * 0.85))))} aria-label={t("hublive.dMakeSmaller")} title={t("hublive.dSmaller")} data-testid="floating-panel-smaller"
              className="grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[18px] font-extrabold leading-none text-[var(--ink)] hover:bg-[var(--line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">−</button>
            <button type="button" onClick={noClickAfterDrag(() => onResize(Math.round(w * 1.18), Math.round(h * 1.18)))} aria-label={t("hublive.dMakeBigger")} title={t("hublive.dBigger")} data-testid="floating-panel-bigger"
              className="grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[18px] font-extrabold leading-none text-[var(--ink)] hover:bg-[var(--line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">+</button>
            {w >= 520 && <button type="button" onClick={noClickAfterDrag(onReset)} aria-label={t("hublive.dPutBack")} title={t("hublive.dResetSizePos")} data-testid="floating-panel-reset-bare"
              className="grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"><Icon name="refresh" size={15} /></button>}
          </span>)}
          {!bare && w >= 420 && iconBtn(t("hublive.dMinimise"), "minus", onMinimize, "floating-panel-minimize")}
          {!bare && w >= 420 && iconBtn(t("hublive.dReset"), "refresh", onReset, "floating-panel-reset")}
          {iconBtn(t("hublive.dCloseLabel", { label: title }), "close", onClose, "floating-panel-close")}
        </div>
        <div onPointerDown={onBodyDown} onPointerMove={onHeaderMove} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } }} className={`min-h-0 flex-1 overflow-auto text-[13px] motion-safe:transition-opacity ${bare ? "pointer-events-none select-none p-2 pb-14 [text-shadow:0_0_2px_var(--surface),0_0_5px_var(--surface)] [&_:is(button,input,select,textarea,[data-tool-strip])]:[text-shadow:none] [&_svg_text]:[paint-order:stroke] [&_svg_text]:[stroke:color-mix(in_srgb,var(--surface)_88%,transparent)] [&_svg_text]:[stroke-width:3px] [&_svg_text]:[stroke-linejoin:round] [&>div]:!pointer-events-none [&>div>*]:!pointer-events-none [&>div>*>*]:!pointer-events-auto [&_:is(button,input,select,textarea,canvas,svg,a,label,summary,[role=slider],[role=button],[data-tool-strip],[data-no-drag])]:!pointer-events-auto [&_:is(button,a,label,svg,[role=button],[data-tool-strip])_*]:!pointer-events-auto [&_:is(div,svg)[data-bare-pass]]:!pointer-events-none [&_[data-tool-chrome]]:!hidden [&_[data-tool-strip]]:w-fit [&_[data-tool-strip]]:rounded-2xl [&_[data-tool-strip]]:border [&_[data-tool-strip]]:border-[var(--line)] [&_[data-tool-strip]]:bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] [&_[data-tool-strip]]:px-2 [&_[data-tool-strip]]:py-1 [&_[data-tool-strip]]:shadow-md" : "p-3"}`} data-testid="floating-panel-body" style={{ opacity: ghost ? 0.45 : 1 }}><BareToolContext.Provider value={bare}>{children}</BareToolContext.Provider></div>
        {!minimised && (
          <div onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize} onKeyDown={onResizeKey}
            aria-label={t("hublive.dResizeTitle", { title })} role="slider" tabIndex={0} aria-orientation="horizontal" aria-valuemin={minW} aria-valuemax={typeof window === "undefined" ? 2000 : Math.max(minW, window.innerWidth)} aria-valuenow={Math.round(w)} aria-valuetext={t("hubtoolsui.resizeValue", { w: Math.round(w), h: Math.round(h) })} data-testid="floating-panel-resize"
            className="pointer-events-auto absolute bottom-0 right-0 grid h-11 w-11 cursor-nwse-resize touch-none place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
            <span aria-hidden className={bare ? "grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[15px] font-extrabold text-[var(--ink-2)] shadow-md" : "h-4 w-4 self-end justify-self-end"} style={bare ? undefined : { background: "linear-gradient(135deg, transparent 50%, var(--ink-3) 50%)" }}>{bare ? "⤡" : null}</span>
          </div>
        )}
      </div>
    </Portal>
  );
}

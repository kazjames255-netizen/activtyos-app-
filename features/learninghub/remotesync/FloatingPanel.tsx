"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Icon } from "../kit";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resize = useRef<{ id: number; startX: number; startY: number; origW: number; origH: number } | null>(null);

  // Focus moves into the window on open; returns to whatever opened it on close (see the manager's
  // restoreFocusRef, a ref to the sidebar pill that was clicked).
  useEffect(() => {
    titleRef.current?.focus();
    return () => { restoreFocusRef?.current?.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clampPos = (nx: number, ny: number) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.max(-(w - HEADER_MIN_VISIBLE), Math.min(vw - HEADER_MIN_VISIBLE, nx)),
      y: Math.max(0, Math.min(vh - HEADER_MIN_VISIBLE, ny)),
    };
  };

  const onHeaderDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // don't drag when pressing a header button
    onFocus();
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHeaderMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const p = clampPos(drag.current.origX + (e.clientX - drag.current.startX), drag.current.origY + (e.clientY - drag.current.startY));
    onMove(p.x, p.y);
  };
  const endDrag = () => { drag.current = null; };

  const onHeaderKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 50 : 10;
    const d = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null;
    if (!d) return;
    e.preventDefault();
    const p = clampPos(x + d[0]!, y + d[1]!);
    onMove(p.x, p.y);
  };

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

  const iconBtn = (label: string, name: "minus" | "refresh" | "close", onClick: () => void, testId: string) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} data-testid={testId}
      className="grid h-11 w-11 flex-none place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
      <Icon name={name} size={16} />
    </button>
  );

  return (
    <Portal>
      <div ref={rootRef} role="dialog" aria-label={title} aria-modal="false" data-testid={`floating-panel-${title}`}
        onPointerDown={onFocus}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
        style={{ position: "fixed", left: x, top: y, width: w, height: h, zIndex: z }}
        className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
        <div onPointerDown={onHeaderDown} onPointerMove={onHeaderMove} onPointerUp={endDrag} onPointerCancel={endDrag}
          className="flex flex-none cursor-grab touch-none select-none items-center gap-1.5 border-b border-[var(--line)] bg-[var(--panel)] pl-1" style={{ height: HEADER_H }}>
          <button ref={titleRef} type="button" onKeyDown={onHeaderKey}
            aria-label={`Move ${title}. Use the arrow keys; hold Shift to move faster.`}
            className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 text-left text-[12.5px] font-extrabold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
            <span aria-hidden className="text-[14px]">{icon}</span><span className="truncate">{title}</span>
          </button>
          {iconBtn("Minimise", "minus", onMinimize, "floating-panel-minimize")}
          {iconBtn("Reset", "refresh", onReset, "floating-panel-reset")}
          {iconBtn(`Close ${title}`, "close", onClose, "floating-panel-close")}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 text-[13px]">{children}</div>
        <div onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={endResize} onPointerCancel={endResize}
          aria-label={`Resize ${title}`} role="separator" tabIndex={-1}
          className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize touch-none"
          style={{ background: "linear-gradient(135deg, transparent 50%, var(--ink-3) 50%)" }} />
      </div>
    </Portal>
  );
}

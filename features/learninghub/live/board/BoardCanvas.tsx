"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardController, Ptr } from "./controller";
import { LINE_H, MAX_TEXT_CHARS } from "./model";

// The drawing surface: one canvas (crisp on high-DPI screens), pointer events
// for mouse / touch / pen (with pressure and coalesced samples), wheel + pinch
// zoom, and the in-place text editor. All logic lives in BoardController; this
// only forwards events and paints when the controller says something changed.

function mkPtr(e: PointerEvent | React.PointerEvent, box: DOMRect): Ptr {
  return { id: e.pointerId, type: e.pointerType, x: e.clientX - box.left, y: e.clientY - box.top, pressure: e.pressure, shift: e.shiftKey, alt: e.altKey, button: e.button, buttons: e.buttons, t: e.timeStamp || performance.now() }; // the EVENT's time (not when a busy main thread got round to it): double-click / palm-rejection windows stay true under load
}

/** The board the person last used — page-level shortcuts go to it (a lesson page can hold several boards). */
let lastBoard: HTMLElement | null = null;

export function BoardCanvas({ ctrl, label, active }: { ctrl: BoardController; label: string; active: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);

  // repaint the React overlay (text editor, cursor) when the controller changes
  useEffect(() => ctrl.subscribe(() => force((n) => n + 1)), [ctrl]);

  // size + paint loop
  useEffect(() => {
    const el = wrap.current, cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.round(r.width), h = Math.round(r.height);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctrl.setSize(w, h, dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    let raf = 0;
    const loop = () => { raf = requestAnimationFrame(loop); if (!document.hidden && el.offsetParent !== null) ctrl.draw(ctx); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [ctrl, active]);

  // wheel needs { passive: false } to be able to preventDefault
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      ctrl.wheel(e.clientX - r.left, e.clientY - r.top, e.deltaX, e.deltaY, e.deltaMode, e.ctrlKey || e.metaKey);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ctrl]);

  // Keyboard shortcuts (Ctrl+Z, Delete, arrows, tool letters…) keep working after a click on a toolbar button: the surface only owns
  // the keyboard while it has focus, so listen on the page too — for this board only, and never while typing in a field.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const shell = (el.closest('[data-testid="board-shell"]') as HTMLElement | null) ?? el;
    const mark = () => { lastBoard = shell; };
    shell.addEventListener("pointerdown", mark, true); shell.addEventListener("focusin", mark, true);
    // a click anywhere else (chat, the video, another panel) means the person is no longer working on this board
    const away = (e: PointerEvent) => { if (lastBoard === shell && !shell.contains(e.target as Node | null)) lastBoard = null; };
    document.addEventListener("pointerdown", away, true);
    const onDoc = (down: boolean) => (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || el.contains(t) || lastBoard !== shell || !active || el.offsetParent === null) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || t.closest("[role=dialog]")) return;
      if (t.tagName === "BUTTON" && (e.key === " " || e.key === "Enter")) return; // a focused button keeps its own Space / Enter
      if (!(t === document.body || shell.contains(t))) return;
      if (ctrl.key(e, down)) { e.preventDefault(); e.stopPropagation(); }
    };
    const kd = onDoc(true), ku = onDoc(false);
    document.addEventListener("keydown", kd); document.addEventListener("keyup", ku);
    return () => { document.removeEventListener("pointerdown", away, true); shell.removeEventListener("pointerdown", mark, true); shell.removeEventListener("focusin", mark, true); document.removeEventListener("keydown", kd); document.removeEventListener("keyup", ku); if (lastBoard === shell) lastBoard = null; };
  }, [ctrl, active]);

  const box = () => wrap.current!.getBoundingClientRect();
  const onDown = (e: React.PointerEvent) => {
    if (e.button > 1 && e.pointerType === "mouse") return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone (or synthetic) — carry on */ }
    // Text / sticky open a typing box: the browser's own mousedown focus change (to this surface) must not steal it back.
    if (ctrl.ui.tool === "text" || ctrl.ui.tool === "sticky") e.preventDefault();
    else wrap.current?.focus({ preventScroll: true });
    if (e.button === 1) e.preventDefault();
    ctrl.pointerDown(mkPtr(e, box()));
  };
  const onMove = (e: React.PointerEvent) => {
    const b = box();
    const co = (e.nativeEvent as PointerEvent).getCoalescedEvents?.();
    const list = co && co.length ? co.map((c) => mkPtr(c, b)) : [mkPtr(e, b)];
    ctrl.pointerMove(list);
  };
  const onUp = (e: React.PointerEvent) => { ctrl.pointerUp(mkPtr(e, box())); };
  const onCancel = (e: React.PointerEvent) => { ctrl.pointerCancel(mkPtr(e, box())); };

  const onKey = (e: React.KeyboardEvent, down: boolean) => {
    const t = e.target as HTMLElement;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
    if (ctrl.key(e, down)) { e.preventDefault(); e.stopPropagation(); }
  };

  const d = ctrl.editing;
  const k = ctrl.view.k;
  const cursor =
    ctrl.panning || ctrl.ui.tool === "pan" || !ctrl.canDraw && ctrl.ui.tool !== "laser" ? "grab"
      : ctrl.ui.tool === "select" ? "default"
        : ctrl.ui.tool === "text" ? "text"
          : ctrl.ui.tool === "eraser" ? "none" : "crosshair";

  return (
    <div ref={wrap} tabIndex={0} role="application" aria-label={label} data-testid="board-surface" data-tool={ctrl.ui.tool}
      onKeyDown={(e) => onKey(e, true)} onKeyUp={(e) => onKey(e, false)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) ctrl.releaseKeys(); }}
      className="relative h-full w-full touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-2)]"
      style={{ cursor, background: "var(--surface)", touchAction: "none" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onPointerLeave={() => ctrl.pointerLeave()}
      onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" style={{ width: "100%", height: "100%" }} data-testid="board-canvas" />
      {d && <TextEditor ctrl={ctrl} key={d.id ?? "new"} k={k} />}
    </div>
  );
}

function TextEditor({ ctrl, k }: { ctrl: BoardController; k: number }) {
  const d = ctrl.editing!;
  const ref = useRef<HTMLTextAreaElement>(null);
  const born = useRef(Date.now());
  useEffect(() => {
    const focus = () => { const t = ref.current; if (t && document.activeElement !== t) { t.focus({ preventScroll: true }); t.setSelectionRange(t.value.length, t.value.length); } };
    focus();
    // the pointer that opened the box is still finishing (pointerup / click / focus moves): claim focus again after it
    const ids = [setTimeout(focus, 0), setTimeout(focus, 60), setTimeout(focus, 200)];
    return () => ids.forEach(clearTimeout);
  }, []);
  const sx = ctrl.view.x + d.x * k, sy = ctrl.view.y + d.y * k;
  const sticky = d.kind === "sticky", inShape = d.kind === "shape";
  const lines = Math.max(1, d.text.split("\n").length);
  const lay = inShape ? ctrl.labelLayout(d) : null;
  const fs = (lay ? lay.size : d.size) * k;
  const boxW = inShape ? d.w * k : sticky ? d.w * k : Math.max(200, ctrl.textBoxOf({ id: "", k: "text", own: "", z: 0, v: 0, text: d.text, size: d.size, bold: d.bold, x: 0, y: 0 }).w * k + 48);
  // a shape's label sits inside the shape (centred by default) and grows as you type — exactly where the painter puts it afterwards
  const contentH = lay ? Math.max(1, lay.lines.length) * fs * LINE_H + fs * 0.5 : 0;
  const boxH = inShape ? Math.min(d.h * k, contentH) : sticky ? d.h * k : lines * fs * LINE_H + 10;
  const top = inShape ? sy + (d.va === "t" ? 0 : d.va === "b" ? d.h * k - boxH : (d.h * k - boxH) / 2) : sy;
  const ph = inShape ? (d.ph ?? "Type here…") : sticky ? "Write a note…" : "Type here…";
  const commitAndMove = (dir: 1 | -1) => ctrl.tabEdit(dir);
  return (
    <textarea ref={ref} value={d.text} aria-label={sticky ? "Sticky note text" : inShape ? "Type in the shape" : "Type on the board"} data-testid="board-text-input" spellCheck maxLength={MAX_TEXT_CHARS}
      onChange={(e) => ctrl.setEditText(e.target.value)}
      onBlur={() => { if (Date.now() - born.current < 350) { ref.current?.focus({ preventScroll: true }); return; } ctrl.commitEdit(); }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) { e.preventDefault(); ctrl.commitEdit(); }
        else if (e.key === "Tab" && inShape) { e.preventDefault(); commitAndMove(e.shiftKey ? -1 : 1); }
      }}
      className={`absolute resize-none overflow-hidden ${inShape ? "rounded-sm border border-dashed" : "rounded-md border-2 border-dashed"} border-[var(--brand-2)] p-0 outline-none`}
      style={{
        left: sx - (sticky || inShape ? 0 : 2), top, width: boxW, height: inShape ? Math.max(boxH, fs * LINE_H + 4) : Math.max(boxH, fs * LINE_H + 8), fontSize: fs, lineHeight: LINE_H, fontWeight: d.bold ? 700 : 500, color: sticky ? "#1b1f2a" : d.c,
        textAlign: inShape ? (d.al === "l" ? "left" : d.al === "r" ? "right" : "center") : undefined,
        background: sticky ? d.c : inShape ? "transparent" : "color-mix(in srgb, var(--surface) 70%, transparent)", padding: sticky ? 11 * k : 0, fontFamily: ctrl.paper.font,
      }}
      placeholder={ph} />
  );
}

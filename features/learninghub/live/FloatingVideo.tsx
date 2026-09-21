"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { FOCUS } from "../teachKit";
import { Ico } from "../teachIcons";
import { findSpot, type R } from "./tileSpot";

// A draggable, resizable floating video tile (the call in "Workspace only" mode,
// and the whiteboard's "Present" mode). The tile is a frame with a slim handle bar
// on top (grip + S/M/L + minimise + reset + optional expand) and the video below it.
//   • drag the grip (mouse/touch/pen) — or focus it and use the arrow keys (Shift = bigger steps)
//   • it stays inside its container (re-clamped on resize / rotation) and snaps to a corner when
//     dropped within ~80px of one, otherwise it stays exactly where it was dropped
//   • three sizes; minimise to a small "Video" pill; reset puts it back bottom-right
//   • position + size are remembered per browser (localStorage, guarded)
// While dragging, the video underneath is made inert so the iframe can't swallow the pointer.
//
// The tile must never sit on the board's controls. Anything the board wants kept clear is marked
// `data-board-avoid` (tool rail, options bar, top bar groups, status pill). While the tile floats it
//   • is moved to the nearest spot that overlaps none of them (re-checked as the controls change), and
//   • if there is no such spot (a small board), or the container is phone-sized, is DOCKED instead: a normal
//     flex child beside (desktop) or above (phone / portrait) the workspace, so nothing is ever covered.
// The "Dock / Float" button lets the person choose; dropping the tile on a control just nudges it clear.

const INSET = 16;
const SNAP = 80;
const BAR = 44;
const KEY = "hub-video-tile";
type Size = "s" | "m" | "l";
interface TileState { size: Size; /** 0–1 across the space the tile may occupy (0 = left/top inset, 1 = right/bottom inset). */ fx: number; fy: number; /** The person chose to dock it. */ docked?: boolean }
const DEFAULT: TileState = { size: "m", fx: 1, fy: 1 };
const WIDTHS: Record<Size, number> = { s: 320, m: 420, l: 560 };
const PHONE: Record<Size, number> = { s: 190, m: 250, l: 320 };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

function load(key: string): TileState {
  try {
    const r = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<TileState> | null;
    if (r && (r.size === "s" || r.size === "m" || r.size === "l") && Number.isFinite(r.fx) && Number.isFinite(r.fy)) return { size: r.size, fx: clamp(r.fx!, 0, 1), fy: clamp(r.fy!, 0, 1), docked: r.docked === true };
  } catch { /* storage blocked */ }
  return DEFAULT;
}

export interface FloatingTile {
  /** className for the tile's outer element (positioning + look). */
  tileClass: string;
  tileStyle: CSSProperties;
  /** Render as the FIRST child of the tile. */
  chrome: ReactNode;
  /** className for the wrapper around the video itself. */
  stageClass: string;
  dragging: boolean;
  minimised: boolean;
  /** Sitting in the layout (beside / above the workspace) rather than floating over it. */
  docked: boolean;
}

function readAvoid(root: HTMLElement): R[] {
  const base = root.getBoundingClientRect();
  const out: R[] = [];
  root.querySelectorAll<HTMLElement>("[data-board-avoid]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return; // not showing
    out.push({ x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height) });
  });
  return out;
}

export function useFloatingTile({ active, boundsRef, storageKey = KEY, onExpand, dockSide = "right" }: {
  active: boolean;
  /** Where a docked tile goes: a column on the right (wide rooms) or a strip on top (phones, portrait tablets). */
  dockSide?: "right" | "top";
  /** The (position: relative) container the tile lives in and is kept inside. */
  boundsRef: RefObject<HTMLElement | null>;
  storageKey?: string;
  /** Adds an "expand" button (e.g. back to the split layout). */
  onExpand?: () => void;
}): FloatingTile {
  const [st, setSt] = useState<TileState>(DEFAULT);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [min, setMin] = useState(false);
  const start = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  useEffect(() => { setSt(load(storageKey)); }, [storageKey]);
  const save = useCallback((n: TileState) => { setSt(n); try { localStorage.setItem(storageKey, JSON.stringify(n)); } catch { /* not remembered — fine */ } }, [storageKey]);

  // Track the container's size (also covers rotation / window resize).
  useEffect(() => {
    const el = boundsRef.current;
    if (!el || !active) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boundsRef, active]);

  const phone = box.w > 0 && box.w < 640;
  const w = min ? 168 : clamp((phone ? PHONE : WIDTHS)[st.size], 150, Math.max(150, box.w - 2 * INSET));
  const h = min ? BAR : BAR + Math.round((w * 10) / 16);
  const availX = Math.max(0, box.w - w - 2 * INSET), availY = Math.max(0, box.h - h - 2 * INSET);
  const prefX = INSET + st.fx * availX, prefY = INSET + st.fy * availY;

  // Where the board's controls are (polled: they move as tools change and the pane resizes).
  const [avoid, setAvoid] = useState<R[]>([]);
  const [forced, setForced] = useState(false); // no clear spot: dock instead
  const docked = active && (st.docked === true || phone || forced);
  const floating = active && !docked;
  useEffect(() => { setForced(false); }, [box.w, box.h, st.size, min, active]);
  useEffect(() => {
    const root = boundsRef.current;
    if (!root || !floating) { setAvoid((a0) => (a0.length ? [] : a0)); return; }
    let last = "";
    const read = () => {
      if (drag) return;
      const r = readAvoid(root), key = r.map((q) => `${q.x},${q.y},${q.w},${q.h}`).join("|");
      if (key !== last) { last = key; setAvoid(r); }
    };
    read();
    const id = setInterval(read, 400);
    return () => clearInterval(id);
  }, [boundsRef, floating, drag]);
  const spot = useMemo(
    () => (floating ? findSpot(prefX, prefY, w, h, box, avoid) : null),
    [floating, prefX, prefY, w, h, box, avoid],
  );
  useEffect(() => { if (floating && !drag && avoid.length && !spot) setForced(true); }, [floating, drag, avoid, spot]);
  const px = drag ? clamp(drag.x, INSET, INSET + availX) : spot?.x ?? prefX;
  const py = drag ? clamp(drag.y, INSET, INSET + availY) : spot?.y ?? prefY;

  const commit = (x: number, y: number) => {
    let fx = availX ? clamp((x - INSET) / availX, 0, 1) : 1, fy = availY ? clamp((y - INSET) / availY, 0, 1) : 1;
    // Within ~80px of a corner → snap to it.
    const nx = fx < 0.5 ? 0 : 1, ny = fy < 0.5 ? 0 : 1;
    const cx = INSET + nx * availX, cy = INSET + ny * availY;
    if (Math.hypot(x - cx, y - cy) <= SNAP) { fx = nx; fy = ny; }
    save({ ...st, fx, fy });
  };

  const onDown = (e: React.PointerEvent) => {
    if (docked || (e.target as HTMLElement).closest("button[data-tile-btn]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, ox: px, oy: py };
    setDrag({ x: px, y: py });
  };
  const onMove = (e: React.PointerEvent) => { const s = start.current; if (s) setDrag({ x: s.ox + e.clientX - s.px, y: s.oy + e.clientY - s.py }); };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (s && drag) commit(s.ox + e.clientX - s.px, s.oy + e.clientY - s.py);
    setDrag(null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (docked) return;
    const step = e.shiftKey ? 64 : 16;
    const d = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null;
    if (!d) return;
    e.preventDefault();
    const x = clamp(px + d[0]!, INSET, INSET + availX), y = clamp(py + d[1]!, INSET, INSET + availY);
    save({ ...st, fx: availX ? (x - INSET) / availX : 1, fy: availY ? (y - INSET) / availY : 1 });
  };

  const sizeBtn = (k: Size, label: string) => (
    <button key={k} type="button" data-tile-btn data-tile-size={k} aria-pressed={st.size === k && !min} aria-label={`${label} video`} onClick={() => { setMin(false); save({ ...st, size: k }); }}
      className={`grid h-11 w-9 place-items-center rounded-lg text-[12px] font-extrabold ${FOCUS} ${st.size === k && !min ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "text-[var(--ink-2)] hover:bg-[var(--panel)]"}`}>{k.toUpperCase()}</button>
  );
  const iconBtn = (label: string, icon: "close" | "refresh" | "video" | "maximize", on: () => void, attr: string) => (
    <button type="button" data-tile-btn {...{ [attr]: "" }} aria-label={label} title={label} onClick={on} className={`grid h-11 w-10 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}><Ico name={icon} size={15} /></button>
  );

  const chrome = active ? (
    <div className={`flex flex-none touch-none select-none items-center gap-0.5 border-b border-[var(--hub-warm-line)] px-1 ${docked ? "" : drag ? "cursor-grabbing" : "cursor-grab"}`} style={{ height: BAR, background: "var(--hub-warm)" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="video-tile-bar">
      <button type="button" data-tile-grip aria-label="Move the video. Use the arrow keys; hold Shift to move faster." onKeyDown={onKey}
        className={`flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 text-left text-[11.5px] font-extrabold text-[var(--ink-2)] ${FOCUS}`}>
        <span aria-hidden className="grid grid-cols-3 gap-[3px] opacity-60">{Array.from({ length: 6 }, (_, i) => <i key={i} className="h-[3px] w-[3px] rounded-full bg-[var(--ink-2)]" />)}</span>
        <span className="truncate">Video</span>
      </button>
      {!min && !phone && (<>{sizeBtn("s", "Small")}{sizeBtn("m", "Medium")}{sizeBtn("l", "Large")}</>)}
      {!min && !phone && (
        <button type="button" data-tile-btn data-tile-dock aria-pressed={docked} title={docked ? "Let the video float over the workspace" : "Dock the video beside the workspace so it covers nothing"}
          onClick={() => save({ ...st, docked: !docked })} className={`grid h-11 min-w-[44px] place-items-center rounded-lg px-1.5 text-[11.5px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>{docked ? "Float" : "Dock"}</button>
      )}
      {onExpand && !min && iconBtn("Show the video larger", "maximize", onExpand, "data-tile-expand")}
      {min ? iconBtn("Restore the video", "video", () => setMin(false), "data-tile-restore") : iconBtn("Minimise the video", "close", () => setMin(true), "data-tile-min")}
      {iconBtn("Reset position and size", "refresh", () => { setMin(false); save(DEFAULT); }, "data-tile-reset")}
    </div>
  ) : null;

  // docked: a normal flex child (never over anything); floating: absolutely positioned over the workspace
  const dockW = dockSide === "right" ? clamp(w, 200, Math.max(200, Math.round(box.w * 0.42))) : Math.min(w, 220, Math.max(150, box.w));
  const dockH = min ? BAR : BAR + Math.round((dockW * 10) / 16);
  const look = "flex flex-col overflow-hidden rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--brand-ink)] shadow-[0_18px_44px_rgba(0,0,0,0.35)]";
  return {
    docked,
    tileClass: docked ? `relative flex-none ${look}` : `absolute z-30 ${look} motion-safe:transition-[left,top,width,height] motion-safe:duration-200 motion-reduce:transition-none`,
    tileStyle: docked
      ? { width: min ? 168 : dockW, height: dockH, alignSelf: "flex-start", order: dockSide === "right" ? 2 : 0 }
      : { left: px, top: py, width: w, height: h, ...(drag ? { transition: "none" } : {}) },
    chrome,
    stageClass: min ? "pointer-events-none absolute h-px w-px overflow-hidden opacity-0" : `min-h-0 flex-1 ${drag ? "pointer-events-none" : ""}`,
    dragging: !!drag,
    minimised: min,
  };
}

/** The reusable wrapper: a floating video tile inside `boundsRef` (a `position: relative` container). */
export function FloatingVideo({ boundsRef, children, storageKey, onExpand }: { boundsRef: RefObject<HTMLElement | null>; children: ReactNode; storageKey?: string; onExpand?: () => void }) {
  const t = useFloatingTile({ active: true, boundsRef, storageKey, onExpand });
  return (
    <div className={t.tileClass} style={t.tileStyle} data-testid="floating-video" data-docked={t.docked ? "1" : "0"}>
      {t.chrome}
      <div className={t.stageClass}>{children}</div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import type { MatchAnswer, OrderAnswer, Piece } from "./api";
import { FOCUS } from "./ui";

// The two "arrange it" answer inputs: MATCH (drag each definition onto its term, or tap one
// then the other) and ORDER (drag items into sequence, or use the arrow buttons). Ported from
// the reference in scratch/prototype/template.html (buildMatch / buildOrder): Pointer Events so
// mouse, touch and pen behave alike, window-level move/up listeners (a node that is re-ordered in
// the DOM loses pointer capture), and a forgiving drop — a tile released within 48px of a slot
// still lands in it, so the layout shifting under the finger can't lose a drop.
// Rendering only. The server marks; nothing here knows the key.

const NEAR = 48; // px — how close to a slot a released tile may be
const MOVED = 6; // px — less than this is a tap, not a drag

const pieceImg = (p: Piece) => p.image?.url
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={p.image.url} alt={p.image.alt ?? ""} draggable={false} loading="lazy" className="mb-1 max-h-24 w-auto max-w-full rounded-lg object-contain" />
  : null;

// ── order ────────────────────────────────────────────────────────────────────

/** The arrangement (indexes into `items`) a stored answer describes, or the presented order. */
function orderFrom(items: string[], value: OrderAnswer | undefined): number[] {
  const ident = items.map((_, i) => i);
  if (!value || value.items.length !== items.length) return ident;
  const used = new Set<number>();
  const out: number[] = [];
  for (const text of value.items) {
    const i = items.findIndex((x, k) => x === text && !used.has(k));
    if (i < 0) return ident;
    used.add(i); out.push(i);
  }
  return out;
}

const moveTo = (order: number[], from: number, to: number) => { const a = [...order]; const [m] = a.splice(from, 1); a.splice(to, 0, m); return a; };

export function OrderInput({ items, value, onChange, disabled }: { items: string[]; value: OrderAnswer | undefined; onChange: (v: OrderAnswer) => void; disabled?: boolean }) {
  const [order, setOrder] = useState<number[]>(() => orderFrom(items, value));
  const [dragI, setDragI] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const orderRef = useRef(order); orderRef.current = order;
  const listRef = useRef<HTMLOListElement>(null);
  const off = useRef<(() => void) | null>(null);
  useEffect(() => () => off.current?.(), []);
  const answered = !!value?.items?.length;

  const commit = (next: number[]) => { orderRef.current = next; setOrder(next); onChange({ kind: "order", items: next.map((i) => items[i]) }); };

  const step = (pos: number, d: -1 | 1) => {
    const to = pos + d;
    if (to < 0 || to >= order.length) return;
    commit(moveTo(order, pos, to));
    setSaid(`Moved ${items[order[pos]]} to position ${to + 1} of ${order.length}`);
  };

  const down = (e: ReactPointerEvent<HTMLLIElement>, i: number) => {
    if (disabled || (e.target as HTMLElement).closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    off.current?.();
    const el = e.currentTarget;
    const pid = e.pointerId;
    const grab = e.clientY - el.getBoundingClientRect().top;
    setDragI(i);
    // Keep the card under the pointer wherever the list re-flowed it: measure its natural top, then offset.
    const follow = (y: number) => { el.style.transform = "none"; el.style.transform = `translateY(${y - grab - el.getBoundingClientRect().top}px)`; };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid || !listRef.current) return;
      const kids = [...listRef.current.children];
      let target = 0;
      kids.filter((k) => k !== el).forEach((k) => { const r = k.getBoundingClientRect(); if (ev.clientY > r.top + r.height / 2) target++; });
      const cur = kids.indexOf(el);
      if (target !== cur) flushSync(() => commit(moveTo(orderRef.current, cur, target)));
      follow(ev.clientY);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      off.current?.();
    };
    const stop = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
      el.style.transform = ""; setDragI(null); off.current = null;
    };
    off.current = stop;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  };

  return (
    <div data-testid="hub-order">
      <ol ref={listRef} className="m-0 grid list-none gap-2.5 p-0" aria-label="Items to put in order. Drag them, or use the arrow buttons.">
        {order.map((it, pos) => (
          <li key={it} data-testid="hub-order-item" data-pos={pos} onPointerDown={(e) => down(e, it)}
            className={`relative flex touch-none select-none items-center gap-3 rounded-[13px] border-2 bg-[var(--surface)] px-3.5 py-3 ${disabled ? "opacity-60" : "cursor-grab"} ${dragI === it ? "z-10 cursor-grabbing border-[var(--brand)] shadow-[var(--shadow)] transition-none" : "border-[var(--line)] transition-[box-shadow,border-color]"}`}>
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[12.5px] font-extrabold text-[var(--brand-strong)]" aria-hidden>{pos + 1}</span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{items[it]}</span>
            <span className="flex-none tracking-[-2px] text-[18px] text-[var(--ink-3)]" aria-hidden>⋮⋮</span>
            <span className="flex flex-none gap-1">
              <button type="button" disabled={disabled || pos === 0} onClick={() => step(pos, -1)} aria-label={`Move ${items[it]} up`} data-testid="hub-order-up"
                className={`grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>↑</button>
              <button type="button" disabled={disabled || pos === order.length - 1} onClick={() => step(pos, 1)} aria-label={`Move ${items[it]} down`} data-testid="hub-order-down"
                className={`grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30 ${FOCUS}`}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="m-0 text-[12.5px] text-[var(--ink-3)]">Drag the cards, or use the arrows, until they are in the right order.</p>
        {!answered && !disabled && <button type="button" onClick={() => commit(order)} data-testid="hub-order-keep" className={`min-h-[44px] rounded-lg px-2 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>This order looks right</button>}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </div>
  );
}

// ── match ────────────────────────────────────────────────────────────────────

/** term index → definition index (or null), rebuilt from a stored answer (text → first unused equal tile). */
function placedFrom(terms: Piece[], defs: Piece[], value: MatchAnswer | undefined): (number | null)[] {
  const out: (number | null)[] = terms.map(() => null);
  if (!value) return out;
  const usedT = new Set<number>(), usedD = new Set<number>();
  for (const p of value.pairs ?? []) {
    const t = terms.findIndex((x, i) => x.text === p.term && !usedT.has(i));
    const d = defs.findIndex((x, i) => x.text === p.definition && !usedD.has(i));
    if (t < 0 || d < 0) continue;
    usedT.add(t); usedD.add(d); out[t] = d;
  }
  return out;
}

export function MatchInput({ terms, definitions, value, onChange, disabled }: { terms: Piece[]; definitions: Piece[]; value: MatchAnswer | undefined; onChange: (v: MatchAnswer) => void; disabled?: boolean }) {
  const [placed, setPlaced] = useState<(number | null)[]>(() => placedFrom(terms, definitions, value));
  const [picked, setPicked] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ tile: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const placedRef = useRef(placed); placedRef.current = placed;
  const pickedRef = useRef(picked); pickedRef.current = picked;
  const slots = useRef<(HTMLElement | null)[]>([]);
  const off = useRef<(() => void) | null>(null);
  useEffect(() => () => off.current?.(), []);
  const isPlaced = useMemo(() => new Set(placed.filter((d): d is number => d !== null)), [placed]);

  const commit = (next: (number | null)[]) => {
    placedRef.current = next; setPlaced(next);
    onChange({ kind: "match", pairs: next.flatMap((d, t) => (d === null ? [] : [{ term: terms[t].text, definition: definitions[d].text }])) });
  };
  /** Put a definition into a term's slot; whatever was there goes back to the pool. */
  const put = (tile: number, slot: number) => {
    commit(placedRef.current.map((d, t) => (t === slot ? tile : d === tile ? null : d)));
    setPicked(null);
    setSaid(`${definitions[tile].text} matched to ${terms[slot].text}`);
  };
  const unplace = (tile: number) => { commit(placedRef.current.map((d) => (d === tile ? null : d))); setPicked(null); setSaid(`${definitions[tile].text} put back`); };
  const slotOf = (tile: number) => placedRef.current.indexOf(tile);

  /** The slot under (x, y) — or, failing that, the nearest one within NEAR px, so a drop a touch off still lands. */
  const slotAt = (x: number, y: number): number | null => {
    const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-match-slot]");
    if (hit) return Number(hit.dataset.matchSlot);
    let best: number | null = null, bd = NEAR;
    slots.current.forEach((s, i) => {
      if (!s) return;
      const r = s.getBoundingClientRect();
      const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const overPool = (x: number, y: number) => !!(document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-match-pool]");

  /** A tap or Enter on a tile: with another tile picked and this one already placed, swap into its slot; else pick / drop the pick. */
  const activate = (tile: number) => {
    const sel = pickedRef.current;
    const at = slotOf(tile);
    if (sel !== null && sel !== tile && at >= 0) { put(sel, at); return; }
    setPicked(sel === tile ? null : tile);
  };

  const down = (e: ReactPointerEvent<HTMLElement>, tile: number) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    off.current?.();
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > MOVED) { moved = true; setDragging(tile); }
      if (moved) { setGhost({ tile, x: ev.clientX, y: ev.clientY }); setOver(slotAt(ev.clientX, ev.clientY)); }
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const cancelled = ev.type === "pointercancel";
      off.current?.();
      if (!moved) { if (!cancelled) activate(tile); return; }
      if (cancelled) return;
      const slot = slotAt(ev.clientX, ev.clientY);
      if (slot !== null) put(tile, slot);
      else if (overPool(ev.clientX, ev.clientY) && slotOf(tile) >= 0) unplace(tile);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
      setGhost(null); setDragging(null); setOver(null); off.current = null;
    };
    off.current = stop;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  };

  const key = (e: ReactKeyboardEvent, fn: () => void) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  const tile = (d: number, where: "pool" | "slot") => (
    <div key={d} role="button" tabIndex={disabled ? -1 : 0} aria-pressed={picked === d} data-testid="hub-match-tile" data-where={where}
      aria-label={`${definitions[d].text}${where === "slot" ? `, matched to ${terms[slotOf(d)]?.text ?? ""}` : ""}${picked === d ? ", selected" : ""}`}
      onPointerDown={(e) => down(e, d)} onKeyDown={(e) => key(e, () => activate(d))} onClick={(e) => e.stopPropagation()}
      className={`touch-none select-none rounded-[11px] border-2 bg-[var(--surface)] px-3.5 py-2.5 text-[15px] font-semibold leading-snug text-[var(--ink)] shadow-[0_2px_0_var(--line)] [overflow-wrap:anywhere] ${where === "slot" ? "w-full" : ""} ${disabled ? "opacity-60" : "cursor-grab"} ${picked === d ? "border-[var(--brand)] shadow-[0_0_0_3px_var(--brand-soft)]" : "border-[var(--line)]"} ${dragging === d ? "opacity-30" : ""} ${FOCUS}`}>
      {pieceImg(definitions[d])}{definitions[d].text}
    </div>
  );

  return (
    <div data-testid="hub-match">
      <div className="grid gap-2.5">
        {terms.map((t, i) => (
          <div key={i} className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:items-stretch">
            <div className="flex items-center rounded-xl bg-[var(--brand-soft)] px-3.5 py-3 text-[15px] font-extrabold text-[var(--brand-strong)] [overflow-wrap:anywhere]" data-testid="hub-match-term">
              <span>{pieceImg(t)}{t.text}</span>
            </div>
            <div ref={(el) => { slots.current[i] = el; }} data-match-slot={i} data-testid="hub-match-slot"
              tabIndex={placed[i] === null && !disabled ? 0 : -1} role={placed[i] === null ? "button" : undefined}
              aria-label={placed[i] === null ? `Empty box for ${t.text}${picked !== null ? ". Press Enter to place the selected answer here" : ""}` : undefined}
              onKeyDown={(e) => { if (placed[i] === null) key(e, () => { if (picked !== null) put(picked, i); }); }}
              onClick={() => { if (picked !== null && !disabled) put(picked, i); }}
              className={`flex min-h-[54px] items-center rounded-xl border-2 p-1 transition-colors ${placed[i] === null ? "border-dashed" : ""} ${over === i ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--brand-line)] bg-[var(--panel)]"} ${FOCUS}`}>
              {placed[i] !== null ? tile(placed[i] as number, "slot") : <span className="px-2 text-[12.5px] text-[var(--ink-3)]" aria-hidden>Drop the answer here</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="m-0 mt-3 text-[12.5px] text-[var(--ink-3)]">Drag each answer onto its partner, or tap an answer and then tap a box.</p>
      <div data-match-pool onClick={() => { if (picked !== null && slotOf(picked) >= 0) unplace(picked); }} data-testid="hub-match-pool"
        className="mt-1.5 flex min-h-[60px] flex-wrap gap-2 rounded-[14px] bg-[var(--panel)] p-3">
        {definitions.map((_, d) => (isPlaced.has(d) ? null : tile(d, "pool")))}
        {isPlaced.size === definitions.length && <span className="self-center text-[12.5px] font-semibold text-[var(--ink-3)]">Every answer is placed. Drag one back here to take it out.</span>}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
      {ghost && createPortal(
        <div aria-hidden className="pointer-events-none fixed z-[200] max-w-[300px] rotate-[-2deg] scale-[1.04] rounded-[11px] border-2 border-[var(--brand)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] font-semibold leading-snug text-[var(--ink)] shadow-[0_12px_28px_rgba(0,0,0,.25)]" style={{ left: ghost.x - 30, top: ghost.y - 20 }}>
          {definitions[ghost.tile].text}
        </div>, document.body)}
    </div>
  );
}

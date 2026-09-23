"use client";

import { useRef, useState, type ButtonHTMLAttributes, type PointerEvent, type ReactNode } from "react";
import { FOCUS } from "../../kit";
import { SUBJECT_LABEL, type ToolSubject } from "../types";

/** 44px pill button using tokens only. */
export function Btn({ primary, className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...p} className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border px-4 text-[13px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${primary ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"} ${FOCUS} ${className}`} />;
}

interface HasMeta { id: string; title: string; subject: ToolSubject }
/** Subject + set pickers with a "random" button. */
export function SetPicker<T extends HasMeta>({ sets, subject, setSubject, id, setId, onRandom, locked }: { sets: T[]; subject: string; setSubject: (s: string) => void; id: string; setId: (s: string) => void; onRandom: () => void; locked?: boolean }) {
  const subjects = Array.from(new Set(sets.map((s) => s.subject)));
  const shown = sets.filter((s) => subject === "all" || s.subject === subject);
  const cls = `min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">Subject
        <select value={subject} disabled={locked} onChange={(e) => { setSubject(e.target.value); const f = sets.find((s) => e.target.value === "all" || s.subject === e.target.value); if (f) setId(f.id); }} className={cls}>
          <option value="all">All subjects</option>{subjects.map((s) => <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>)}
        </select></label>
      <label className="grid min-w-0 gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">Activity
        <select value={id} disabled={locked} onChange={(e) => setId(e.target.value)} className={`${cls} max-w-full`}>{shown.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <Btn onClick={onRandom} disabled={locked}>Random</Btn>
    </div>
  );
}

/** Pointer-event drag and drop. Draggables call bind(id,label); drop targets carry data-drop="<key>". A tap without movement still fires onClick. */
export function useDragDrop(onDrop: (id: string, target: string) => void) {
  const st = useRef<{ id: string; label: string; sx: number; sy: number; on: boolean } | null>(null);
  const suppress = useRef(false);
  const [drag, setDrag] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-drop]")?.getAttribute("data-drop") ?? null;
  const end = () => { st.current = null; setDrag(null); setOver(null); };
  const bind = (id: string, label: string) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => { if (e.pointerType === "mouse" && e.button !== 0) return; st.current = { id, label, sx: e.clientX, sy: e.clientY, on: false }; },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = st.current; if (!s) return;
      if (!s.on && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) > 8) { s.on = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
      if (s.on) { setDrag({ id: s.id, label: s.label, x: e.clientX, y: e.clientY }); setOver(targetAt(e.clientX, e.clientY)); }
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => { const s = st.current; if (s?.on) { suppress.current = true; const t = targetAt(e.clientX, e.clientY); if (t !== null) onDrop(s.id, t); setTimeout(() => { suppress.current = false; }, 0); } end(); },
    onPointerCancel: end,
    onClickCapture: (e: { preventDefault(): void; stopPropagation(): void }) => { if (suppress.current) { e.preventDefault(); e.stopPropagation(); suppress.current = false; } },
    style: { touchAction: "none" as const },
  });
  const ghost: ReactNode = drag ? <div aria-hidden className="pointer-events-none fixed z-[70] max-w-[220px] rounded-xl border-2 border-[var(--brand)] bg-[var(--surface)] px-3 py-2 text-[13px] font-extrabold text-[var(--ink)] shadow-lg" style={{ left: drag.x, top: drag.y, transform: "translate(-50%,-120%)" }}>{drag.label}</div> : null;
  return { bind, over, dragId: drag?.id ?? null, ghost };
}

export const cardCls = (sel: boolean, mark?: "ok" | "bad" | null) =>
  `min-h-[44px] w-full rounded-xl border-2 px-3 py-2 text-left text-[13.5px] font-bold text-[var(--ink)] ${sel ? "border-[var(--brand)] bg-[var(--brand-soft)]" : mark === "bad" ? "border-dashed border-[var(--ink)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)]"} ${FOCUS}`;
export const markSym = (m?: "ok" | "bad" | null) => (m === "ok" ? "✓ " : m === "bad" ? "✗ " : "");

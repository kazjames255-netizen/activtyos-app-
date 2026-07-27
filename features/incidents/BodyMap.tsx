"use client";

import { useState, type MouseEvent } from "react";

// A body map — tap the child silhouette to drop a numbered pin marking an injury
// or area of concern. Marks store percentage coordinates (0–100, 1dp) against the
// rendered figure box so they're resolution-independent, keyed by front/back view
// and a per-record running number. Mirrors the prototype's safeguarding body map.

export interface BodyMark { view: "front" | "back"; x: number; y: number; n: number; note?: string }

// Shared silhouette; only the overlay guide lines swap between front and back.
function Silhouette({ view }: { view: "front" | "back" }) {
  return (
    <svg viewBox="0 0 200 460" xmlns="http://www.w3.org/2000/svg" className="pointer-events-none h-full w-full">
      <g fill="#c9d2e6" stroke="#a9b4cf" strokeWidth="1.5">
        <circle cx="100" cy="44" r="31" />
        <rect x="90" y="69" width="20" height="18" />
        <rect x="64" y="90" width="72" height="22" rx="11" />
        <path d="M70,98 C70,92 130,92 130,98 L126,206 C126,220 74,220 74,206 Z" />
        <rect x="70" y="196" width="60" height="34" rx="16" />
        <rect x="45" y="98" width="22" height="152" rx="11" transform="rotate(7 56 110)" />
        <rect x="133" y="98" width="22" height="152" rx="11" transform="rotate(-7 144 110)" />
        <rect x="75" y="200" width="24" height="248" rx="12" transform="rotate(2 87 210)" />
        <rect x="101" y="200" width="24" height="248" rx="12" transform="rotate(-2 113 210)" />
      </g>
      {view === "back" ? (
        <g fill="none" stroke="#8a96b5" strokeWidth="1.4" strokeLinecap="round">
          <line x1="100" y1="96" x2="100" y2="202" />
          <path d="M86,110 C80,120 80,132 86,142" opacity="0.7" />
          <path d="M114,110 C120,120 120,132 114,142" opacity="0.7" />
        </g>
      ) : (
        <g fill="none" stroke="#8a96b5" strokeWidth="1.4" strokeLinecap="round">
          <line x1="74" y1="101" x2="126" y2="101" opacity="0.7" />
          <line x1="100" y1="105" x2="100" y2="152" />
        </g>
      )}
    </svg>
  );
}

export function BodyMap({ value, onChange, readOnly = false, startOpen = false }: { value: BodyMark[]; onChange?: (marks: BodyMark[]) => void; readOnly?: boolean; startOpen?: boolean }) {
  const [view, setView] = useState<"front" | "back">("front");
  const [open, setOpen] = useState(startOpen || value.length > 0);
  const marks = value ?? [];
  const here = marks.filter((m) => m.view === view);

  function drop(e: MouseEvent<HTMLDivElement>) {
    if (readOnly || !onChange) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 1000) / 10));
    const y = Math.min(100, Math.max(0, Math.round(((e.clientY - r.top) / r.height) * 1000) / 10));
    const n = marks.reduce((m, k) => Math.max(m, k.n), 0) + 1;
    onChange([...marks, { view, x, y, n, note: "" }]);
  }
  const setNote = (n: number, note: string) => onChange?.(marks.map((m) => (m.n === n ? { ...m, note } : m)));
  const del = (n: number) => onChange?.(marks.filter((m) => m.n !== n));

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="text-[12.5px] font-extrabold">⛑️ Body map{marks.length ? ` (${marks.length})` : readOnly ? "" : " (optional)"}</span>
        <span className="text-[16px] leading-none text-[var(--ink-3)]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--line)] p-3">
          {!readOnly && <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">Tap the figure to mark an injury or area of concern — each mark is numbered.</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col items-center">
              <div className="mb-1.5 flex gap-1">
                {(["front", "back"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)} className="rounded-full border px-3 py-0.5 text-[11px] font-bold capitalize" style={view === v ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{v}</button>
                ))}
              </div>
              <div onClick={drop} className="relative h-[300px] w-[140px] rounded-lg bg-[var(--panel)]" style={{ cursor: readOnly ? "default" : "crosshair" }}>
                <Silhouette view={view} />
                {here.map((m) => (
                  <span key={m.n} className="absolute flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-extrabold text-white shadow" style={{ left: `${m.x}%`, top: `${m.y}%`, background: "#c02636", pointerEvents: "none" }}>{m.n}</span>
                ))}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {marks.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">No marks yet.</div> : (
                <div className="flex flex-col gap-1.5">
                  {[...marks].sort((a, b) => a.n - b.n).map((m) => (
                    <div key={m.n} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "#c02636" }}>{m.n}</span>
                      <span className="flex-none text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{m.view}</span>
                      {readOnly
                        ? <span className="flex-1 text-[12px] text-[var(--ink-2)]">{m.note || <span className="text-[var(--ink-3)]">—</span>}</span>
                        : <input value={m.note ?? ""} onChange={(e) => setNote(m.n, e.target.value)} placeholder={`${m.view} — note`} className="min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]" />}
                      {!readOnly && <button type="button" onClick={() => del(m.n)} className="flex-none text-[12px] font-bold text-[var(--ink-3)]" aria-label="remove">✕</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

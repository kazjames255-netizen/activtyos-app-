"use client";

import { useEffect, useRef, useState } from "react";
import { FOCUS, Icon, tint } from "./kit";
import { useEscapeLayer } from "./escapeLayer";

// A fun, big-circle multi-select for "which school years" — used to filter the lesson library.
// Chosen years are sent to the server as `?year=3,4,5,6` (learningHub.ts's notes list already
// accepts a comma list). Key-stage chips are just a shortcut that toggles a whole range of circles.

const KEY_STAGES: { label: string; years: number[]; color: string }[] = [
  { label: "EYFS", years: [0], color: "var(--gold)" },
  { label: "KS1", years: [1, 2], color: "var(--brand)" },
  { label: "KS2", years: [3, 4, 5, 6], color: "var(--green)" },
  { label: "KS3", years: [7, 8, 9], color: "var(--gold)" },
  { label: "KS4", years: [10, 11], color: "var(--red)" },
  { label: "KS5", years: [12, 13], color: "var(--violet)" },
];
// A year's circle is coloured by its key stage, so KS1/KS2/etc. read as visually grouped, not a rainbow of unrelated years.
const colorFor = (y: number) => KEY_STAGES.find((k) => k.years.includes(y))?.color ?? "var(--brand)";

const yearLabel = (y: number) => (y === 0 ? "R" : String(y));
const fullLabel = (y: number) => (y === 0 ? "Reception" : `Year ${y}`);

export function summarizeYears(years: number[]): string {
  if (!years.length) return "All years";
  const stage = KEY_STAGES.find((k) => k.years.length === years.length && k.years.every((y) => years.includes(y)));
  if (stage) return stage.label;
  if (years.length === 1) return fullLabel(years[0]);
  return `${years.length} years`;
}

// Reception has no numbered "year" a lesson can be tagged with server-side (yearOf() only accepts 1–13), so it's
// left out here by default — pass hasReception only where Reception-tagged content genuinely exists and is filterable.
export function YearGroupPicker({ years, onChange, hasReception = false }: { years: number[]; onChange: (y: number[]) => void; hasReception?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("mousedown", onDown); };
  }, [open]);
  useEscapeLayer(open, () => setOpen(false));

  const toggleYear = (y: number) => onChange(years.includes(y) ? years.filter((x) => x !== y) : [...years, y]);
  const toggleStage = (stageYears: number[]) => {
    const allOn = stageYears.every((y) => years.includes(y));
    onChange(allOn ? years.filter((y) => !stageYears.includes(y)) : [...new Set([...years, ...stageYears])]);
  };
  const allYears = [...(hasReception ? [0] : []), ...Array.from({ length: 13 }, (_, i) => i + 1)];

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true" data-testid="year-picker-trigger"
        className={`flex min-h-[44px] items-center gap-1.5 rounded-full border-2 border-[var(--line)] bg-[var(--surface)] px-4 text-[14px] font-extrabold text-[var(--ink)] transition hover:border-[var(--brand-2)] ${FOCUS}`}>
        {summarizeYears(years)}
        <Icon name="chevronDown" size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="dialog" aria-label="Filter by school year" data-testid="year-picker-panel"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-[min(92vw,380px)] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-lg,0_12px_32px_rgba(0,0,0,0.18))]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Key stage</span>
            {years.length > 0 && <button type="button" onClick={() => onChange([])} className={`text-[12.5px] font-extrabold text-[var(--brand)] ${FOCUS}`}>Clear</button>}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {KEY_STAGES.filter((k) => hasReception || k.label !== "EYFS").map((k) => {
              const on = k.years.every((y) => years.includes(y));
              return (
                <button key={k.label} type="button" onClick={() => toggleStage(k.years)} aria-pressed={on}
                  className={`min-h-[36px] rounded-full border-2 px-3.5 text-[13px] font-extrabold transition ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}>
                  {k.label}
                </button>
              );
            })}
          </div>

          <span className="mb-2 block text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Or pick years</span>
          <div className="grid grid-cols-5 gap-2.5">
            {allYears.map((y) => {
              const on = years.includes(y);
              const c = colorFor(y);
              return (
                <button key={y} type="button" onClick={() => toggleYear(y)} aria-pressed={on} aria-label={fullLabel(y)} title={fullLabel(y)}
                  data-testid={`year-circle-${y}`}
                  className={`grid aspect-square place-items-center rounded-full text-[15px] font-extrabold transition ${FOCUS} ${on ? "scale-105 text-white shadow-[var(--shadow-sm)]" : "text-[var(--ink)] hover:scale-105"}`}
                  style={on ? { background: c, boxShadow: `0 0 0 3px ${tint(c, 25)}` } : { background: tint(c, 16) }}>
                  {yearLabel(y)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type CSSProperties } from "react";
import { FOCUS } from "../../kit";

// Dyslexia-friendly display options shared by the writing tools: text size and line spacing. Local to the component; nothing stored.

export interface ReadingOpts { size: 0 | 1 | 2; spacing: 0 | 1 | 2 }
export const SIZES = [16, 19, 23] as const;
export const SPACINGS = [1.5, 1.85, 2.25] as const;
export const SIZE_LABEL = ["Normal", "Large", "Extra large"] as const;
export const SPACING_LABEL = ["Normal", "Roomy", "Extra roomy"] as const;

export function useReadingOpts() { return useState<ReadingOpts>({ size: 0, spacing: 0 }); }
export const textStyle = (o: ReadingOpts): CSSProperties => ({ fontSize: SIZES[o.size], lineHeight: SPACINGS[o.spacing] });

function Seg({ label, value, options, onChange }: { label: string; value: number; options: readonly string[]; onChange: (i: number) => void }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className="text-[11.5px] font-bold text-[var(--ink-2)]">{label}</span>
      {options.map((o, i) => (
        <button key={o} type="button" aria-pressed={value === i} onClick={() => onChange(i)}
          className={`min-h-[44px] min-w-[44px] rounded-xl border px-2 text-[12px] font-bold ${FOCUS} ${value === i ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{i === 0 ? "A" : i === 1 ? "A+" : "A++"}<span className="sr-only"> {o}</span></button>
      ))}
    </div>
  );
}
export function ReadingControls({ opts, onChange }: { opts: ReadingOpts; onChange: (o: ReadingOpts) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Seg label="Text size" value={opts.size} options={SIZE_LABEL} onChange={(i) => onChange({ ...opts, size: i as 0 | 1 | 2 })} />
      <Seg label="Line spacing" value={opts.spacing} options={SPACING_LABEL} onChange={(i) => onChange({ ...opts, spacing: i as 0 | 1 | 2 })} />
    </div>
  );
}

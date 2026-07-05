import type { ReactNode } from "react";

// Section heading above a group of content (e.g. a Card section).
export function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 mt-3.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
      {children}
    </div>
  );
}

// Label directly above a single form field.
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
      {children}
    </div>
  );
}

export function DefRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-[var(--line)] py-[5px] text-[12.5px]">
      <span className="shrink-0 text-[var(--ink-3)]">{label}</span>
      <span className="break-words text-right font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

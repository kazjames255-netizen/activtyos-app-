"use client";

import { useState } from "react";
import { Input } from "@/components/ui";

export interface ChildOption { name: string; childId?: string; sub?: string }

/**
 * Pick a booked child. Once selected it locks to a chip — you can't type over
 * it (it came from a real booking, so the record links to the parent). "Change"
 * re-opens the search. A deliberate off-list name is still possible via the
 * "not a booked child" row, but it won't link.
 */
export function ChildPicker({ value, options, onPick, placeholder = "Search a booked child…" }: {
  value?: string; options: ChildOption[]; onPick: (name: string, childId?: string) => void; placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const committed = value?.trim();

  if (committed) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1d3a8f] bg-[#eaf0fc] px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-bold text-[#1d3a8f]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1d3a8f] text-[10px] font-extrabold text-white">{committed[0]?.toUpperCase() ?? "?"}</span>
          <span className="truncate">{committed}</span>
        </span>
        <button type="button" onClick={() => { onPick("", undefined); setQ(""); }} className="shrink-0 text-[12px] font-bold text-[#1d3a8f] underline">Change</button>
      </div>
    );
  }

  const ql = q.trim().toLowerCase();
  const matches = options.filter((o) => !ql || o.name.toLowerCase().includes(ql) || (o.sub ?? "").toLowerCase().includes(ql)).slice(0, 8);
  const exact = options.some((o) => o.name.trim().toLowerCase() === ql);
  return (
    <div className="relative">
      <Input value={q} placeholder={placeholder} className="w-full"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (matches.length > 0 || !!ql) && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-lg">
          {matches.map((o, i) => (
            <button key={i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(o.name, o.childId); setQ(""); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--panel)]">
              <span className="font-semibold">{o.name}</span>{o.sub && <span className="text-[11px] text-[var(--ink-3)]">{o.sub}</span>}
            </button>
          ))}
          {ql && !exact && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(q.trim(), undefined); setQ(""); setOpen(false); }}
              className="flex w-full items-center gap-1.5 border-t border-[var(--line)] px-3 py-1.5 text-left text-[12px] text-[var(--ink-3)] hover:bg-[var(--panel)]">
              Use &ldquo;<b className="text-[var(--ink-2)]">{q.trim()}</b>&rdquo; — not a booked child
            </button>
          )}
        </div>
      )}
    </div>
  );
}

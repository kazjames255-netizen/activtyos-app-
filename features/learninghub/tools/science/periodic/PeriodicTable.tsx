"use client";

import { useMemo, useState } from "react";
import { FOCUS } from "../../../kit";
import { CATEGORY_LABEL, ELEMENTS, findElements, type Category, type Element } from "./elements";

// The full periodic table (118 elements) as a data sheet: tap an element for its atomic number, relative atomic mass, group, period, type and electron
// arrangement; search by name, symbol or number; zoom the cells. It shows the data sheet only — it never works out a question's answer for the child.

const COLOUR: Record<Category, string> = {
  alkali: "#f6b3a8", "alkaline-earth": "#f8d29a", transition: "#f3e39a", "post-transition": "#cfe3a8", metalloid: "#a8dcc4", nonmetal: "#a9d3f0", halogen: "#c9bdf0", noble: "#e3b9e6", lanthanide: "#f0c4d8", actinide: "#e8b6b6",
};
const SIZES = [26, 32, 40, 50];

export default function PeriodicTable() {
  const [sel, setSel] = useState<Element>(ELEMENTS[10]!); // Na: a sensible first card
  const [q, setQ] = useState("");
  const [size, setSize] = useState(1);
  const hits = useMemo(() => new Set(findElements(q).map((e) => e.z)), [q]);
  const w = SIZES[size]!;
  const grid = useMemo(() => {
    const rows: (Element | "lan" | "act" | null)[][] = [];
    for (let p = 1; p <= 7; p++) {
      const row: (Element | "lan" | "act" | null)[] = [];
      for (let g = 1; g <= 18; g++) {
        const e = ELEMENTS.find((x) => x.period === p && x.group === g) ?? null;
        row.push(e ?? (g === 3 && p === 6 ? "lan" : g === 3 && p === 7 ? "act" : null));
      }
      rows.push(row);
    }
    return rows;
  }, []);
  const lan = ELEMENTS.filter((e) => e.z >= 57 && e.z <= 71), act = ELEMENTS.filter((e) => e.z >= 89 && e.z <= 103);

  const cell = (e: Element) => (
    <button key={e.z} type="button" onClick={() => setSel(e)} aria-label={`${e.name}, atomic number ${e.z}`} aria-pressed={sel.z === e.z} data-testid={`pt-el-${e.sym}`}
      className={`relative flex flex-col items-center justify-center rounded-[4px] border text-[var(--ink)] ${FOCUS} ${sel.z === e.z ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : hits.has(e.z) ? "border-[var(--gold,#f5b81f)] ring-2 ring-[var(--gold,#f5b81f)]" : "border-[color-mix(in_srgb,var(--ink)_18%,transparent)]"}`}
      style={{ width: w, height: w, background: COLOUR[e.category], fontSize: Math.max(10, w * 0.36), lineHeight: 1 }}>
      <span style={{ position: "absolute", top: 1, left: 2, fontSize: Math.max(7, w * 0.22), fontWeight: 600 }}>{e.z}</span>
      <b>{e.sym}</b>
    </button>
  );
  const blank = (k: string, label?: string) => <div key={k} style={{ width: w, height: w, fontSize: Math.max(7, w * 0.22) }} className="flex items-center justify-center text-[var(--ink-3)]">{label}</div>;
  const btn = `min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-extrabold text-[var(--ink)] ${FOCUS}`;

  return (
    <div data-testid="periodic-table">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); const f = findElements(e.target.value)[0]; if (f) setSel(f); }} placeholder="Find an element (name, symbol or number)" aria-label="Find an element"
          className={`min-h-[44px] flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13.5px] font-semibold text-[var(--ink)] ${FOCUS}`} style={{ minWidth: 200 }} data-testid="pt-search" />
        <button type="button" className={btn} onClick={() => setSize((s) => Math.max(0, s - 1))} aria-label="Smaller cells" data-testid="pt-zoom-out">−</button>
        <button type="button" className={btn} onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))} aria-label="Bigger cells" data-testid="pt-zoom-in">＋ Zoom</button>
      </div>
      <div className="overflow-auto rounded-lg border border-[var(--line)] p-2" style={{ maxHeight: "48vh" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(18, ${w}px)`, gap: 2, width: "max-content" }}>
          {grid.flatMap((row, r) => row.map((c, g) => (c === "lan" ? blank(`l${r}`, "57–71") : c === "act" ? blank(`a${r}`, "89–103") : c ? cell(c) : blank(`e${r}-${g}`))))}
          {Array.from({ length: 18 }, (_, i) => <div key={`gap${i}`} style={{ height: 6 }} />)}
          {Array.from({ length: 2 }, () => null).flatMap((_, r) => [
            ...Array.from({ length: 2 }, (__, i) => blank(`pad${r}-${i}`)),
            ...(r === 0 ? lan : act).map(cell),
            ...Array.from({ length: 1 }, (__, i) => blank(`tail${r}-${i}`)),
          ])}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-semibold text-[var(--ink-2)]" aria-label="Key">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <span key={c} className="inline-flex items-center gap-1"><i style={{ width: 12, height: 12, background: COLOUR[c], borderRadius: 3, display: "inline-block" }} />{CATEGORY_LABEL[c]}</span>)}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[13px] sm:grid-cols-3" data-testid="pt-detail" aria-live="polite">
        <div className="col-span-2 flex items-baseline gap-2 sm:col-span-3"><b className="text-[26px] leading-none text-[var(--ink)]">{sel.sym}</b><span className="text-[15px] font-extrabold text-[var(--ink)]">{sel.name}</span><span className="text-[12px] font-semibold text-[var(--ink-3)]">{CATEGORY_LABEL[sel.category]}</span></div>
        <div><dt className="text-[11px] font-bold uppercase text-[var(--ink-3)]">Atomic number</dt><dd className="m-0 font-extrabold text-[var(--ink)]" data-testid="pt-z">{sel.z}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase text-[var(--ink-3)]">Relative atomic mass</dt><dd className="m-0 font-extrabold text-[var(--ink)]" data-testid="pt-ar">{sel.ar}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase text-[var(--ink-3)]">Group · Period</dt><dd className="m-0 font-extrabold text-[var(--ink)]">{sel.group ?? "—"} · {sel.period}</dd></div>
        <div className="col-span-2 sm:col-span-3"><dt className="text-[11px] font-bold uppercase text-[var(--ink-3)]">Electron arrangement</dt><dd className="m-0 font-extrabold text-[var(--ink)]">{sel.shells ?? "not needed at school level"}</dd></div>
      </dl>
    </div>
  );
}

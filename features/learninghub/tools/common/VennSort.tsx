"use client";

import { useMemo, useState } from "react";
import { newSeed } from "../engine/rng";
import type { ToolProps } from "../types";
import { VENN_SETS } from "./packs";
import { nextHint, scoreSort, seededShuffle, type Placement, type VennSet, type VennZone } from "./sorting";
import { Btn, cardCls, markSym, SetPicker, useDragDrop } from "./shared";

// Venn / T-chart sort (X-07 family): two circles, cards go in left only, both, or right only.
export default function VennSort(props: Partial<ToolProps>) {
  const assess = props.mode === "assess";
  const p = props.params ?? {};
  const wantSet = typeof p.setId === "string" ? p.setId : "";
  const wantSub = typeof p.subject === "string" ? p.subject : "all";
  const first = VENN_SETS.find((s) => s.id === wantSet) ?? VENN_SETS.find((s) => wantSub === "all" || s.subject === wantSub) ?? VENN_SETS[0]!;
  const [subject, setSubject] = useState(wantSet ? first.subject : wantSub);
  const [setId, setSetId] = useState(first.id);
  const [seed, setSeed] = useState(1);
  const [place, setPlace] = useState<Placement>({});
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<Placement | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [hintN, setHintN] = useState(0);
  const set: VennSet = VENN_SETS.find((s) => s.id === setId) ?? first;
  const pool = VENN_SETS.filter((s) => subject === "all" || s.subject === subject);
  const order = useMemo(() => seededShuffle(set.cards, seed), [set, seed]);
  const zones: { z: VennZone; label: string }[] = [{ z: "left", label: `${set.left} only` }, { z: "both", label: "Both" }, { z: "right", label: `${set.right} only` }];

  const reset = (id: string) => { setSetId(id); setSeed(newSeed()); setPlace({}); setSel(null); setChecked(null); setNote(""); setDone(false); setHintN(0); };
  const random = () => { const c = pool.filter((s) => s.id !== setId); const l = c.length ? c : pool; reset(l[Math.floor(Math.random() * l.length)]!.id); };
  const putIn = (id: string, z: string) => { if (done) return; setPlace((o) => { const n = { ...o }; if (z === "") delete n[id]; else n[id] = z; return n; }); setSel(null); setChecked(null); setNote(""); };
  const dd = useDragDrop((id, t) => putIn(id, t === "tray" ? "" : t));
  const mark = (id: string) => (checked ? (checked[id] === set.cards.find((c) => c.id === id)!.zone ? "ok" : "bad") : null);
  const tile = (id: string, text: string) => {
    const m = mark(id);
    return <button key={id} type="button" {...dd.bind(id, text)} onClick={() => !done && setSel(sel === id ? null : id)} aria-pressed={sel === id} aria-label={`${text}${m === "ok" ? ", correct" : m === "bad" ? ", not right" : ""}${sel === id ? ", selected" : ""}`}
      className={cardCls(sel === id, m)} style={{ ...dd.bind(id, text).style, opacity: dd.dragId === id ? 0.4 : 1 }}>{markSym(m)}{text}</button>;
  };
  const selCard = set.cards.find((c) => c.id === sel);
  const tray = order.filter((c) => place[c.id] === undefined);

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      <SetPicker sets={VENN_SETS} subject={subject} setSubject={setSubject} id={setId} setId={reset} onRandom={random} locked={!!wantSet && assess} />
      <div role="region" aria-label="Instruction" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 text-[15px] font-extrabold">{set.title}</p>
        <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-[var(--ink-2)]">{set.instruction} Tap a card, then tap a place, or drag.</p>
      </div>
      <svg viewBox="0 0 200 70" role="img" aria-label={`Venn diagram: ${set.left} on the left, ${set.right} on the right, what they share in the middle.`} className="mx-auto w-full max-w-[320px]">
        <circle cx={78} cy={35} r={30} fill="none" stroke="var(--ink)" strokeWidth={1.5} /><circle cx={122} cy={35} r={30} fill="none" stroke="var(--brand)" strokeWidth={1.5} />
        <text x={62} y={38} textAnchor="middle" fontSize={8} fontWeight={800} fill="var(--ink)">{set.left.slice(0, 12)}</text><text x={100} y={38} textAnchor="middle" fontSize={8} fontWeight={800} fill="var(--ink-2)">both</text><text x={138} y={38} textAnchor="middle" fontSize={8} fontWeight={800} fill="var(--ink)">{set.right.slice(0, 12)}</text>
      </svg>
      <div data-drop="tray" role="group" aria-label="Cards to sort" className={`grid min-h-[56px] gap-2 rounded-2xl border-2 border-dashed p-2 sm:grid-cols-2 ${dd.over === "tray" ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
        {tray.length === 0 && <p className="m-0 p-2 text-[12.5px] font-semibold text-[var(--ink-3)]">All cards are placed.</p>}
        {tray.map((c) => tile(c.id, c.text))}
      </div>
      {selCard && !done && <div role="menu" aria-label={`Move ${selCard.text} to`} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--brand)] bg-[var(--surface)] p-2">
        <span className="text-[12.5px] font-extrabold">Move “{selCard.text}” to:</span>
        {zones.map((z) => <Btn key={z.z} role="menuitem" onClick={() => putIn(selCard.id, z.z)}>{z.label}</Btn>)}
        {place[selCard.id] !== undefined && <Btn role="menuitem" onClick={() => putIn(selCard.id, "")}>Back to pile</Btn>}
      </div>}
      <div className="grid gap-2 sm:grid-cols-3">
        {zones.map((z) => (
          <div key={z.z} data-drop={z.z} role="group" aria-label={z.label} className={`rounded-2xl border-2 bg-[var(--panel)] p-2 ${dd.over === z.z ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
            <button type="button" disabled={!selCard || done} onClick={() => selCard && putIn(selCard.id, z.z)} className={`mb-2 min-h-[44px] w-full rounded-xl bg-[var(--surface)] px-2 text-left text-[14px] font-extrabold text-[var(--ink)] ${selCard ? "border-2 border-[var(--brand)]" : "border border-[var(--line)]"} disabled:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]`}>{z.label}{selCard ? "  ← place here" : ""}</button>
            <div className="grid gap-2">{order.filter((c) => place[c.id] === z.z).map((c) => tile(c.id, c.text))}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {!assess && <Btn primary disabled={Object.keys(place).length === 0} onClick={() => { setChecked({ ...place }); const r = scoreSort(set, place); setNote(r.score === r.max ? `All ${r.max} correct.${set.explanation ? " " + set.explanation : ""}` : `${r.score} of ${r.max} in the right place. Cards marked ✗ need another look.`); }}>Check</Btn>}
        {!assess && <Btn onClick={() => { setNote(nextHint(set, place, hintN) ?? "Everything is in the right place."); setHintN((x) => x + 1); }}>Hint</Btn>}
        {props.mode === "teach" && <Btn onClick={() => { setPlace(Object.fromEntries(set.cards.map((c) => [c.id, c.zone]))); setChecked(null); setNote(set.explanation ?? "Here is the correct sort."); }}>Reveal</Btn>}
        {assess && !done && <Btn primary disabled={tray.length > 0} onClick={() => { setDone(true); setSel(null); setNote("Submitted. Your answers are recorded."); }}>Submit</Btn>}
        <Btn onClick={random}>Try another</Btn>
        <Btn onClick={() => { setPlace({}); setChecked(null); setNote(""); setSel(null); setDone(false); }}>Start again</Btn>
      </div>
      <p role="status" aria-live="polite" className="m-0 min-h-[1.5em] text-[13.5px] font-bold">{note}</p>
      {dd.ghost}
    </div>
  );
}

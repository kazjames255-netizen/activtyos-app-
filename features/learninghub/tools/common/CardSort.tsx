"use client";

import { useMemo, useState } from "react";
import { newSeed } from "../engine/rng";
import type { ToolProps } from "../types";
import { SORT_SETS } from "./packs";
import { nextHint, scoreSort, seededShuffle, type Placement, type SortSet } from "./sorting";
import { Btn, cardCls, markSym, SetPicker, useDragDrop } from "./shared";

// Card sort / classify (S-15, X-05, X-07): tap a card then tap a group, drag it, or use the menu with the keyboard.
export default function CardSort(props: Partial<ToolProps>) {
  const assess = props.mode === "assess";
  const p = props.params ?? {};
  const wantSet = typeof p.setId === "string" ? p.setId : "";
  const wantSub = typeof p.subject === "string" ? p.subject : "all";
  const first = SORT_SETS.find((s) => s.id === wantSet) ?? SORT_SETS.find((s) => wantSub === "all" || s.subject === wantSub) ?? SORT_SETS[0]!;
  const [subject, setSubject] = useState(wantSet ? first.subject : wantSub);
  const [setId, setSetId] = useState(first.id);
  const [seed, setSeed] = useState(1);
  const [place, setPlace] = useState<Placement>({});
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<Placement | null>(null);
  const [note, setNote] = useState("");
    const [done, setDone] = useState(false);
  const [hintN, setHintN] = useState(0);
  const set: SortSet = SORT_SETS.find((s) => s.id === setId) ?? first;
  const pool = SORT_SETS.filter((s) => subject === "all" || s.subject === subject);
  const order = useMemo(() => seededShuffle(set.cards, seed), [set, seed]);

  const reset = (id: string) => { setSetId(id); setSeed(newSeed()); setPlace({}); setSel(null); setChecked(null); setNote(""); setDone(false); setHintN(0); };
  const random = () => { const c = pool.filter((s) => s.id !== setId); const n = (c.length ? c : pool)[Math.floor(Math.random() * (c.length || pool.length))]!; reset(n.id); };
  const putIn = (cardId: string, cat: string) => { if (done) return; setPlace((o) => { const n = { ...o }; if (cat === "") delete n[cardId]; else n[cardId] = cat; return n; }); setSel(null); setChecked(null); setNote(""); };
  const dd = useDragDrop((id, target) => putIn(id, target === "tray" ? "" : target));
  const mark = (id: string) => (checked && place[id] !== undefined ? (checked[id] === set.cards.find((c) => c.id === id)!.cat ? "ok" : "bad") : checked ? "bad" : null);

  const check = () => {
    setChecked({ ...place });
    const r = scoreSort(set, place);
    setNote(r.score === r.max ? `All ${r.max} correct.${set.explanation ? " " + set.explanation : ""}` : `${r.score} of ${r.max} in the right group. Cards marked ✗ need another look.`);
  };
  const reveal = () => { setPlace(Object.fromEntries(set.cards.map((c) => [c.id, c.cat]))); setChecked(null); setNote(set.explanation ?? "Here is the correct sort."); };
  const hint = () => { const h = nextHint(set, place, hintN); setHintN((x) => x + 1); setNote(h ?? "Everything is in the right place."); };
  const tray = order.filter((c) => place[c.id] === undefined);
  const selCard = set.cards.find((c) => c.id === sel);
  const tile = (id: string, text: string) => {
    const m = mark(id);
    return <button key={id} type="button" {...dd.bind(id, text)} onClick={() => !done && setSel(sel === id ? null : id)} aria-pressed={sel === id} aria-label={`${text}${m === "ok" ? ", correct" : m === "bad" ? ", not right" : ""}${sel === id ? ", selected" : ""}`}
      className={cardCls(sel === id, m)} style={{ ...dd.bind(id, text).style, opacity: dd.dragId === id ? 0.4 : 1 }}>{markSym(m)}{text}</button>;
  };

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      <SetPicker sets={SORT_SETS} subject={subject} setSubject={(s) => { setSubject(s); }} id={setId} setId={reset} onRandom={random} locked={!!wantSet && assess} />
      <div role="region" aria-label="Instruction" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 text-[15px] font-extrabold">{set.title}</p>
        <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-[var(--ink-2)]">{set.instruction} Tap a card, then tap a group. You can also drag.</p>
      </div>
      <div data-drop="tray" aria-label="Cards to sort" role="group" className={`grid min-h-[56px] gap-2 rounded-2xl border-2 border-dashed p-2 sm:grid-cols-2 ${dd.over === "tray" ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
        {tray.length === 0 && <p className="m-0 p-2 text-[12.5px] font-semibold text-[var(--ink-3)]">All cards are placed.</p>}
        {tray.map((c) => tile(c.id, c.text))}
      </div>
      {selCard && !done && <div role="menu" aria-label={`Move ${selCard.text} to`} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--brand)] bg-[var(--surface)] p-2"
        onKeyDown={(e) => { const bs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button")); const i = bs.indexOf(document.activeElement as HTMLButtonElement); if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); } else if (e.key === "Escape") setSel(null); }}>
        <span className="text-[12.5px] font-extrabold">Move “{selCard.text}” to:</span>
        {set.categories.map((k) => <Btn key={k.id} role="menuitem" onClick={() => putIn(selCard.id, k.id)}>{k.label}</Btn>)}
        {place[selCard.id] !== undefined && <Btn role="menuitem" onClick={() => putIn(selCard.id, "")}>Back to pile</Btn>}
      </div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {set.categories.map((k) => {
          const inK = order.filter((c) => place[c.id] === k.id);
          return (
            <div key={k.id} data-drop={k.id} role="group" aria-label={k.label} className={`rounded-2xl border-2 bg-[var(--panel)] p-2 ${dd.over === k.id ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
              <button type="button" disabled={!selCard || done} onClick={() => selCard && putIn(selCard.id, k.id)} className={`mb-2 min-h-[44px] w-full rounded-xl bg-[var(--surface)] px-2 text-left text-[14px] font-extrabold text-[var(--ink)] ${selCard ? "border-2 border-[var(--brand)]" : "border border-[var(--line)]"} disabled:opacity-100 ${"outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]"}`}>{k.label}{selCard ? "  ← place here" : ""}</button>
              <div className="grid gap-2">{inK.map((c) => tile(c.id, c.text))}</div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {!assess && <Btn primary onClick={check} disabled={Object.keys(place).length === 0}>Check</Btn>}
        {!assess && <Btn onClick={hint}>Hint</Btn>}
        {props.mode === "teach" && <Btn onClick={reveal}>Reveal</Btn>}
        {assess && !done && <Btn primary onClick={() => { setDone(true); setSel(null); setNote("Submitted. Your answers are recorded."); }} disabled={tray.length > 0}>Submit</Btn>}
        <Btn onClick={random}>Try another</Btn>
        <Btn onClick={() => { setPlace({}); setChecked(null); setNote(""); setSel(null); setDone(false); }}>Start again</Btn>
      </div>
      <p role="status" aria-live="polite" className="m-0 min-h-[1.5em] text-[13.5px] font-bold">{note}</p>
      {dd.ghost}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { newSeed } from "../engine/rng";
import type { ToolProps } from "../types";
import { SEQUENCE_SETS } from "./packs";
import { nextSequenceHint, scoreSequence, shuffleSteps, wrongPositions, type SequenceSet } from "./sorting";
import { Btn, SetPicker, useDragDrop } from "./shared";

// Sequencer (S-16, H-H02): put steps in order with the move buttons or by dragging.
export default function Sequencer(props: Partial<ToolProps>) {
  const assess = props.mode === "assess";
  const p = props.params ?? {};
  const wantSet = typeof p.setId === "string" ? p.setId : "";
  const wantSub = typeof p.subject === "string" ? p.subject : "all";
  const first = SEQUENCE_SETS.find((s) => s.id === wantSet) ?? SEQUENCE_SETS.find((s) => wantSub === "all" || s.subject === wantSub) ?? SEQUENCE_SETS[0]!;
  const [subject, setSubject] = useState(wantSet ? first.subject : wantSub);
  const [setId, setSetId] = useState(first.id);
  const [seed, setSeed] = useState(1);
  const set: SequenceSet = SEQUENCE_SETS.find((s) => s.id === setId) ?? first;
  const start = useMemo(() => shuffleSteps(set.steps, seed).map((s) => s.id), [set, seed]);
  const [order, setOrder] = useState<string[]>(start);
  const [wrong, setWrong] = useState<number[] | null>(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const text = (id: string) => set.steps.find((s) => s.id === id)?.text ?? id;
  const pool = SEQUENCE_SETS.filter((s) => subject === "all" || s.subject === subject);

  const reset = (id: string) => {
    const s = SEQUENCE_SETS.find((x) => x.id === id) ?? first, sd = newSeed();
    setSetId(id); setSeed(sd); setOrder(shuffleSteps(s.steps, sd).map((x) => x.id)); setWrong(null); setNote(""); setDone(false);
  };
  const random = () => { const c = pool.filter((s) => s.id !== setId); const l = c.length ? c : pool; reset(l[Math.floor(Math.random() * l.length)]!.id); };
  const move = (from: number, to: number) => {
    if (done || to < 0 || to >= order.length || from === to) return;
    const o = [...order]; const [x] = o.splice(from, 1); o.splice(to, 0, x!); setOrder(o); setWrong(null); setNote("");
    setNote(`Moved to step ${to + 1}.`);
  };
  const dd = useDragDrop((id, target) => move(order.indexOf(id), Number(target)));
  const check = () => {
    const w = wrongPositions(set, order), r = scoreSequence(set, order);
    setWrong(w);
    setNote(w.length === 0 ? `Perfect order.${set.explanation ? " " + set.explanation : ""}` : `${r.score} of ${r.max} steps are followed by the right one. Steps ${w.join(", ")} are in the wrong place.`);
  };

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      <SetPicker sets={SEQUENCE_SETS} subject={subject} setSubject={setSubject} id={setId} setId={reset} onRandom={random} locked={!!wantSet && assess} />
      <div role="region" aria-label="Instruction" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 text-[15px] font-extrabold">{set.title}</p>
        <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-[var(--ink-2)]">{set.instruction} Use the arrows, or drag a step.</p>
      </div>
      <ol className="m-0 grid list-none gap-2 p-0" aria-label="Steps in your order">
        {order.map((id, i) => {
          const bad = wrong?.includes(i + 1), good = wrong && !bad;
          return (
            <li key={id} data-drop={String(i)} className={`flex items-stretch gap-1.5 rounded-xl border-2 bg-[var(--surface)] p-1.5 ${dd.over === String(i) ? "border-[var(--brand)]" : bad ? "border-dashed border-[var(--ink)]" : "border-[var(--line)]"}`} style={{ opacity: dd.dragId === id ? 0.4 : 1 }}>
              <div {...dd.bind(id, text(id))} className="flex min-h-[44px] min-w-0 flex-1 cursor-grab items-center gap-2 px-1.5 text-[13.5px] font-bold">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold" aria-hidden>{i + 1}</span>
                <span className="min-w-0 break-words"><span className="sr-only">{`Step ${i + 1}: `}</span>{good ? "✓ " : bad ? "✗ " : ""}{text(id)}{bad ? <span className="sr-only"> (wrong place)</span> : null}</span>
              </div>
              <Btn aria-label={`Move “${text(id)}” up`} onClick={() => move(i, i - 1)} disabled={i === 0 || done} className="!min-w-[44px] !px-0">▲</Btn>
              <Btn aria-label={`Move “${text(id)}” down`} onClick={() => move(i, i + 1)} disabled={i === order.length - 1 || done} className="!min-w-[44px] !px-0">▼</Btn>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {!assess && <Btn primary onClick={check}>Check</Btn>}
        {!assess && <Btn onClick={() => setNote(nextSequenceHint(set, order) ?? "Everything is in the right place.")}>Hint</Btn>}
        {props.mode === "teach" && <Btn onClick={() => { setOrder(set.steps.map((s) => s.id)); setWrong(null); setNote(set.explanation ?? "Here is the correct order."); }}>Reveal</Btn>}
        {assess && !done && <Btn primary onClick={() => { setDone(true); setNote("Submitted. Your answers are recorded."); }}>Submit</Btn>}
        <Btn onClick={random}>Try another</Btn>
        <Btn onClick={() => { setOrder(start); setWrong(null); setNote(""); setDone(false); }}>Start again</Btn>
      </div>
      <p role="status" aria-live="polite" className="m-0 min-h-[1.5em] text-[13.5px] font-bold">{note}</p>
      {dd.ghost}
    </div>
  );
}

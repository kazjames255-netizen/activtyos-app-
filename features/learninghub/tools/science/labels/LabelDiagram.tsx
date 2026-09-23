"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { FOCUS } from "../../../kit";
import { newSeed } from "../../engine/rng";
import type { ToolProps } from "../../types";
import { DIAGRAMS } from "./diagrams";
import { hintFor, markerPos, numberOf, partName, partsAtLevel, scoreLabels, scoreTyped, shuffleBank, type Difficulty, type PartStatus } from "./labeller";

// S-01 Label the diagram. Two ways to answer: tap/drag label chips onto numbered markers, or type each label.
// params: { diagramId?: string, group?: "cells"|"plants"|"body-systems"|"physics" (limits the picker), level?: 1|2|3, mode?: "place"|"type" }

type Way = "place" | "type";
const LEVELS: { v: Difficulty; name: string }[] = [{ v: 1, name: "Starter" }, { v: 2, name: "Core" }, { v: 3, name: "Stretch" }];
const chip = "min-h-[44px] rounded-xl border px-3 text-[13.5px] font-bold";

export default function LabelDiagram(props: Partial<ToolProps>) {
  const assess = props.mode === "assess";
  const teach = props.mode === "teach";
  const pr = props.params ?? {};
  const pool = useMemo(() => (typeof pr.group === "string" ? DIAGRAMS.filter((d) => d.topic === pr.group) : DIAGRAMS), [pr.group]);
  const list = pool.length ? pool : DIAGRAMS;
  const [diagramId, setDiagramId] = useState(() => (list.find((d) => d.id === pr.diagramId) ?? list[0]!).id);
  const [level, setLevel] = useState<Difficulty>(pr.level === 1 || pr.level === 2 || pr.level === 3 ? pr.level : 2);
  const [way, setWay] = useState<Way>(pr.mode === "type" ? "type" : "place");
  const [seed, setSeed] = useState(() => newSeed());
  const [placed, setPlaced] = useState<Record<string, string>>({});   // marker part id -> chip id
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);              // chip picked up, waiting for a marker
  const [picking, setPicking] = useState<string | null>(null);        // marker chosen via keyboard/tap, waiting for a chip
  const [statuses, setStatuses] = useState<Record<string, PartStatus> | null>(null);
  const [score, setScore] = useState<[number, number] | null>(null);
  const [hints, setHints] = useState<Record<string, number>>({});
  const [reveal, setReveal] = useState(false);

  const diagram = list.find((d) => d.id === diagramId) ?? list[0]!;
  const parts = useMemo(() => partsAtLevel(diagram, level), [diagram, level]);
  const bank = useMemo(() => shuffleBank(parts, seed), [parts, seed]);
  const total = parts.length;
  const usedChips = new Set(Object.values(placed));
  const freeBank = bank.filter((b) => !usedChips.has(b.id));
  const labelOf = (id: string) => diagram.parts.find((p) => p.id === id)?.label ?? "";

  const clearMarks = () => { setStatuses(null); setScore(null); };
  const restart = (newSeeds = true) => { setPlaced({}); setTyped({}); setHeld(null); setPicking(null); setHints({}); setReveal(false); clearMarks(); if (newSeeds) setSeed(newSeed()); };
  const pickDiagram = (id: string) => { setDiagramId(id); restart(); };
  const pickLevel = (l: Difficulty) => { setLevel(l); restart(); };
  const pickWay = (w: Way) => { setWay(w); restart(false); };

  const put = (markerId: string, chipId: string) => {
    clearMarks();
    setPlaced((p) => { const next = { ...p }; for (const k of Object.keys(next)) if (next[k] === chipId) delete next[k]; next[markerId] = chipId; return next; });
    setHeld(null); setPicking(null);
  };
  const lift = (markerId: string) => { clearMarks(); setPlaced((p) => { const n = { ...p }; delete n[markerId]; return n; }); };
  const onMarker = (id: string) => {
    if (way === "type") { document.getElementById(`lbl-in-${id}`)?.focus(); return; }
    if (held) { put(id, held); return; }
    if (placed[id]) { const c = placed[id]!; lift(id); setHeld(c); return; }   // tap a placed label to pick it up again
    setPicking((cur) => (cur === id ? null : id));
  };
  const onChip = (id: string) => { if (picking) put(picking, id); else setHeld((h) => (h === id ? null : id)); };

  const check = () => {
    const r = way === "place" ? scoreLabels(placed, diagram, level) : scoreTyped(typed, diagram, level);
    setStatuses(r.log.perPart as Record<string, PartStatus>);
    setScore([r.score, r.max]);
  };
  const doneCount = way === "place" ? Object.keys(placed).length : parts.filter((p) => (typed[p.id] ?? "").trim()).length;
  const showFeedback = !assess && statuses !== null;
  const pickingNum = picking ? numberOf(parts, picking) : 0;

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      {/* choices */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">Diagram
          <select value={diagram.id} onChange={(e) => pickDiagram(e.target.value)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13.5px] font-semibold text-[var(--ink)] ${FOCUS}`}>
            {list.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Difficulty" className="flex gap-1">
          {LEVELS.map((l) => (
            <button key={l.v} type="button" aria-pressed={level === l.v} onClick={() => pickLevel(l.v)} className={`${chip} ${FOCUS} ${level === l.v ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{l.name}</button>
          ))}
        </div>
        <div role="group" aria-label="How to answer" className="flex gap-1">
          {([["place", "Drag / tap labels"], ["type", "Type the labels"]] as const).map(([w, name]) => (
            <button key={w} type="button" aria-pressed={way === w} onClick={() => pickWay(w)} className={`${chip} ${FOCUS} ${way === w ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{name}</button>
          ))}
        </div>
      </div>
      <p className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">{diagram.title} · {total} parts to label{diagram.note ? ` · ${diagram.note}` : ""}</p>

      {/* the diagram */}
      <div className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]" style={{ aspectRatio: `${diagram.viewBox.w} / ${diagram.viewBox.h}` }}>
        <svg viewBox={`0 0 ${diagram.viewBox.w} ${diagram.viewBox.h}`} role="img" aria-label={`${diagram.title}. ${diagram.description}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <diagram.Art />
          {parts.map((p) => p.leader && (
            <g key={p.id}><line x1={p.hotspot.x} y1={p.hotspot.y} x2={p.leader.x} y2={p.leader.y} stroke="var(--ink)" strokeWidth={1.5} /><circle cx={p.hotspot.x} cy={p.hotspot.y} r={3} fill="var(--ink)" /></g>
          ))}
        </svg>
        {parts.map((p, i) => {
          const m = markerPos(p), st = showFeedback ? statuses?.[p.id] : undefined, has = way === "place" ? !!placed[p.id] : !!(typed[p.id] ?? "").trim();
          const on = picking === p.id;
          return (
            <button
              key={p.id} type="button"
              aria-label={`${partName(i + 1, total)}${has ? ", has an answer" : ", empty"}${st === "correct" ? ", correct" : st ? ", not correct" : ""}`}
              aria-pressed={way === "place" ? on : undefined}
              onClick={() => onMarker(p.id)}
              onDragOver={(e) => { if (way === "place") e.preventDefault(); }}
              onDrop={(e) => { const c = e.dataTransfer.getData("text/plain"); if (way === "place" && c) { e.preventDefault(); put(p.id, c); } }}
              className={`absolute grid h-10 w-10 place-items-center rounded-full ${FOCUS}`}
              style={{ left: `${(m.x / diagram.viewBox.w) * 100}%`, top: `${(m.y / diagram.viewBox.h) * 100}%`, transform: "translate(-50%,-50%)" }}
            >
              <span className={`relative grid h-7 w-7 place-items-center rounded-full border-2 text-[13px] font-extrabold ${on ? "border-[var(--ink)] bg-[var(--brand)] text-white" : has ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--ink)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                {i + 1}
                {st && <span aria-hidden className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full border border-[var(--ink)] bg-[var(--surface)] text-[10px] font-black leading-none text-[var(--ink)]">{st === "correct" ? "✓" : "✗"}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* keyboard / tap picker for one marker */}
      {way === "place" && picking && (
        <div role="group" aria-label={`Choose a label for ${partName(pickingNum, total)}`} className="rounded-2xl border border-[var(--brand)] bg-[var(--panel)] p-3">
          <p className="m-0 mb-2 text-[13px] font-bold">Choose a label for {partName(pickingNum, total)}</p>
          <div className="flex flex-wrap gap-2">
            {freeBank.map((b) => <button key={b.id} type="button" onClick={() => put(picking, b.id)} className={`${chip} ${FOCUS} border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]`}>{b.label}</button>)}
            {freeBank.length === 0 && <span className="text-[13px] text-[var(--ink-2)]">Every label is used. Tap a numbered marker that has one to take it off.</span>}
            <button type="button" onClick={() => setPicking(null)} className={`${chip} ${FOCUS} border-[var(--line)] bg-transparent text-[var(--ink-2)]`}>Cancel</button>
          </div>
        </div>
      )}

      {/* label bank */}
      {way === "place" && (
        <div role="group" aria-label="Label bank" className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <p className="m-0 mb-2 text-[12.5px] font-bold text-[var(--ink-2)]">{held ? `Now tap the number where “${labelOf(held)}” goes.` : "Tap a label, then tap its number (or drag it on). Tap a number with no label selected to pick from a list."}</p>
          <div className="flex flex-wrap gap-2">
            {freeBank.map((b) => (
              <button
                key={b.id} type="button" draggable aria-pressed={held === b.id}
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", b.id); setHeld(b.id); }}
                onClick={() => onChip(b.id)}
                className={`${chip} ${FOCUS} ${held === b.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}
              >{b.label}</button>
            ))}
            {freeBank.length === 0 && <span className="text-[13px] font-semibold text-[var(--ink-2)]">All labels placed.</span>}
          </div>
        </div>
      )}

      {/* answers list: one row per marker (also the accessible route for both modes) */}
      <ol className="m-0 grid list-none gap-2 p-0" aria-label="Your labels">
        {parts.map((p, i) => {
          const st = showFeedback ? statuses?.[p.id] : undefined, step = hints[p.id];
          const chipId = placed[p.id];
          return (
            <li key={p.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full border-2 border-[var(--ink)] text-[13px] font-extrabold">{i + 1}</span>
                {way === "place" ? (
                  chipId
                    ? <button type="button" onClick={() => { lift(p.id); }} aria-label={`${partName(i + 1, total)} is labelled ${labelOf(chipId)}. Remove it`} className={`${chip} ${FOCUS} border-[var(--brand)] bg-[var(--panel)] text-[var(--ink)]`}>{labelOf(chipId)} ✕</button>
                    : <button type="button" onClick={() => { setHeld(null); setPicking(p.id); }} className={`${chip} ${FOCUS} border-dashed border-[var(--line)] bg-transparent text-[var(--ink-2)]`}>Choose a label…</button>
                ) : (
                  <input
                    id={`lbl-in-${p.id}`} value={typed[p.id] ?? ""} autoComplete="off" autoCapitalize="off" spellCheck={false}
                    aria-label={`Label for ${partName(i + 1, total)}`}
                    onChange={(e) => { clearMarks(); setTyped((t) => ({ ...t, [p.id]: e.target.value })); }}
                    className={`min-h-[44px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}
                  />
                )}
                {st && <span className="text-[13px] font-extrabold" role="status">{st === "correct" ? "✓ Correct" : st === "wrong" ? "✗ Not quite" : "✗ Empty"}</span>}
                {!assess && !(st === "correct") && (
                  <button type="button" onClick={() => setHints((h) => ({ ...h, [p.id]: (h[p.id] ?? -1) + 1 }))} className={`${chip} ${FOCUS} ml-auto border-[var(--line)] bg-transparent text-[var(--ink)]`} aria-label={`Hint for ${partName(i + 1, total)}`}>Hint</button>
                )}
              </div>
              {!assess && step !== undefined && <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">💡 {hintFor(p, step)}</p>}
              {teach && reveal && <p className="m-0 mt-1 text-[13px] font-bold">Answer: {p.label}</p>}
            </li>
          );
        })}
      </ol>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        {assess ? <p role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{doneCount} of {total} answered</p> : <Button variant="primary" onClick={check} disabled={doneCount === 0}>Check</Button>}
        {teach && <Button onClick={() => setReveal((r) => !r)}>{reveal ? "Hide labels" : "Show labels"}</Button>}
        <Button onClick={() => restart()}>Start again</Button>
      </div>
      {showFeedback && score && <p role="status" className="m-0 text-[14px] font-extrabold">{score[0] === score[1] ? "🎉 " : ""}{score[0]} out of {score[1]} correct{score[0] < score[1] ? ". Use the Hint buttons on the ✗ rows, then check again." : "."}</p>}
    </div>
  );
}

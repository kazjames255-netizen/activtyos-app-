"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui";
import { FOCUS } from "../../../kit";
import { useBareTool } from "../../bareContext";
import { newSeed } from "../../engine/rng";
import type { ToolProps } from "../../types";
import { DIAGRAMS } from "./diagrams";
import { markerPos, numberOf, partsAtLevel, scoreLabels, scoreTyped, shuffleBank, type Difficulty, type PartStatus } from "./labeller";

// S-01 Label the diagram. Two ways to answer: tap/drag label chips onto numbered markers, or type each label.
// params: { diagramId?: string, group?: "cells"|"plants"|"body-systems"|"physics" (limits the picker), level?: 1|2|3, mode?: "place"|"type" }

type Way = "place" | "type";
const LEVELS: { v: Difficulty; key: string }[] = [{ v: 1, key: "sc_ld_starter" }, { v: 2, key: "sc_ld_core" }, { v: 3, key: "sc_ld_stretch" }];
const chip = "min-h-[44px] rounded-xl border px-3 text-[13.5px] font-bold";

export default function LabelDiagram(props: Partial<ToolProps>) {
  const bare = useBareTool();
  const t = useT();
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
  const partName = (n: number) => t("hubtoolsb.sc_ld_part", { n, total });
  // A diagram with no catalogue row yet (newly added) shows its English title / description rather than the raw key.
  const tOr = (key: string, fb: string) => { const r = t(key); return r === key ? fb : r; };
  const dTitle = tOr(`hubtoolsb.sc_dg_${diagram.id}`, diagram.title);
  const hintText = (p: (typeof parts)[number], step: number) => {
    const base = t(`hubtoolsb.sc_h_${diagram.id}_${p.id}`);
    if (step <= 0) return base;
    return `${base} ${t("hubtoolsb.sc_ld_startsWith", { l: p.label.charAt(0), w: p.label.split(/\s+/).length, n: p.label.replace(/[^a-z]/gi, "").length })}`;
  };

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      {/* choices */}
      <div data-tool-chrome className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_ld_diagram")}
          <select value={diagram.id} onChange={(e) => pickDiagram(e.target.value)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[13.5px] font-semibold text-[var(--ink)] ${FOCUS}`}>
            {list.map((d) => <option key={d.id} value={d.id}>{tOr(`hubtoolsb.sc_dg_${d.id}`, d.title)}</option>)}
          </select>
        </label>
        <div role="group" aria-label={t("hubtoolsb.sc_ld_difficulty")} className="flex gap-1">
          {LEVELS.map((l) => (
            <button key={l.v} type="button" aria-pressed={level === l.v} onClick={() => pickLevel(l.v)} className={`${chip} ${FOCUS} ${level === l.v ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{t(`hubtoolsb.${l.key}`)}</button>
          ))}
        </div>
        <div role="group" aria-label={t("hubtoolsb.sc_ld_how")} className="flex gap-1">
          {([["place", t("hubtoolsb.sc_ld_place")], ["type", t("hubtoolsb.sc_ld_type")]] as const).map(([w, name]) => (
            <button key={w} type="button" aria-pressed={way === w} onClick={() => pickWay(w)} className={`${chip} ${FOCUS} ${way === w ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{name}</button>
          ))}
        </div>
      </div>
      <p data-tool-chrome className="m-0 text-[12.5px] font-semibold text-[var(--ink-2)]">{dTitle} · {t("hubtoolsb.sc_ld_toLabel", { n: total })}{diagram.note ? ` · ${t(`hubtoolsb.sc_dgn_${diagram.id}`)}` : ""}</p>

      {/* the diagram */}
      <div className={`relative mx-auto w-full max-w-[560px] overflow-hidden ${bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--surface)]"}`} style={{ aspectRatio: `${diagram.viewBox.w} / ${diagram.viewBox.h}` }}>
        <svg viewBox={`0 0 ${diagram.viewBox.w} ${diagram.viewBox.h}`} role="img" aria-label={`${dTitle}. ${tOr(`hubtoolsb.sc_dgd_${diagram.id}`, diagram.description)}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
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
              aria-label={[partName(i + 1), has ? t("hubtoolsb.sc_ld_hasAns") : t("hubtoolsb.sc_ld_emptyState"), st === "correct" ? t("hubtoolsb.sc_ld_correctS") : st ? t("hubtoolsb.sc_ld_wrongS") : ""].filter(Boolean).join(", ")}
              aria-pressed={way === "place" ? on : undefined}
              onClick={() => onMarker(p.id)}
              onDragOver={(e) => { if (way === "place") e.preventDefault(); }}
              onDrop={(e) => { const c = e.dataTransfer.getData("text/plain"); if (way === "place" && c) { e.preventDefault(); put(p.id, c); } }}
              className={`absolute grid h-10 w-10 place-items-center rounded-full ${FOCUS}`}
              style={{ left: `${(m.x / diagram.viewBox.w) * 100}%`, top: `${(m.y / diagram.viewBox.h) * 100}%`, transform: "translate(-50%,-50%)" }}
            >
              <span className={`relative grid h-7 w-7 place-items-center rounded-full border-2 text-[13px] font-extrabold ${on ? "border-[var(--ink)] bg-[var(--brand)] text-white" : has ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--ink)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                {i + 1}
                {st && <span aria-hidden className="absolute -end-2 -top-2 grid h-4 w-4 place-items-center rounded-full border border-[var(--ink)] bg-[var(--surface)] text-[10px] font-black leading-none text-[var(--ink)]">{st === "correct" ? "✓" : "✗"}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* keyboard / tap picker for one marker */}
      {way === "place" && picking && (
        <div data-tool-chrome role="group" aria-label={t("hubtoolsb.sc_ld_chooseFor", { part: partName(pickingNum) })} className="rounded-2xl border border-[var(--brand)] bg-[var(--panel)] p-3">
          <p className="m-0 mb-2 text-[13px] font-bold">{t("hubtoolsb.sc_ld_chooseFor", { part: partName(pickingNum) })}</p>
          <div className="flex flex-wrap gap-2">
            {freeBank.map((b) => <button key={b.id} type="button" onClick={() => put(picking, b.id)} className={`${chip} ${FOCUS} border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]`}>{b.label}</button>)}
            {freeBank.length === 0 && <span className="text-[13px] text-[var(--ink-2)]">{t("hubtoolsb.sc_ld_allUsed")}</span>}
            <button type="button" onClick={() => setPicking(null)} className={`${chip} ${FOCUS} border-[var(--line)] bg-transparent text-[var(--ink-2)]`}>{t("hubtoolsb.sc_ld_cancel")}</button>
          </div>
        </div>
      )}

      {/* label bank */}
      {way === "place" && (
        <div role="group" aria-label={t("hubtoolsb.sc_ld_bank")} className={bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3"}>
          <p data-tool-chrome className="m-0 mb-2 text-[12.5px] font-bold text-[var(--ink-2)]">{held ? t("hubtoolsb.sc_ld_nowTap", { label: labelOf(held) }) : t("hubtoolsb.sc_ld_tapHelp")}</p>
          <div className="flex flex-wrap gap-2">
            {freeBank.map((b) => (
              <button
                key={b.id} type="button" draggable aria-pressed={held === b.id}
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", b.id); setHeld(b.id); }}
                onClick={() => onChip(b.id)}
                className={`${chip} ${FOCUS} ${held === b.id ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}
              >{b.label}</button>
            ))}
            {freeBank.length === 0 && <span className="text-[13px] font-semibold text-[var(--ink-2)]">{t("hubtoolsb.sc_ld_allPlaced")}</span>}
          </div>
        </div>
      )}

      {/* answers list: one row per marker (also the accessible route for both modes) */}
      <ol className="m-0 grid list-none gap-2 p-0" aria-label={t("hubtoolsb.sc_ld_yourLabels")}>
        {parts.map((p, i) => {
          const st = showFeedback ? statuses?.[p.id] : undefined, step = hints[p.id];
          const chipId = placed[p.id];
          return (
            <li key={p.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full border-2 border-[var(--ink)] text-[13px] font-extrabold">{i + 1}</span>
                {way === "place" ? (
                  chipId
                    ? <button type="button" onClick={() => { lift(p.id); }} aria-label={t("hubtoolsb.sc_ld_isLabelled", { part: partName(i + 1), label: labelOf(chipId) })} className={`${chip} ${FOCUS} border-[var(--brand)] bg-[var(--panel)] text-[var(--ink)]`}>{labelOf(chipId)} ✕</button>
                    : <button type="button" onClick={() => { setHeld(null); setPicking(p.id); }} className={`${chip} ${FOCUS} border-dashed border-[var(--line)] bg-transparent text-[var(--ink-2)]`}>{t("hubtoolsb.sc_ld_choose")}</button>
                ) : (
                  <input
                    id={`lbl-in-${p.id}`} value={typed[p.id] ?? ""} autoComplete="off" autoCapitalize="off" spellCheck={false}
                    aria-label={t("hubtoolsb.sc_ld_labelFor", { part: partName(i + 1) })}
                    onChange={(e) => { clearMarks(); setTyped((t) => ({ ...t, [p.id]: e.target.value })); }}
                    className={`min-h-[44px] min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}
                  />
                )}
                {st && <span className="text-[13px] font-extrabold" role="status">{st === "correct" ? t("hubtoolsb.sc_ld_correct") : st === "wrong" ? t("hubtoolsb.sc_ld_notQuite") : t("hubtoolsb.sc_ld_empty")}</span>}
                {!assess && !(st === "correct") && (
                  <button data-tool-chrome type="button" onClick={() => setHints((h) => ({ ...h, [p.id]: (h[p.id] ?? -1) + 1 }))} className={`${chip} ${FOCUS} ms-auto border-[var(--line)] bg-transparent text-[var(--ink)]`} aria-label={t("hubtoolsb.sc_ld_hintFor", { part: partName(i + 1) })}>{t("hubtoolsb.sc_ld_hint")}</button>
                )}
              </div>
              {!assess && step !== undefined && <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">💡 {hintText(p, step)}</p>}
              {teach && reveal && <p className="m-0 mt-1 text-[13px] font-bold">{t("hubtoolsb.sc_ld_answer", { label: p.label })}</p>}
            </li>
          );
        })}
      </ol>

      {/* actions */}
      <div data-tool-strip className="flex flex-wrap items-center gap-2">
        {assess ? <p role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{t("hubtoolsb.sc_ld_answered", { n: doneCount, total })}</p> : <Button data-tool-chrome variant="primary" onClick={check} disabled={doneCount === 0}>{t("hubtoolsb.sc_ld_check")}</Button>}
        {teach && <Button data-tool-chrome onClick={() => setReveal((r) => !r)}>{reveal ? t("hubtoolsb.sc_ld_hide") : t("hubtoolsb.sc_ld_show")}</Button>}
        <Button onClick={() => restart()}>{t("hubtoolsb.sc_ld_again")}</Button>
      </div>
      {showFeedback && score && <p data-tool-chrome role="status" className="m-0 text-[14px] font-extrabold">{score[0] === score[1] ? t("hubtoolsb.sc_ld_scoreFull", { s: score[0], m: score[1] }) : t("hubtoolsb.sc_ld_scorePart", { s: score[0], m: score[1] })}</p>}
    </div>
  );
}

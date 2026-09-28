"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { hintText } from "../toolText";
import { newSeed } from "../engine/rng";
import type { ToolProps } from "../types";
import { SORT_SETS } from "./packs";
import { nextHint, scoreSort, seededShuffle, type Placement, type SortSet } from "./sorting";
import { Btn, cardCls, markSym, SetPicker, useDragDrop } from "./shared";

// Card sort / classify (S-15, X-05, X-07): tap a card then tap a group, drag it, or use the menu with the keyboard.
export default function CardSort(props: Partial<ToolProps>) {
  const t = useT();
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
    setNote(r.score === r.max ? `${t("hubtoolsa.s_allCorrect", { max: r.max })}${set.explanation ? " " + set.explanation : ""}` : t("hubtoolsa.s_scoreGroup", { score: r.score, max: r.max }));
  };
  const reveal = () => { setPlace(Object.fromEntries(set.cards.map((c) => [c.id, c.cat]))); setChecked(null); setNote(set.explanation ?? t("hubtoolsa.s_revealSort")); };
  const hint = () => { const h = nextHint(set, place, hintN); setHintN((x) => x + 1); setNote(h ? hintText(t, h) : t("hubtoolsa.s_hintDone")); };
  const tray = order.filter((c) => place[c.id] === undefined);
  const selCard = set.cards.find((c) => c.id === sel);
  const tile = (id: string, text: string) => {
    const m = mark(id);
    return <button key={id} type="button" {...dd.bind(id, text)} onClick={() => !done && setSel(sel === id ? null : id)} aria-pressed={sel === id} aria-label={`${text}${m === "ok" ? ", " + t("hubtoolsa.s_correct") : m === "bad" ? ", " + t("hubtoolsa.s_notRight") : ""}${sel === id ? ", " + t("hubtoolsa.s_selected") : ""}`}
      className={cardCls(sel === id, m)} style={{ ...dd.bind(id, text).style, opacity: dd.dragId === id ? 0.4 : 1 }}>{markSym(m)}{text}</button>;
  };

  return (
    <div className="grid gap-3 text-[var(--ink)]">
      <SetPicker sets={SORT_SETS} subject={subject} setSubject={(s) => { setSubject(s); }} id={setId} setId={reset} onRandom={random} locked={!!wantSet && assess} />
      <div data-tool-chrome role="region" aria-label={t("hubtoolsa.s_instruction")} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 text-[15px] font-extrabold">{set.title}</p>
        <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-[var(--ink-2)]">{set.instruction} {t("hubtoolsa.s_tapGroup")}</p>
      </div>
      <div data-drop="tray" aria-label={t("hubtoolsa.s_cardsToSort")} role="group" className={`grid min-h-[56px] gap-2 rounded-2xl border-2 border-dashed p-2 sm:grid-cols-2 ${dd.over === "tray" ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
        {tray.length === 0 && <p className="m-0 p-2 text-[12.5px] font-semibold text-[var(--ink-3)]">{t("hubtoolsa.s_allPlaced")}</p>}
        {tray.map((c) => tile(c.id, c.text))}
      </div>
      {selCard && !done && <div role="menu" aria-label={t("hubtoolsa.s_moveToAria", { card: selCard.text })} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--brand)] bg-[var(--surface)] p-2"
        onKeyDown={(e) => { const bs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button")); const i = bs.indexOf(document.activeElement as HTMLButtonElement); if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); } else if (e.key === "Escape") setSel(null); }}>
        <span className="text-[12.5px] font-extrabold">{t("hubtoolsa.s_moveTo", { card: selCard.text })}</span>
        {set.categories.map((k) => <Btn key={k.id} role="menuitem" onClick={() => putIn(selCard.id, k.id)}>{k.label}</Btn>)}
        {place[selCard.id] !== undefined && <Btn role="menuitem" onClick={() => putIn(selCard.id, "")}>{t("hubtoolsa.s_backToPile")}</Btn>}
      </div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {set.categories.map((k) => {
          const inK = order.filter((c) => place[c.id] === k.id);
          return (
            <div key={k.id} data-drop={k.id} role="group" aria-label={k.label} className={`rounded-2xl border-2 bg-[var(--panel)] p-2 ${dd.over === k.id ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
              <button type="button" disabled={!selCard || done} onClick={() => selCard && putIn(selCard.id, k.id)} className={`mb-2 min-h-[44px] w-full rounded-xl bg-[var(--surface)] px-2 text-start text-[14px] font-extrabold text-[var(--ink)] ${selCard ? "border-2 border-[var(--brand)]" : "border border-[var(--line)]"} disabled:opacity-100 ${"outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]"}`}>{k.label}{selCard ? "  " + t("hubtoolsa.s_placeHere") : ""}</button>
              <div className="grid gap-2">{inK.map((c) => tile(c.id, c.text))}</div>
            </div>
          );
        })}
      </div>
      <div data-tool-strip className="flex flex-wrap gap-2">
        {!assess && <Btn data-tool-chrome primary onClick={check} disabled={Object.keys(place).length === 0}>{t("hubtoolsa.c_check")}</Btn>}
        {!assess && <Btn data-tool-chrome onClick={hint}>{t("hubtoolsa.c_hint")}</Btn>}
        {props.mode === "teach" && <Btn data-tool-chrome onClick={reveal}>{t("hubtoolsa.c_reveal")}</Btn>}
        {assess && !done && <Btn primary onClick={() => { setDone(true); setSel(null); setNote(t("hubtoolsa.s_submitted")); }} disabled={tray.length > 0}>{t("hubtoolsa.c_submit")}</Btn>}
        <Btn data-tool-chrome onClick={random}>{t("hubtoolsa.c_tryAnother")}</Btn>
        <Btn onClick={() => { setPlace({}); setChecked(null); setNote(""); setSel(null); setDone(false); }}>{t("hubtoolsa.c_startAgain")}</Btn>
      </div>
      <p data-tool-chrome role="status" aria-live="polite" className="m-0 min-h-[1.5em] text-[13.5px] font-bold">{note}</p>
      {dd.ghost}
    </div>
  );
}

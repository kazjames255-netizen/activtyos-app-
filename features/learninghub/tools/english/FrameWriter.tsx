"use client";

import { useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { FOCUS } from "../../kit";
import { useBareTool } from "../bareContext";
import type { ToolProps } from "../types";
import { FRAMES, combineSections, getFrame, type Frame } from "./frames";
import { localiseFrame, readingText, tipText } from "./engText";
import { analyse, checklistProgress, wordCount, wordsToTarget } from "./textstats";
import { ReadingControls, textStyle, useReadingOpts } from "./readingOptions";

// FrameWriter: pick a writing frame, fill it in section by section. Text stays in this component's state (never sent anywhere).
// Advice only — the sentence check never grades.

type Props = Partial<ToolProps> & { onChange?: (piece: string) => void };

const chip = `min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-start text-[13px] font-semibold text-[var(--ink)] ${FOCUS}`;
const btn = `min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-bold text-[var(--ink)] ${FOCUS}`;
const btnOn = `min-h-[44px] rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-3 text-[13px] font-bold text-white ${FOCUS}`;

export default function FrameWriter(props: Props) {
  const bare = useBareTool();
  const { t: tr, locale } = useI18n();
  const T = (k: string, v?: Record<string, string | number>) => tr(`hubtoolsb.eng_${k}`, v);
  const nfmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const nf = (n: number) => nfmt.format(n);
  const frames = useMemo(() => FRAMES.map((f) => localiseFrame(tr, f)), [tr]);
  const assess = props.mode === "assess";
  const starters = !assess || props.params?.allowStarters === true;
  const fixed = getFrame(props.params?.frameId);
  const [frameId, setFrameId] = useState<string>(fixed?.id ?? FRAMES[0]!.id);
  const frame: Frame = frames.find((f) => f.id === frameId) ?? frames[0]!;
  const [text, setText] = useState<Record<string, string>>({});
  const [ticks, setTicks] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const [viewSel, setView] = useState<"one" | "all" | "piece">("one");
  const view = bare ? "all" : viewSel; // "Just the tool": the whole frame on one surface, no view switcher
  const [headings, setHeadings] = useState(false);
  const [msg, setMsg] = useState("");
  const [opts, setOpts] = useReadingOpts();
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const piece = combineSections(frame, text, headings);
  const plain = combineSections(frame, text, false);
  const report = useMemo(() => analyse(plain), [plain]);

  const update = (next: Record<string, string>) => { setText(next); props.onChange?.(combineSections(frame, next, false)); };
  const setSection = (id: string, v: string) => update({ ...text, [id]: v });
  const pick = (id: string) => { setFrameId(id); setText({}); setTicks(new Set()); setIdx(0); setMsg(""); props.onChange?.(""); };
  const toggle = (k: string) => setTicks((t) => { const n = new Set(t); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const insert = (secId: string, starter: string) => {
    const ta = refs.current[secId];
    const cur = text[secId] ?? "";
    const a = ta?.selectionStart ?? cur.length, b = ta?.selectionEnd ?? cur.length;
    const before = cur.slice(0, a), after = cur.slice(b);
    const add = (before && !/\s$/.test(before) ? " " : "") + starter + (after.startsWith(" ") ? "" : " ");
    setSection(secId, before + add + after);
    const pos = before.length + add.length;
    requestAnimationFrame(() => { const t = refs.current[secId]; if (t) { t.focus(); t.setSelectionRange(pos, pos); } });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(piece); setMsg(T("copied")); } catch { setMsg(T("copyFail")); }
  };

  const section = (sec: Frame["sections"][number]) => {
    const t = text[sec.id] ?? "";
    const target = sec.minWords ? wordsToTarget(t, sec.minWords) : null;
    const items = sec.checklist ?? [];
    return (
      <section key={sec.id} aria-labelledby={`fw-h-${sec.id}`} className={bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3"}>
        <h3 id={`fw-h-${sec.id}`} className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{sec.heading}</h3>
        <p data-tool-chrome className="m-0 mt-1 text-[13.5px] text-[var(--ink-2)]">{sec.prompt}</p>
        {starters && (
          <div data-tool-chrome role="group" aria-label={T("startersAria", { heading: sec.heading })} className="mt-2 flex flex-wrap gap-2">
            {sec.starters.map((st) => <button key={st} type="button" className={chip} onClick={() => insert(sec.id, st)}>{st}</button>)}
          </div>
        )}
        <label htmlFor={`fw-t-${sec.id}`} className="sr-only">{T("writeHereAria", { heading: sec.heading })}</label>
        <textarea id={`fw-t-${sec.id}`} ref={(el) => { refs.current[sec.id] = el; }} value={t} onChange={(e) => setSection(sec.id, e.target.value)} rows={6} style={textStyle(opts)}
          placeholder={T("writeHere")} className={`mt-2 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-[var(--ink)] ${FOCUS}`} />
        <p data-tool-chrome role="status" className="m-0 mt-1 text-[12.5px] font-bold text-[var(--ink-2)]">
          {sec.minWords ? `${T("ofAbout", { n: nf(wordCount(t)), m: nf(sec.minWords) })}${target && target.status === "inRange" ? " ✓" : ""}` : T("words", { n: nf(wordCount(t)) })}
        </p>
        {items.length > 0 && (
          <fieldset data-tool-chrome className="m-0 mt-2 border-0 p-0">
            <legend className="text-[12px] font-bold text-[var(--ink-2)]">{T("checkYourself")}</legend>
            {items.map((c) => <Tick key={c} label={c} on={ticks.has(`${sec.id}:${c}`)} onChange={() => toggle(`${sec.id}:${c}`)} />)}
          </fieldset>
        )}
        {!assess && sec.exampleFor && (
          <details data-tool-chrome className="mt-2"><summary className={`min-h-[44px] cursor-pointer py-2 text-[13px] font-bold text-[var(--brand)] ${FOCUS}`}>{T("seeExample")}</summary>
            <p className="m-0 rounded-xl bg-[var(--surface)] p-2 text-[13.5px] italic text-[var(--ink)]">{sec.exampleFor}</p></details>
        )}
      </section>
    );
  };

  const overallProg = checklistProgress(frame.overallChecklist, frame.overallChecklist.filter((c) => ticks.has(`all:${c}`)));
  const safeIdx = Math.min(idx, frame.sections.length - 1);

  return (
    <div className="grid gap-3 text-[var(--ink)]" style={{ maxWidth: 760 }}>
      <style>{`@media print{body *{visibility:hidden}.fw-print,.fw-print *{visibility:visible}.fw-print{position:absolute;left:0;top:0;width:100%}}`}</style>
      {!fixed && (
        <label data-tool-chrome className="grid gap-1 text-[12px] font-bold text-[var(--ink-2)]">{T("writingFrame")}
          <select value={frame.id} onChange={(e) => pick(e.target.value)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
            {frames.map((f) => <option key={f.id} value={f.id}>{f.title} (KS{f.keyStages.join(", ")})</option>)}
          </select>
        </label>
      )}
      <h2 data-tool-chrome className="m-0 text-[17px] font-extrabold">{frame.title}</h2>
      <ReadingControls opts={opts} onChange={setOpts} />
      {bare && <div data-tool-strip><button type="button" className={btn} onClick={() => { setText({}); props.onChange?.(""); }}>{T("clearWriting")}</button></div>}
      <div data-tool-chrome role="group" aria-label={T("view")} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={view === "one"} className={view === "one" ? btnOn : btn} onClick={() => setView("one")}>{T("viewOne")}</button>
        <button type="button" aria-pressed={view === "all"} className={view === "all" ? btnOn : btn} onClick={() => setView("all")}>{T("viewAll")}</button>
        <button type="button" aria-pressed={view === "piece"} className={view === "piece" ? btnOn : btn} onClick={() => setView("piece")}>{T("viewPiece")}</button>
      </div>

      {!assess && frame.banks && view !== "piece" && (
        <details data-tool-chrome className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <summary className={`min-h-[44px] cursor-pointer py-2 text-[13px] font-bold ${FOCUS}`}>{T("wordBank")}</summary>
          {frame.banks.map((b) => (
            <div key={b.label} className="mt-1"><p className="m-0 text-[12px] font-bold text-[var(--ink-2)]">{b.label}</p>
              <p className="m-0 text-[13.5px]">{b.words.join(" · ")}</p></div>
          ))}
        </details>
      )}

      {view === "one" && (
        <>
          <nav aria-label={T("parts")} className="flex flex-wrap gap-2">
            {frame.sections.map((s, i) => (
              <button key={s.id} type="button" aria-current={i === safeIdx ? "step" : undefined} className={i === safeIdx ? btnOn : btn} onClick={() => setIdx(i)}>{i + 1}. {s.heading}</button>
            ))}
          </nav>
          {section(frame.sections[safeIdx]!)}
          <div className="flex gap-2">
            <button type="button" className={btn} disabled={safeIdx === 0} onClick={() => setIdx(safeIdx - 1)}>{T("back")}</button>
            <button type="button" className={btn} disabled={safeIdx === frame.sections.length - 1} onClick={() => setIdx(safeIdx + 1)}>{T("next")}</button>
          </div>
        </>
      )}
      {view === "all" && <div className="grid gap-3">{frame.sections.map(section)}</div>}

      {view === "piece" && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn} onClick={copy}>{T("copy")}</button>
            <button type="button" className={btn} onClick={() => window.print()}>{T("print")}</button>
            <label className="flex min-h-[44px] items-center gap-2 text-[13px] font-semibold"><input type="checkbox" className="h-5 w-5" checked={headings} onChange={(e) => setHeadings(e.target.checked)} />{T("includeHeadings")}</label>
          </div>
          <div className="fw-print rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" style={textStyle(opts)}>
            <h3 className="m-0 mb-2 text-[16px] font-extrabold">{frame.title}</h3>
            {piece ? piece.split("\n\n").map((p, i) => <p key={i} className="m-0 mb-3 whitespace-pre-wrap">{p}</p>) : <p className="m-0 text-[var(--ink-2)]">{T("nothingYet")}</p>}
          </div>
          <p role="status" className="m-0 text-[13px] font-bold text-[var(--ink-2)]">{T("totalWords", { n: nf(wordCount(plain)) })}{msg ? ` · ${msg}` : ""}</p>
        </div>
      )}

      <fieldset data-tool-chrome className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <legend className="px-1 text-[13px] font-extrabold">{T("finalCheck", { done: nf(overallProg.done), total: nf(overallProg.total) })}</legend>
        {frame.overallChecklist.map((c) => <Tick key={c} label={c} on={ticks.has(`all:${c}`)} onChange={() => toggle(`all:${c}`)} />)}
      </fieldset>

      {!assess && (
        <details data-tool-chrome className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <summary className={`min-h-[44px] cursor-pointer py-2 text-[13px] font-extrabold ${FOCUS}`}>{T("sentenceCheck")}</summary>
          {report.words === 0 ? <p className="m-0 text-[13.5px] text-[var(--ink-2)]">{T("writeFirst")}</p> : (
            <ul className="m-0 grid gap-1 ps-5 text-[13.5px]">
              <li>{T("summary", { words: nf(report.words), sentences: nf(report.sentences), paragraphs: nf(report.paragraphs), avg: nf(report.avgSentenceLength) })}</li>
              <li>{T("lengths", { list: report.variety.histogram.map((h) => `${h.bucket}: ${nf(h.count)}`).join(", ") })}</li>
              {report.variety.tips.map((tip) => <li key={tip}>{tipText(tr, tip, nf)}</li>)}
              {report.openers.tip && <li>{tipText(tr, report.openers.tip, nf)}</li>}
              {report.repeated.length > 0 && <li>{T("repeated", { list: report.repeated.slice(0, 5).map((r) => `${r.word} (${nf(r.count)})`).join(", ") })}</li>}
              <li>{report.connectives.length ? T("connUsed", { list: report.connectives.map((c) => c.word).join(", ") }) : T("connNone")}</li>
            </ul>
          )}
        </details>
      )}
      <p data-tool-chrome className="m-0 text-[12px] text-[var(--ink-3)]">{T("stays")}</p>
    </div>
  );
}

function Tick({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-[44px] items-start gap-2 py-2 text-[13.5px] text-[var(--ink)]">
      <input type="checkbox" checked={on} onChange={onChange} className={`mt-0.5 h-5 w-5 flex-none ${FOCUS}`} /><span>{label}</span>
    </label>
  );
}

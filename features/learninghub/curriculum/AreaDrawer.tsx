"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { errMsg } from "../types";
import { FOCUS, Icon, SkeletonRows } from "../kit";
import { clearTag, getCellLessons, setTag, type CellLesson } from "./api";
import { GROUP_LABEL, yearLabel, type MapArea } from "./cells";

// The lessons behind one cell of the map: open one, and (a tutor) say "this lesson sits somewhere else" — a per-provider correction.

function Confidence({ l }: { l: CellLesson }) {
  if (l.corrected) return <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-2)_16%,transparent)] px-2 py-px text-[11px] font-extrabold text-[var(--ink)]" title="A tutor here moved this lesson to where it sits now">Corrected</span>;
  if (l.confidence === 0) return null;
  return <span className="rounded-full border border-dashed border-[var(--ink-3)] px-2 py-px text-[11px] font-extrabold text-[var(--ink-2)]" title="Placed automatically — a judgement call. If it looks wrong, a tutor can move it.">Auto-mapped</span>;
}

export function AreaDrawer({ qs, framework, area, year, areas, mode, canCorrect, onClose, onOpenLesson, onChanged }: {
  qs: string; framework: string; area: MapArea; year: number | null; areas: MapArea[]; mode: "tutor" | "child"; canCorrect: boolean;
  onClose: () => void; onOpenLesson: (id: string) => void; onChanged: () => void;
}) {
  const [yr, setYr] = useState<number | null>(year);
  const [data, setData] = useState<{ total: number; lessons: CellLesson[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [moving, setMoving] = useState<CellLesson | null>(null);
  const [target, setTarget] = useState(area.id);
  const [targetYear, setTargetYear] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setData(null); setErr(null);
    getCellLessons(qs, framework, area.id, yr).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setErr(errMsg(e, "Couldn't load these lessons")); });
    return () => { live = false; };
  }, [qs, framework, area.id, yr]);
  useEffect(load, [load]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const years = area.y.map((n, i) => ({ y: i + 1, n })).filter((x) => x.n > 0);
  async function move() {
    if (!moving) return;
    setBusy(true); setErr(null);
    try { await setTag(qs, moving.id, { framework, areaId: target, year: targetYear === "" ? null : targetYear }); setMoving(null); onChanged(); load(); }
    catch (e) { setErr(errMsg(e, "Couldn't move that lesson")); }
    finally { setBusy(false); }
  }
  async function reset(l: CellLesson) {
    setBusy(true); setErr(null);
    try { await clearTag(qs, l.id, framework); onChanged(); load(); } catch (e) { setErr(errMsg(e, "Couldn't reset that lesson")); } finally { setBusy(false); }
  }
  const grouped = areas.reduce<Record<string, MapArea[]>>((m, a) => { (m[a.group] ||= []).push(a); return m; }, {});

  // Drawn on <body> above the portal's own top bar and any impersonation banner (a z-50 child of the hub sat underneath them).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-end justify-center sm:items-stretch sm:justify-end" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={`${area.area} lessons`} className="hub-rise relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-3xl">
        <header className="flex items-start gap-3 border-b border-[var(--line)] p-4">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{GROUP_LABEL[area.group] ?? area.group} · {area.strand}</p>
            <h3 className="m-0 mt-0.5 text-[18px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{area.area}{area.code ? <span className="ml-2 text-[12px] font-bold text-[var(--ink-2)]">{area.code}</span> : null}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] text-[var(--ink)] ${FOCUS}`}><Icon name="close" size={16} /></button>
        </header>

        {years.length > 1 && (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--line)] px-4 py-2.5" role="group" aria-label="Filter by year">
            {[{ y: null as number | null, n: years.reduce((s, x) => s + x.n, 0) }, ...years].map((x) => (
              <button key={String(x.y)} type="button" onClick={() => setYr(x.y)} aria-pressed={yr === x.y}
                className={`min-h-[36px] rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS} ${yr === x.y ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                {x.y === null ? "All years" : `Y${x.y}`} <span className="opacity-70">· {x.n}</span>
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {err && <p role="alert" className="mb-3 rounded-xl border border-[var(--sem-crit)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)]">{err}</p>}
          {!data && !err && <SkeletonRows rows={4} label="Loading lessons" />}
          {data && data.lessons.length === 0 && (
            <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-5 text-center text-[14px] font-semibold text-[var(--ink-2)]">
              {mode === "child" ? "No lessons here yet — your tutor hasn't given you one for this topic." : "No lessons sit here yet. Open a lesson from anywhere in the list and use “Wrong place?” to move it here, or write your own and place it in this area."}
            </p>
          )}
          <ul className="m-0 grid list-none gap-2 p-0">
            {data?.lessons.map((l) => (
              <li key={l.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => onOpenLesson(l.id)} className={`min-w-0 flex-1 text-left ${FOCUS}`}>
                    <span className="block text-[14.5px] font-extrabold leading-snug text-[var(--ink)]">{l.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-[var(--ink-2)]">
                      <span>{yearLabel(l.year)}</span><Confidence l={l} />
                      {mode === "child" && l.done && <span className="inline-flex items-center gap-1 text-[var(--sem-ok)]"><Icon name="check" size={13} /> Finished</span>}
                    </span>
                  </button>
                  <Icon name="chevronRight" size={16} className="mt-1 flex-none text-[var(--ink-2)]" />
                </div>
                {canCorrect && l.canCorrect && (
                  <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--line)] pt-2">
                    <button type="button" onClick={() => { setMoving(l); setTarget(area.id); setTargetYear(l.year); }} className={`min-h-[36px] rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--ink)] ${FOCUS}`}>Wrong place?</button>
                    {l.corrected && <button type="button" disabled={busy} onClick={() => reset(l)} className={`min-h-[36px] rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--ink-2)] ${FOCUS}`}>Reset to automatic</button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {data && data.total > data.lessons.length && <p className="mt-3 text-center text-[12.5px] font-semibold text-[var(--ink-2)]">Showing the first {data.lessons.length} of {data.total} — pick a year to narrow it.</p>}
        </div>

        {moving && (
          <div role="group" aria-label="Move this lesson" className="border-t border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="m-0 mb-2 text-[13px] font-extrabold text-[var(--ink)]">Where should “{moving.title}” sit?</p>
            <label className="mb-2 block text-[12px] font-bold text-[var(--ink-2)]">Curriculum area
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={`mt-1 min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
                {Object.entries(grouped).map(([g, list]) => (
                  <optgroup key={g} label={GROUP_LABEL[g] ?? g}>{list.map((a) => <option key={a.id} value={a.id}>{a.strand} — {a.area}</option>)}</optgroup>
                ))}
              </select>
            </label>
            <label className="mb-3 block text-[12px] font-bold text-[var(--ink-2)]">Year
              <select value={targetYear} onChange={(e) => setTargetYear(e.target.value ? Number(e.target.value) : "")} className={`mt-1 min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
                <option value="">Keep its own year</option>
                {Array.from({ length: 11 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <Button variant="primary" onClick={move} disabled={busy}>{busy ? "Saving…" : "Move it here"}</Button>
              <Button onClick={() => setMoving(null)} disabled={busy}>Cancel</Button>
            </div>
            <p className="m-0 mt-2 text-[11.5px] font-semibold text-[var(--ink-2)]">This only changes your own map — it doesn’t edit the lesson.</p>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

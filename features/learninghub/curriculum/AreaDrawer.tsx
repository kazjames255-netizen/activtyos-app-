"use client";

import { curLabel } from "./curLabels";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "@/components/ui";
import { get } from "@/lib/api";
import { errMsg } from "../types";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDateLoc } from "../lesson/fmt";
import { FOCUS, Icon, SkeletonRows, tint } from "../kit";
import { SubjectGlyph } from "../subjectArt";
import { useEscapeLayer } from "../escapeLayer";
import { LIGHT_SCOPE } from "../tools/lightScope";
import { clearTag, getCellLessons, setTag, type CellLesson } from "./api";
import { groupLabel, strandColor, yearLabel, type MapArea } from "./cells";

/** A brand-new lesson (no oakKey, never corrected) never shows up in ANY area's cell — so an empty cell had no way
 *  to reach it. Search the tutor's own lessons by title and place one here directly (P-oak-04). */
function FindAndPlace({ qs, framework, areaId, onPlaced }: { qs: string; framework: string; areaId: string; onPlaced: () => void }) {
  const { t: tr } = useI18n();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; title: string }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setRows(null); return; }
    let live = true;
    const timer = setTimeout(() => {
      const sp = new URLSearchParams({ limit: "8", q: needle });
      get<{ items: { id: string; title: string }[] }>(`/api/learning-hub/notes${qs}${qs ? "&" : "?"}${sp.toString()}`)
        .then((r) => { if (live) setRows(r.items); }).catch(() => { if (live) setRows([]); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [q, qs]);
  const place = async (id: string) => {
    setBusy(id); setErr(null);
    try { await setTag(qs, id, { framework, areaId }); setQ(""); setRows(null); onPlaced(); }
    catch (e) { setErr(errMsg(e, tr("hublessons.adCouldntPlace"))); } finally { setBusy(null); }
  };
  return (
    <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
      <p className="m-0 mb-1.5 text-[12px] font-extrabold text-[var(--ink)]">{tr("hublessons.adFindPlace")}</p>
      <Input type="search" aria-label={tr("hublessons.adSearchAria")} placeholder={tr("hublessons.adSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} className="min-h-[40px] w-full" />
      {err && <p role="alert" className="m-0 mt-1.5 text-[12px] font-bold text-[var(--sem-crit)]">{err}</p>}
      {rows && (
        <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
          {rows.length === 0 && <li className="text-[12px] font-semibold text-[var(--ink-2)]">{tr("hublessons.adNoLessonsMatch", { q: q.trim() })}</li>}
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
              <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--ink)]">{r.title}</span>
              <button type="button" disabled={busy === r.id} onClick={() => void place(r.id)} className={`flex-none rounded-full border border-[var(--brand)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--brand)] ${FOCUS}`}>{busy === r.id ? tr("hublessons.adPlacing") : tr("hublessons.adPlaceHere")}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The lessons behind one cell of the map: open one, and (a tutor) say "this lesson sits somewhere else" — a per-provider correction.

export function AreaDrawer({ qs, framework, area, areas, mode, canCorrect, inline = false, highlight = "", only, onClose, onOpenLesson, onChanged }: {
  qs: string; framework: string; area: MapArea; areas: MapArea[]; mode: "tutor" | "child"; canCorrect: boolean;
  /** Sits in the page's own flow, right under the coverage grid — no portal, backdrop, focus-trap, or scroll lock. */
  inline?: boolean;
  /** The map's lesson search text: lessons whose title matches it get a ring, and the first is scrolled into view. */
  highlight?: string;
  /** Exact titles of the lessons the search found in this area: when given (and present here) those are the ONLY cards shown. */
  only?: string[];
  onClose: () => void; onOpenLesson: (id: string) => void; onChanged: () => void;
}) {
  const { t: tr, locale } = useI18n();
  // Always all years for this area — the map's own year pills already say which year is on show; a second,
  // separate year filter inside the drawer just duplicated that without adding anything.
  const yr: number | null = null;
  const [data, setData] = useState<{ total: number; lessons: CellLesson[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const [moving, setMoving] = useState<CellLesson | null>(null);
  const [target, setTarget] = useState(area.id);
  const [targetYear, setTargetYear] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Accessibility (modal only — inline is normal page content, so it keeps ordinary tab order and scroll):
  // move focus in on open, keep Tab inside, lock the page scroll, and give focus back to whatever opened it.
  useEffect(() => {
    if (inline) return;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), select, a[href], input")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => { window.removeEventListener("keydown", trap); document.body.style.overflow = prev; if (opener && document.contains(opener)) opener.focus(); };
  }, [inline]);

  const load = useCallback(() => {
    let live = true;
    setData(null); setErr(null);
    getCellLessons(qs, framework, area.id, yr).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setErr(errMsg(e, tr("hublessons.adCouldntLoad"))); });
    return () => { live = false; };
  }, [qs, framework, area.id, yr]);
  useEffect(load, [load]);
  // A search that led here was for ONE lesson, and the area holds dozens that aren't relevant to it: while the search
  // text matches lessons in this area, show ONLY those (with a way back to the whole list). If none of this area's
  // lessons match the text (the AREA matched by name), nothing is filtered.
  const tokens = highlight.trim().toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  const isHit = (title: string) => (only?.length ? only.includes(title) : false) || (tokens.length > 0 && tokens.every((t) => title.toLowerCase().includes(t)));
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { setShowAll(false); }, [highlight]);
  const hits = data ? data.lessons.filter((l) => isHit(l.title)) : [];
  const filtered = hits.length > 0 && !showAll;
  const shown = data ? (filtered ? hits : data.lessons) : [];
  useEscapeLayer(!inline, onClose);

  async function move() {
    if (!moving) return;
    setBusy(true); setMoveErr(null);
    try { await setTag(qs, moving.id, { framework, areaId: target, year: targetYear === "" ? null : targetYear }); setMoving(null); onChanged(); load(); }
    catch (e) { setMoveErr(errMsg(e, tr("hublessons.adCouldntMove"))); }
    finally { setBusy(false); }
  }
  async function reset(l: CellLesson) {
    setBusy(true); setErr(null);
    try { await clearTag(qs, l.id, framework); onChanged(); load(); } catch (e) { setErr(errMsg(e, tr("hublessons.adCouldntReset"))); } finally { setBusy(false); }
  }
  const grouped = areas.reduce<Record<string, MapArea[]>>((m, a) => { (m[a.group] ||= []).push(a); return m; }, {});

  const panel = (
      <aside ref={panelRef} tabIndex={inline ? undefined : -1} role={inline ? "region" : "dialog"} aria-modal={inline ? undefined : true} aria-label={tr("hublessons.adLessonsAria", { area: area.area })}
        className={inline
          ? "flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] outline-none"
          : "hub-rise motion-reduce:animate-none relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl outline-none sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-s-3xl"}>
        <header className="flex items-start gap-3 border-b border-[var(--line)] p-4">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{groupLabel(area.group, tr)} · {curLabel(area.strand)}</p>
            <h3 className="m-0 mt-0.5 text-[18px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{curLabel(area.area)}{area.code ? <span className="ms-2 text-[12px] font-bold text-[var(--ink-2)]">{area.code}</span> : null}</h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={tr("hublessons.close")} className={`grid h-11 w-11 flex-none place-items-center rounded-full border border-[var(--line)] text-[var(--ink)] ${FOCUS}`}><Icon name="close" size={16} /></button>
        </header>


        <div className={inline ? "p-4" : "min-h-0 flex-1 overflow-y-auto p-4"}>
          {err && <p role="alert" className="mb-3 rounded-xl border border-[var(--sem-crit)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)]">{err}</p>}
          {!data && !err && <SkeletonRows rows={4} label={tr("hublessons.adLoadingLessons")} />}
          {data && data.lessons.length === 0 && (
            <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-5 text-center text-[14px] font-semibold text-[var(--ink-2)]">
              {mode === "child" ? tr("hublessons.adNoneChild") : tr("hublessons.adNoneTutor")}
            </p>
          )}
          {/* Same lesson-card shell as the main list below the map — not a bespoke row style. */}
          {data && hits.length > 0 && (
            <p className="m-0 mb-2 flex flex-wrap items-center gap-2 text-[13px] font-bold text-[var(--ink-2)]" data-testid="curriculum-drawer-filter">
              {filtered ? tr("hublessons.adShowingMatching", { n: hits.length, q: highlight.trim() }) : tr("hublessons.adShowingAll", { n: data.lessons.length })}
              <button type="button" onClick={() => setShowAll((v) => !v)} className={`rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] font-extrabold text-[var(--brand)] ${FOCUS}`}>{filtered ? tr("hublessons.adShowAllInArea", { n: data.lessons.length }) : tr("hublessons.adShowOnlyMatches")}</button>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((l) => (
              <article key={l.id} data-ui="card" className={`${!filtered && isHit(l.title) ? "ring-2 ring-[var(--brand)] ring-offset-2 " : ""}hub-lift group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] has-[.hit:focus-visible]:ring-2 has-[.hit:focus-visible]:ring-[var(--brand-2)]`}>
                {/* Same colour as this area's tile on the map (strandColor), not the subject's generic colour — so a card opened from "Spoken English" matches the purple tile it came from. */}
                <div className="relative h-[60px] flex-none overflow-hidden" style={{ background: `linear-gradient(135deg, ${tint(strandColor(area), 30)} 0%, ${tint(strandColor(area), 12)} 100%)`, color: strandColor(area) }}>
                  <SubjectGlyph subject={area.strand} size={75} className="pointer-events-none absolute -bottom-3 -end-2 opacity-25" />
                  <div className="relative flex h-[60px] items-center gap-2 ps-3.5 pe-2">
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-[var(--ink)] backdrop-blur">{yearLabel(l.year, tr)}</span>
                    {mode === "child" && l.done && <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-[var(--sem-ok)] backdrop-blur"><Icon name="check" size={12} /> {tr("hublessons.adFinished")}</span>}
                    {/* Distinct from "Finished" (the exit quiz handed in): this child has actually gone through the lesson at
                        all, quiz or no quiz — see lessonApi.ts POST /notes/:id/viewed. Shown even alongside "Finished". */}
                    {mode === "child" && l.viewed && !l.done && <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-[var(--ink-2)] backdrop-blur" data-testid="lesson-studied-tick"><Icon name="check" size={12} /> {tr("hublessons.adStudied")}</span>}
                    {canCorrect && l.canCorrect && (
                      <span className="relative z-10 ms-auto flex flex-none items-center gap-1">
                        <button type="button" onClick={() => { setMoving(l); setTarget(area.id); setTargetYear(l.year); }} className={`rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1 text-[11px] font-extrabold text-[var(--ink)] backdrop-blur ${FOCUS}`}>{tr("hublessons.adWrongPlace")}</button>
                        {l.corrected && <button type="button" disabled={busy} onClick={() => reset(l)} className={`rounded-full border border-[var(--line)] bg-white/80 px-2.5 py-1 text-[11px] font-extrabold text-[var(--ink-2)] backdrop-blur ${FOCUS}`}>{tr("hublessons.adReset")}</button>}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-3.5">
                  <h4 className="text-[14.5px] font-extrabold leading-snug text-[var(--ink)]">
                    <button type="button" onClick={() => onOpenLesson(l.id)} className="hit rounded text-start outline-none after:absolute after:inset-0 after:content-['']">{l.title}</button>
                  </h4>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{l.excerpt || tr("hublessons.adNoText")}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3 text-[11px] font-semibold text-[var(--ink-2)]">
                    {l.isLesson && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-extrabold" style={{ background: tint("var(--violet)", 12), color: "var(--violet)" }}><Icon name="sparkle" size={11} />{tr("hublessons.npInteractive")}</span>}
                    <span>{l.createdByName || tr("hublessons.adYourTutor")}</span>
                    {l.updatedAt && <><span aria-hidden="true">·</span><span>{fmtDateLoc(l.updatedAt, locale)}</span></>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {data && !filtered && data.total > data.lessons.length && <p className="mt-3 text-center text-[12.5px] font-semibold text-[var(--ink-2)]">{tr("hublessons.adFirstOfTotal", { n: data.lessons.length, total: data.total })}</p>}
          {/* However many lessons already sit here (at other years), a fresh lesson with no oakKey never shows up in ANY
              area's list — so this is always offered, not just on a fully-empty cell. */}
          {data && mode === "tutor" && canCorrect && <FindAndPlace qs={qs} framework={framework} areaId={area.id} onPlaced={() => { onChanged(); load(); }} />}
        </div>

        {moving && (
          <div role="group" aria-label={tr("hublessons.adMoveAria")} className="border-t border-[var(--line)] bg-[var(--panel)] p-4">
            <p className="m-0 mb-2 text-[13px] font-extrabold text-[var(--ink)]">{tr("hublessons.adWhereSit", { title: moving.title })}</p>
            <label className="mb-2 block text-[12px] font-bold text-[var(--ink-2)]">{tr("hublessons.adCurriculumArea")}
              <select value={target} onChange={(e) => setTarget(e.target.value)} className={`mt-1 min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
                {Object.entries(grouped).map(([g, list]) => (
                  <optgroup key={g} label={groupLabel(g, tr)}>{list.map((a) => <option key={a.id} value={a.id}>{curLabel(a.strand)} — {curLabel(a.area)}</option>)}</optgroup>
                ))}
              </select>
            </label>
            <label className="mb-3 block text-[12px] font-bold text-[var(--ink-2)]">{tr("hublessons.ccYear")}
              <select value={targetYear} onChange={(e) => setTargetYear(e.target.value ? Number(e.target.value) : "")} className={`mt-1 min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] font-semibold text-[var(--ink)] ${FOCUS}`}>
                <option value="">{tr("hublessons.adKeepYear")}</option>
                {Array.from({ length: 11 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{yearLabel(y, tr)}</option>)}
              </select>
            </label>
            {moveErr && <p role="alert" className="m-0 mb-2 text-[12.5px] font-bold text-[var(--sem-crit)]">{moveErr}</p>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={move} disabled={busy}>{busy ? tr("hublessons.saving") : tr("hublessons.adMoveHere")}</Button>
              <Button onClick={() => setMoving(null)} disabled={busy}>{tr("hublessons.cancel")}</Button>
            </div>
            <p className="m-0 mt-2 text-[11.5px] font-semibold text-[var(--ink-2)]">{tr("hublessons.adOnlyYourMap")}</p>
          </div>
        )}
      </aside>
  );

  if (inline) return panel;

  // Modal only: drawn on <body> above the portal's own top bar and any impersonation banner (a z-50 child of the hub sat underneath them).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="aos-light fixed inset-0 z-[3000] flex items-end justify-center sm:items-stretch sm:justify-end" role="presentation" style={LIGHT_SCOPE}>
      <div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      {panel}
    </div>,
    document.body,
  );
}

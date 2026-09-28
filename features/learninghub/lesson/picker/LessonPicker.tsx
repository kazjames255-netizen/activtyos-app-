"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { get } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { errMsg, type Topic } from "../../types";
import { FOCUS, Icon, SkeletonRows, subjectColor, tint } from "../../kit";
import { SubjectGlyph } from "../../subjectArt";
import { scrollEdges } from "../../rtl";
import type { CurriculumMap } from "../../curriculum/api";
import { groupLabel, GROUP_ORDER, rowsByArea, yearsWithContent, type MapArea } from "../../curriculum/cells";
import { emojiFor } from "../../curriculum/stickers";
import { Tile, TILE_GRID, YearPills, shortArea } from "../../curriculum/CurriculumCard";
import { CAP, RECENT_MAX, fetchCell, fetchPage, fetchYears, loadMap, loadTopics, pushRecent, readRecent, type NotesQuery } from "./data";
import { CARD_GRID, PickCard } from "./PickCard";
import type { PickItem } from "./types";

// The ONE lesson picker every "choose a lesson" screen uses (Teach in person, Schedule a video lesson, the in-call Lessons tab, homework
// worksheets…). It is the Lessons area's own design: subject tiles with counts -> year chips -> curriculum sticker tiles -> lesson cards,
// or a big search / "All A–Z" list of the same cards. Everything is server-paged (24 a page, hard cap 240 in the DOM) over the cached
// notes index, and the map + topics are cached, so a warm open paints at once.

const GROUP_EMOJI: Record<string, string> = { maths: "🔢", english: "📖", science: "🧪", languages: "🌍" };
const GROUP_SUBJECT: Record<string, string> = { maths: "Maths", english: "English", science: "Science", languages: "French" };

export interface LessonPickerProps {
  /** The hub query string ("?tenantId=…"). */
  qs: string;
  mode?: "single" | "multi";
  /** Ids currently chosen. */
  value: string[];
  onChange: (ids: string[], items: PickItem[]) => void;
  /** Year / child context: shows a "Suggested for Year 4" shelf at the top. */
  years?: number[];
  /** Pre-select the year chip from `years` (shown as a removable chip). Default: all years. */
  yearDefault?: boolean;
  /** Only interactive lessons (default true). */
  lessonsOnly?: boolean;
  /** Only lessons that carry a worksheet (skips the curriculum map and lists them straight away). */
  worksheetOnly?: boolean;
  /** Only published lessons (default true). */
  published?: boolean;
  /** Skip the curriculum map: go straight to the A–Z list. */
  flat?: boolean;
  /** Search box wording (defaults to the lesson words). */
  searchLabel?: string;
  /** Multi mode: the most that can be chosen. */
  max?: number;
  /** Extra controls on each card (e.g. Preview). */
  actions?: (it: PickItem) => ReactNode;
  /** Words for the empty state when the whole library has nothing (e.g. "Worksheets are being added to your library"). */
  emptyLibrary?: string;
  /** Recently-used shelf key ("lesson" by default). */
  kind?: string;
  idPrefix?: string;
  testId?: string;
}

const chipCls = (on: boolean) => `min-h-[44px] flex-none rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
const asRecent = (kind: string): PickItem[] => readRecent(kind).slice(0, RECENT_MAX).map((r) => ({ id: r.id, title: r.title, year: r.year ?? null, isLesson: true }));

export function LessonPicker({ qs, mode = "single", value, onChange, years, yearDefault, lessonsOnly = true, worksheetOnly, published = true, flat, max, searchLabel, actions, emptyLibrary, kind = "lesson", idPrefix = "lp", testId = "lesson-picker" }: LessonPickerProps) {
  const t = useT();
  const single = mode === "single";
  const noMap = !!flat || !!worksheetOnly;
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const [map, setMap] = useState<CurriculumMap | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(yearDefault && years?.length === 1 ? years[0]! : null);
  const [area, setArea] = useState<MapArea | null>(null);
  const [all, setAll] = useState(noMap);
  const [subj, setSubj] = useState("");
  const seen = useRef(new Map<string, PickItem>());
  const [known, setKnown] = useState<Map<string, PickItem>>(() => new Map());
  // Worksheet chips carry counts (one small additive read of GET /notes/counts).
  const [wsCounts, setWsCounts] = useState<{ byYear: Record<string, number>; bySubject: Record<string, number> } | null>(null);
  useEffect(() => {
    if (!worksheetOnly) return;
    let live = true;
    get<{ worksheetsByYear?: Record<string, number>; worksheetsBySubject?: Record<string, number> }>(`/api/learning-hub/notes/counts${qs}`).then((r) => { if (live) setWsCounts({ byYear: r.worksheetsByYear ?? {}, bySubject: r.worksheetsBySubject ?? {} }); }).catch(() => undefined);
    return () => { live = false; };
  }, [qs, worksheetOnly]);
  const topicById = useMemo(() => new Map((topics ?? []).map((x) => [x.id, x])), [topics]);

  useEffect(() => {
    let live = true;
    loadTopics(qs).then((r) => { if (live) setTopics(r); }).catch(() => { if (live) setTopics([]); });
    if (!noMap) loadMap(qs).then((m) => { if (live) setMap(m); }).catch(() => { if (live) setMap({ areas: [], rows: [] } as unknown as CurriculumMap); });
    return () => { live = false; };
  }, [qs, noMap]);

  // ---- data ------------------------------------------------------------------------------------------------------------
  const searching = dq.length >= 2;
  const listing = searching || all;
  const query = useMemo<NotesQuery>(() => ({ q: searching ? dq : "", year, subject: subj, lessons: lessonsOnly && !worksheetOnly, worksheet: !!worksheetOnly, published }), [searching, dq, year, subj, lessonsOnly, worksheetOnly, published]);
  const [rows, setRows] = useState<PickItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    setErr(null);
    fetchPage(qs, query, null, topicById).then((r) => { if (mine === seq.current) { setRows(r.items.map((it) => (worksheetOnly ? { ...it, isLesson: false } : it))); setTotal(r.total); setNext(r.next); } })
      .catch((e) => { if (mine === seq.current) { setRows([]); setErr(errMsg(e, t("hubpicker.errLoad"))); } });
  }, [qs, query, topicById, t, worksheetOnly]);
  useEffect(() => { if (listing && topics) { setRows(null); load(); } }, [listing, topics, load]);
  const showMore = async () => {
    if (!next || more) return;
    setMore(true);
    try { const r = await fetchPage(qs, query, next, topicById); setRows((cur) => [...(cur ?? []), ...r.items.map((it) => (worksheetOnly ? { ...it, isLesson: false } : it)).filter((x) => !(cur ?? []).some((c) => c.id === x.id))]); setNext(r.next); }
    catch (e) { setErr(errMsg(e, t("hubpicker.errLoad"))); } finally { setMore(false); }
  };

  const [cell, setCell] = useState<PickItem[] | null>(null);
  useEffect(() => {
    if (!area || listing) { setCell(null); return; }
    let live = true; setCell(null);
    fetchCell(qs, area, year).then((r) => { if (live) setCell(lessonsOnly ? r.items.filter((x) => x.isLesson !== false) : r.items); }).catch((e) => { if (live) { setCell([]); setErr(errMsg(e, t("hubpicker.errLoad"))); } });
    return () => { live = false; };
  }, [area, year, qs, listing, lessonsOnly, t]);

  // The shelf: this class's year(s), plus what the tutor picked last time.
  const yearsKey = (years ?? []).join(",");
  const [suggest, setSuggest] = useState<PickItem[]>([]);
  useEffect(() => {
    if (!yearsKey || noMap || !topics) { setSuggest([]); return; }
    let live = true;
    fetchYears(qs, yearsKey, topicById).then((r) => { if (live) setSuggest(r); }).catch(() => undefined);
    return () => { live = false; };
  }, [qs, yearsKey, noMap, topics, topicById]);
  const [recent, setRecent] = useState<PickItem[]>([]);
  useEffect(() => { setRecent(asRecent(kind)); }, [kind]);

  // ---- selection -------------------------------------------------------------------------------------------------------
  useEffect(() => { for (const it of [...(rows ?? []), ...(cell ?? []), ...suggest]) seen.current.set(it.id, it); }, [rows, cell, suggest]);
  const chosen = new Set(value);
  const pick = (it: PickItem) => {
    seen.current.set(it.id, it);
    setKnown((k) => new Map(k).set(it.id, it));
    const on = chosen.has(it.id);
    const ids = single ? (on ? [] : [it.id]) : on ? value.filter((x) => x !== it.id) : max && value.length >= max ? value : [...value, it.id];
    if (!on) { pushRecent(kind, { id: it.id, title: it.title, year: it.year }); setRecent(asRecent(kind)); }
    onChange(ids, ids.map((id) => seen.current.get(id) ?? { id, title: "" }));
  };

  // ---- map derivations -------------------------------------------------------------------------------------------------
  const groups = useMemo(() => GROUP_ORDER.filter((g) => map?.areas.some((a) => a.group === g && a.y.some((n) => n > 0))), [map]);
  const groupCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of map?.areas ?? []) m.set(a.group, (m.get(a.group) ?? 0) + (year ? a.y[year - 1] ?? 0 : a.y.reduce((s, n) => s + n, 0)));
    return m;
  }, [map, year]);
  const byArea = useMemo(() => rowsByArea(map?.rows ?? []), [map]);
  const inGroup = useMemo(() => (map?.areas ?? []).filter((a) => a.group === group), [map, group]);
  const yearList = useMemo(() => (noMap || listing || !group ? Array.from({ length: 13 }, (_, i) => i + 1) : yearsWithContent(inGroup, byArea)), [noMap, listing, group, inGroup, byArea]);
  const tiles = useMemo(() => inGroup.map((a) => ({ a, n: year ? a.y[year - 1] ?? 0 : a.y.reduce((s, x) => s + x, 0) })).filter((x) => x.n > 0), [inGroup, year]);
  // In the worksheet picker a subject with no worksheet is noise: once the counts are in, only subjects that have some (or the chosen one) stay.
  const subjects = useMemo(() => [...new Set((topics ?? []).map((x) => x.subject).filter(Boolean))].filter((s) => !worksheetOnly || !wsCounts || s === subj || (wsCounts.bySubject[s] ?? 0) > 0).sort((a, b) => a.localeCompare(b)), [topics, worksheetOnly, wsCounts, subj]);

  const filtered = !!(dq || year || subj);
  const clearAll = () => { setQ(""); setDq(""); setYear(null); setSubj(""); setArea(null); if (!noMap) { setAll(false); setGroup(null); } };

  const cards = (items: PickItem[]) => (
    <ul className={CARD_GRID} role={single ? "radiogroup" : "group"} aria-label={t("hubpicker.searchAria")} data-testid={`${idPrefix}-cards`}>
      {items.map((it) => <li key={it.id} className="grid"><PickCard item={it} selected={chosen.has(it.id)} single={single} onPick={pick} actions={actions?.(it)} /></li>)}
    </ul>
  );
  const pickedItems = value.map((id) => known.get(id)).filter((x): x is PickItem => !!x && !!x.title);
  const showShelf = !listing && !area && !group && (suggest.length > 0 || recent.length > 0);

  return (
    <div data-testid={testId} className="grid min-w-0 gap-3 [grid-template-columns:minmax(0,1fr)]">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchLabel ?? t("hubpicker.searchPh")} aria-label={searchLabel ?? t("hubpicker.searchAria")} id={`${idPrefix}-search`} data-testid={`${idPrefix}-search`}
          className={`min-h-[52px] w-full rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] ps-11 pe-4 text-[15px] font-semibold text-[var(--ink)] placeholder:font-medium placeholder:text-[var(--ink-3)] focus:border-[var(--brand)] ${FOCUS}`} />
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid={`${idPrefix}-chosen`} aria-live="polite">
          <span className="text-[12.5px] font-extrabold text-[var(--brand)]">{t("hubpicker.selectedN", { n: value.length })}</span>
          {pickedItems.map((it) => <span key={it.id} className="max-w-full truncate rounded-full border border-[var(--brand)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink)]" style={{ background: tint("var(--brand)", 10) }}>{it.title}</span>)}
          {!single && <button type="button" onClick={() => onChange([], [])} className={`min-h-[44px] rounded-full px-3 text-[12.5px] font-extrabold text-[var(--brand)] ${FOCUS}`}>{t("hubpicker.clear")}</button>}
        </div>
      )}

      {showShelf && (
        <div className="grid gap-2" data-testid={`${idPrefix}-shelf`}>
          {suggest.length > 0 && <Shelf title={t("hubpicker.suggested", { years: (years ?? []).map((y) => t("hublessons.yearN", { n: y })).join(", ") })}>{suggest.map((it) => <PickCard key={it.id} compact item={it} selected={chosen.has(it.id)} single={single} onPick={pick} />)}</Shelf>}
          {recent.length > 0 && <Shelf title={t("hubpicker.recent")}>{recent.map((it) => <PickCard key={it.id} compact item={it} selected={chosen.has(it.id)} single={single} onPick={pick} />)}</Shelf>}
        </div>
      )}

      {!noMap && !listing && !area && (
        !map ? <SkeletonRows rows={2} variant="card" grid label={t("hubpicker.loading")} /> : (
          <ul className={TILE_GRID} role="group" aria-label={t("hubpicker.subjectsAria")} data-testid={`${idPrefix}-subjects`}>
            {groups.map((g) => {
              const on = group === g, col = subjectColor(GROUP_SUBJECT[g] ?? g);
              return (
                <li key={g}><button type="button" aria-pressed={on} onClick={() => setGroup(on ? null : g)} data-group={g}
                  className={`hub-lift relative grid min-h-[92px] w-full content-between gap-1 overflow-hidden rounded-2xl border-2 p-3 text-start ${FOCUS}`} style={{ borderColor: on ? "var(--brand)" : tint(col, 30), background: `linear-gradient(135deg, ${tint(col, on ? 30 : 22)} 0%, ${tint(col, 8)} 100%)`, color: col }}>
                  <SubjectGlyph subject={GROUP_SUBJECT[g] ?? g} size={64} className="pointer-events-none absolute -bottom-2 -end-1 opacity-20" />
                  <span aria-hidden className="text-[30px] leading-none">{GROUP_EMOJI[g] ?? "⭐"}</span>
                  <span className="grid"><span className="text-[15px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{groupLabel(g, t)}</span>
                    <span className="text-[12px] font-bold text-[var(--ink-2)]">{t("hubpicker.lessonsN", { n: groupCount.get(g) ?? 0 })}</span></span>
                  {on && <span aria-hidden className="absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand)] text-[var(--on-brand,#fff)]"><Icon name="check" size={12} /></span>}
                </button></li>
              );
            })}
          </ul>
        )
      )}
      {listing && subjects.length > 1 ? (
        <div role="group" aria-label={t("hubpicker.subjectsAria")} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid={`${idPrefix}-subject-chips`}>
          <button type="button" aria-pressed={!subj} onClick={() => setSubj("")} className={chipCls(!subj)}>{t("hubpicker.allSubjects")}</button>
          {subjects.map((s) => { const c = subjectColor(s), on = subj === s; return (
            <button key={s} type="button" aria-pressed={on} onClick={() => setSubj(on ? "" : s)} className={`min-h-[44px] flex-none rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS}`}
              style={on ? { borderColor: c, background: c, color: "#fff" } : { borderColor: c, background: "var(--surface)", color: c }}>{s}{wsCounts ? <span className="ms-1.5 text-[12px] font-bold opacity-80">{wsCounts.bySubject[s] ?? 0}</span> : null}</button>); })}
        </div>
      ) : null}
      {(map || noMap) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1"><YearPills years={yearList} value={year} onPick={(y) => { setYear(y); setArea(null); }} counts={worksheetOnly ? wsCounts?.byYear : undefined} /></div>
          {!noMap && !searching && (
            <button type="button" aria-pressed={all} onClick={() => { setAll((v) => !v); setArea(null); }} data-testid={`${idPrefix}-all`} className={`mb-2 ${chipCls(all)}`}>{t("hubpicker.browseAll")}</button>
          )}
        </div>
      )}

      {err && <p role="alert" className="m-0 rounded-xl border border-[var(--sem-crit)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)]">{err} <button type="button" onClick={load} className="font-extrabold text-[var(--brand)] underline">{t("hubpicker.retry")}</button></p>}

      {listing ? (
        rows === null ? <SkeletonRows rows={4} variant="card" grid label={t("hubpicker.loading")} /> :
        rows.length === 0 ? <Empty text={(!filtered || (worksheetOnly && wsCounts && Object.values(wsCounts.byYear).every((n) => !n))) && emptyLibrary ? emptyLibrary : worksheetOnly && (year || subj) ? t("hubpicker.noWorksheetsFor", { what: [year ? t("hublessons.yearN", { n: year }) : "", subj].filter(Boolean).join(" · ") }) : t("hubpicker.noMatch")} onClear={filtered ? clearAll : undefined} /> : (
          <>
            <p className="m-0 text-[12.5px] font-bold text-[var(--ink-2)]" aria-live="polite" data-testid={`${idPrefix}-count`}>{t("hubpicker.results", { n: total })}</p>
            {cards(rows)}
            {rows.length >= CAP ? <p className="m-0 text-center text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubpicker.capHint", { n: CAP })}</p>
              : next && <div className="flex justify-center"><Button onClick={() => void showMore()} disabled={more} className="!min-h-[44px] !px-6" data-testid={`${idPrefix}-more`}>{more ? t("hubpicker.loading") : t("hubpicker.showMore", { n: Math.max(0, total - rows.length) })}</Button></div>}
          </>
        )
      ) : area ? (
        <div className="grid gap-2">
          <button type="button" onClick={() => setArea(null)} className={`min-h-[44px] w-fit rounded-full border border-[var(--line)] px-3.5 text-[13px] font-extrabold text-[var(--brand)] ${FOCUS}`}>← {t("hubpicker.back")}</button>
          <h3 className="m-0 text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{emojiFor(area.area, area.strand)} {t("hubpicker.areaLessons", { area: shortArea(area.area) })}</h3>
          {cell === null ? <SkeletonRows rows={3} variant="card" grid label={t("hubpicker.loading")} /> : cell.length === 0 ? <Empty text={t("hubpicker.noMatch")} /> : cards(cell)}
        </div>
      ) : group ? (
        tiles.length === 0 ? <Empty text={t("hubpicker.noYearLessons")} onClear={() => setYear(null)} /> : (
          <div data-testid={`${idPrefix}-areas`}>
            <p className="m-0 mb-2 text-[12.5px] font-bold text-[var(--ink-2)]">{t("hubpicker.mapHint")}</p>
            <ul className={TILE_GRID}>
              {tiles.map(({ a, n }) => <li key={a.id}><Tile area={a} kind="neutral" count={n} word="" label={`${shortArea(a.area)}, ${t("hubpicker.lessonsN", { n })}`} onClick={() => setArea(a)} /></li>)}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}

/** A horizontally-scrolling shelf of cards: edge-faded (not hard-clipped) so it's visibly scrollable, not a cut-off row. */
function Shelf({ title, children }: { title: string; children: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const readEdges = useCallback(() => {
    const s = scroller.current;
    if (!s) return;
    const e = scrollEdges(s);
    setEdges((cur) => (cur.l === e.left && cur.r === e.right ? cur : { l: e.left, r: e.right }));
  }, []);
  useLayoutEffect(() => { readEdges(); }, [readEdges, children]);
  useEffect(() => {
    const s = scroller.current;
    if (!s || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(readEdges); ro.observe(s);
    return () => ro.disconnect();
  }, [readEdges]);
  const fade = { "--hub-fade-l": edges.l ? "32px" : "0px", "--hub-fade-r": edges.r ? "32px" : "0px" } as CSSProperties;
  return (
    <section>
      <h3 className="m-0 mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{title}</h3>
      <div ref={scroller} onScroll={readEdges} style={fade} className="hub-fade-x flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}
function Empty({ text, onClear }: { text: string; onClear?: () => void }) {
  const t = useT();
  return (
    <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center" data-testid="lesson-picker-empty">
      <p className="m-0 text-[14px] font-semibold text-[var(--ink-2)]">{text}</p>
      {onClear && <Button onClick={onClear} className="!min-h-[44px]">{t("hubpicker.clearFilters")}</Button>}
    </div>
  );
}

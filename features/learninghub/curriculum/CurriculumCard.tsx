"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { errMsg, type Student } from "../types";
import { FOCUS, Icon, SkeletonRows } from "../kit";
import { bandOrDefault } from "../family/kidCopy";
import { getMap, getStudentYear, searchAreasByLesson, type CurriculumMap, type StudentArea } from "./api";
import { STICKER_COPY, emojiFor } from "./stickers";
import { AreaDrawer } from "./AreaDrawer";
import { GROUP_LABEL, GROUP_ORDER, byStrand, cellKind, childSummary, defaultYear, expectedInYear, extraInYear, parseYear, rowsByArea, stickerDone, stickerStars, strandColor, studentState, summarise, yearsWithContent, type MapArea, type YearItem } from "./cells";

// "Where do these lessons fit the curriculum?" — the first (and primary) thing on the Lessons tab, always open:
// this replaced the old subject/topic sidebar + flat lesson list as the main way to find a lesson.
//  Tutor: a heat-map of every curriculum area × year, coloured by how many lessons cover it (gaps and thin spots stand out).
//  Child: the same grid recoloured by what THIS child has been given and finished.
// Tap a cell → the lessons behind it (open one; a tutor can also move a lesson that was auto-mapped wrongly).

const LS = "hub.curriculum.v3"; // v3: this card is the primary way to browse lessons — always open, no accordion (product IA simplification)
const readPref = (): { fw?: string; group?: string; onlyGaps?: boolean; year?: number } => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };
const writePref = (p: object) => { try { localStorage.setItem(LS, JSON.stringify({ ...readPref(), ...p })); } catch { /* a nicety */ } };

const TINT = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${pct}%, var(--surface))`;

export function Ring({ pct, label, size = 92, count }: { pct: number; label: string; size?: number; /** No score to show (nothing to measure against): draw an empty ring with this number in the middle instead. */ count?: number }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r;
  if (count !== undefined) return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${count} ${label}`} className="flex-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={9} strokeDasharray="3 5" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight={800} fill="var(--ink)" style={{ fontFamily: "var(--ff-display)" }}>{count}</text>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% ${label}`} className="flex-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={9} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sem-ok)" strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-[stroke-dasharray] duration-700 motion-reduce:transition-none" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.26} fontWeight={800} fill="var(--ink)" style={{ fontFamily: "var(--ff-display)" }}>{pct}%</text>
    </svg>
  );
}
const Stat = ({ n, label, dot }: { n: number; label: string; dot: string }) => (
  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} /><b className="tabular-nums">{n}</b> <span className="font-semibold text-[var(--ink-2)]">{label}</span></span>
);

export function CurriculumCard({ qs, canEdit, mayAuthor, students: studentsProp, onOpenLesson, onSetHomework, onNewLesson }: {
  /** The hub query string for READS ("?tenantId=…", plus &childId=… for a parent). */
  qs: string; canEdit: boolean; mayAuthor: boolean;
  /** The hub's already-fetched roster (useHubData) — reused here instead of a second GET /students. */
  students: Student[];
  onOpenLesson: (id: string) => void;
  /** Student lens: open the shared "set homework" flow with this student and lesson ticked. */
  onSetHomework?: (childId: string, lessonId: string, title: string) => void; onNewLesson?: () => void;
}) {
  const pref = useMemo(readPref, []);
  const [fw, setFw] = useState(pref.fw ?? "nc2014");
  const [group, setGroup] = useState<string | null>(pref.group ?? null);
  // The map always OPENS on "All years" (null) — never on a remembered or guessed year — so the tutor sees the whole
  // library first; a year is only ever picked deliberately (pill, student lens, or a search hit) and isn't restored next visit.
  const [yearPick, setYearPick] = useState<number | null>(null);
  // Derived from the hub's own roster (no separate fetch): a tutor's map needs each active student's school
  // year (to pick the default year) and calm setting; a family's "roster" is just their own children.
  const students = useMemo<PickStudent[]>(() => (studentsProp ?? []).filter((s) => s.active !== false).map((s) => ({ id: s.childId, name: s.childName, yearText: s.yearGroup ?? null, year: parseYear(s.yearGroup), calm: !!s.support?.calm })), [studentsProp]);
  const [lens, setLens] = useState<string | null>(null);
  const [ov, setOv] = useState<StudentArea[] | null>(null);
  const [ovErr, setOvErr] = useState<string | null>(null);
  const [data, setData] = useState<CurriculumMap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Tap a card to open its lessons inline; tap it again (or a different card) to keep it open too — several
  // areas can be open at once, each in its own panel, and tapping a ticked card closes just that one.
  const [selected, setSelected] = useState<MapArea[]>([]);
  const toggleArea = (a: MapArea) => setSelected((cur) => (cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, a]));
  const selectedIds = useMemo(() => new Set(selected.map((a) => a.id)), [selected]);
  const mode: "tutor" | "child" = canEdit ? "tutor" : "child";

  const [fwList, setFwList] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => { setData(null); setErr(null); setSelected([]); }, [qs]); // a different child / provider: never show the previous one's grid
  const load = useCallback(() => {
    let live = true;
    getMap(qs, fw).then((d) => { if (live) { setData(d); setFwList(d.frameworks); setErr(null); } }).catch((e) => { if (live) setErr(errMsg(e, "Couldn't load the curriculum map")); });
    return () => { live = false; };
  }, [qs, fw]);
  useEffect(() => load(), [load]);

  // The students' school years pick the year the map opens on; a child's own year + calm setting come from the same roster (a parent's list is just their own children).
  useEffect(() => { setLens(null); }, [qs]);
  const wantChild = new URLSearchParams(qs.split("?")[1] ?? "").get("childId");
  const me = mode === "child" ? students.find((x) => x.id === wantChild) ?? students[0] ?? null : null;

  const groups = useMemo(() => GROUP_ORDER.filter((g) => data?.areas.some((a) => a.group === g && (a.y.some((n) => n > 0) || data.rows.some((r) => r.areaId === a.id)))), [data]);
  const g = group && groups.includes(group as never) ? group : groups[0] ?? null;
  const byArea = useMemo(() => rowsByArea(data?.rows ?? []), [data]);
  const inGroup = useMemo(() => (data?.areas ?? []).filter((a) => a.group === g), [data, g]);
  const yearList = useMemo(() => yearsWithContent(inGroup, byArea), [inGroup, byArea]);
  const picked = yearPick && yearList.includes(yearPick) ? yearPick : null;
  const allYears = mode === "tutor" && picked === null && yearList.length > 0; // the tutor's landing view: every year at once
  const yr = allYears ? null : picked ?? defaultYear(yearList, (students ?? []).map((x) => x.year), inGroup);
  const yItems = useMemo<YearItem[]>(() => {
    // All years: every area that holds lessons, with its total across the years (the drawer already lists them by year).
    if (allYears) return inGroup.map((a) => { const n = a.y.reduce((s, x) => s + x, 0), d = (a.done ?? []).reduce((s, x) => s + x, 0); return { area: a, cell: { kind: "extra" as const, count: n, done: d, span: null }, count: n }; }).filter((i) => i.count > 0);
    if (yr === null) return [];
    const ex = expectedInYear(inGroup, yr, byArea);
    // A subject with no checklist (languages): list the areas that hold lessons this year, neutrally.
    return ex.length || inGroup.some((a) => (byArea.get(a.id) ?? []).length) ? ex : inGroup.filter((a) => (a.y[yr - 1] ?? 0) > 0).map((a) => ({ area: a, cell: cellKind("tutor", a, yr, byArea), count: a.y[yr - 1] ?? 0 }));
  }, [inGroup, byArea, yr, allYears]);
  const yExtra = useMemo(() => (yr === null ? 0 : extraInYear(inGroup, yr, byArea)), [inGroup, byArea, yr]);
  const yShown = yItems;
  const kidYear = (() => { const y = me?.year ?? null; return y && yearList.includes(y) && expectedInYear(inGroup, y, byArea).length ? y : defaultYear(yearList, [], inGroup); })() ?? 0;
  const kidBand = bandOrDefault(me?.yearText);
  const kidItems = useMemo<YearItem[]>(() => (kidYear ? expectedInYear(inGroup, kidYear, byArea) : []), [inGroup, byArea, kidYear]);
  const kidGot = kidItems.filter((i) => stickerDone(i.area, kidYear, byArea) > 0).length;
  const kidStars = stickerStars(kidGot, kidItems.length);
  // Student lens: that student's state for each area of the year on show.
  useEffect(() => {
    if (!lens || yr === null || mode !== "tutor") return;
    let live = true;
    setOv(null); setOvErr(null);
    getStudentYear(qs, fw, lens, yr).then((d) => { if (live) setOv(d.areas); }).catch((e) => { if (live) setOvErr(errMsg(e, "Couldn't load this student")); });
    return () => { live = false; };
  }, [lens, yr, qs, fw, mode, data]);
  const pickLens = (id: string | null) => { setLens(id); const y = students?.find((x) => x.id === id)?.year; if (y && yearList.includes(y)) pickYear(y); };
  const [strandPick, setStrandPick] = useState<string | null>(null);
  const [areaQuery, setAreaQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // A lesson's own title (e.g. "ionic and covalent bonding") often has nothing in common with the curriculum
  // area name it's placed in (e.g. "Bonding, structure and the properties of matter") — so alongside the plain
  // area-name match below, also ask the server which areas hold a MATCHING LESSON (debounced; a real query,
  // not a client-side filter, since lesson titles/bodies aren't part of the map payload).
  const [lessonMatchIds, setLessonMatchIds] = useState<Set<string> | null>(null);
  // Lessons matching the search text that exist but aren't placed on the map yet — `lessonMatchIds` alone can
  // never find these (the map has nowhere to put them), so without this a real lesson search silently dead-ends.
  const [unplacedMatches, setUnplacedMatches] = useState<{ id: string; title: string }[]>([]);
  // A match that IS placed, but under a year other than the one currently selected, is just as invisible —
  // the year filter drops its area from the grid before the highlight ever applies (real bug hit in
  // production: searching found nothing because the lesson was tagged Year 6 while Year 9 was selected).
  const [otherYearMatches, setOtherYearMatches] = useState<{ areaId: string; year: number; title: string }[]>([]);
  // Every PLACED lesson the search found (any year). When there are some, the page shows those lesson cards directly
  // instead of making the tutor find + click the area tile they sit under.
  const [placedMatches, setPlacedMatches] = useState<{ areaId: string; year: number; title: string }[]>([]);
  useEffect(() => {
    const q = areaQuery.trim();
    if (q.length < 3) { setLessonMatchIds(null); setUnplacedMatches([]); setOtherYearMatches([]); setPlacedMatches([]); return; }
    let live = true;
    const t = setTimeout(() => {
      searchAreasByLesson(qs, fw, q).then((r) => {
        if (!live) return;
        setLessonMatchIds(new Set(r.areaIds));
        setUnplacedMatches(r.unplaced);
        setOtherYearMatches(r.placed.filter((m) => yr !== null && m.year !== yr));
        setPlacedMatches(r.placed);
      }).catch(() => { if (live) { setLessonMatchIds(new Set()); setUnplacedMatches([]); setOtherYearMatches([]); setPlacedMatches([]); } });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [areaQuery, qs, fw, yr]);
  const lessonView = mode === "tutor" && areaQuery.trim().length >= 3 && placedMatches.length > 0;
  const strandList = useMemo(() => byStrand(yShown.map((i) => i.area)).map(([x]) => x).filter((x, i, a) => a.indexOf(x) === i), [yShown]);
  const tileItems = useMemo(() => {
    const order = new Map(strandList.map((x, i) => [x, i]));
    const q = areaQuery.trim().toLowerCase();
    const matches = (a: MapArea) => !q || a.area.toLowerCase().includes(q) || !!lessonMatchIds?.has(a.id);
    // A search looks across every strand: a leftover strand chip must never hide a lesson the tutor is typing the name of.
    return yShown.filter((i) => (!strandPick || !!q || i.area.strand === strandPick) && matches(i.area))
      .sort((a, b) => (order.get(a.area.strand) ?? 0) - (order.get(b.area.strand) ?? 0) || a.area.area.localeCompare(b.area.area));
  }, [yShown, strandPick, strandList, areaQuery, lessonMatchIds]);
  const pickYear = (y: number | null) => { setYearPick(y); setSelected([]); };
  const pickStrand = (s: string | null) => { setStrandPick(s); setSelected([]); };
  const sum = useMemo(() => summarise(data?.rows ?? [], new Set(inGroup.map((a) => a.id))), [data, inGroup]);
  /** The curriculum gives this subject no checklist of areas (e.g. languages), so there is no honest "% covered" — show the lessons placed instead. */
  const noList = mode === "tutor" && (sum.checked === 0 || allYears);

  const all = useMemo(() => childSummary(data?.areas ?? [], data?.rows ?? []), [data]);
  const starsOn = all.expected > 0 ? Math.round((5 * all.touched) / all.expected) : 0;
  const title = mode === "tutor" ? "Where our lessons fit the curriculum" : "What I’ve covered";
  const pickFw = (id: string) => { setFw(id); setData(null); setSelected([]); writePref({ fw: id }); };

  return (
    <section aria-label="Curriculum map" data-testid="curriculum-card" className="mb-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}><Icon name="layers" size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</span>
          {mode === "child" ? (
            <span className="flex items-center gap-0.5 text-[20px] leading-none" role="img" aria-label={data ? `${starsOn} out of 5 stars` : "Loading"} data-testid="curriculum-stars">
              {[0, 1, 2, 3, 4].map((i) => <span key={i} aria-hidden style={{ color: i < starsOn ? "var(--sem-warn)" : "var(--ink-3)" }}>{i < starsOn ? "★" : "☆"}</span>)}
            </span>
          ) : (
            <span className="line-clamp-2 block text-[12.5px] font-semibold text-[var(--ink-2)]">{data ? `${data.summary.covered} of ${data.summary.checked} curriculum areas covered · ${data.summary.thin} thin · ${data.summary.gaps} gaps` : "National curriculum & GCSE, at a glance"}</span>
          )}
        </span>
        {mode === "tutor" && mayAuthor && onNewLesson && (
          <Button variant="primary" className="!h-[40px] flex-none !px-4" onClick={onNewLesson}><Icon name="plus" size={15} /> Create new lesson</Button>
        )}
      </div>

      <div className="border-t border-[var(--line)] px-4 pb-4 pt-3">
          {/* framework switch */}
          {fwList.length > 1 && (
            <div className="mb-3 inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] p-1" role="group" aria-label="Curriculum">
              {fwList.map((f) => (
                <button key={f.id} type="button" onClick={() => pickFw(f.id)} aria-pressed={fw === f.id} className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-extrabold ${FOCUS} ${fw === f.id ? "bg-[var(--brand)] text-white shadow" : "text-[var(--ink)]"}`}>{f.label}</button>
              ))}
            </div>
          )}

          {err && <p role="alert" className="rounded-xl border border-[var(--sem-crit)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)]">{err} <button type="button" onClick={load} className="font-extrabold underline">Try again</button></p>}
          {!data && !err && <SkeletonRows rows={3} label="Loading the map" variant="card" />}

          {data && groups.length === 0 && (
            <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-5 text-center text-[14px] font-semibold text-[var(--ink-2)]">{mode === "child" ? "Nothing to show yet — once your tutor gives you a lesson, it will appear here on the curriculum." : "No lessons are placed on this curriculum yet."}</p>
          )}

          {data && groups.length > 0 && g && (
            <>
              {/* subject tabs */}
              <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Subject"
                onKeyDown={(e) => {
                  const i = groups.indexOf(g as never);
                  const n = e.key === "ArrowRight" ? (i + 1) % groups.length : e.key === "ArrowLeft" ? (i - 1 + groups.length) % groups.length : e.key === "Home" ? 0 : e.key === "End" ? groups.length - 1 : -1;
                  if (n < 0) return;
                  e.preventDefault(); setGroup(groups[n]); writePref({ group: groups[n] });
                  requestAnimationFrame(() => document.getElementById(`hub-cur-tab-${groups[n]}`)?.focus());
                }}>
                {groups.map((x) => (
                  <button key={x} type="button" role="tab" id={`hub-cur-tab-${x}`} aria-selected={g === x} aria-controls={g === x ? "hub-cur-panel" : undefined} tabIndex={g === x ? 0 : -1} onClick={() => { setGroup(x); writePref({ group: x }); setSelected([]); }} className={`min-h-[40px] rounded-full border px-4 text-[13.5px] font-extrabold ${FOCUS} ${g === x ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{GROUP_LABEL[x]}</button>
                ))}
              </div>

              <div role="tabpanel" id="hub-cur-panel" aria-labelledby={`hub-cur-tab-${g}`}>
              {mode === "child" ? (
                <>
                  <ChildBook items={kidItems} year={kidYear} name={me?.name ?? ""} band={kidBand} stars={kidStars} calm={!!me?.calm} onPick={toggleArea} />
                  {selected.map((a) => (
                    <div key={a.id} className="mt-2.5">
                      <AreaDrawer qs={qs} framework={data.framework.id} area={a} areas={data.areas} mode={mode} canCorrect={mayAuthor} inline onClose={() => toggleArea(a)}
                        onOpenLesson={(id) => { toggleArea(a); onOpenLesson(id); }} onChanged={load} />
                    </div>
                  ))}
                </>
              ) : (<>
              <div className="mb-3 flex flex-wrap items-center gap-4">
                {students && students.length > 0 && <div className="flex-none"><StudentPills students={students} value={lens} onPick={pickLens} /></div>}
                {yearList.length > 0 && <div className="min-w-0 flex-1"><YearPills years={yearList} value={yr} onPick={pickYear} /></div>}
              </div>

              {/* Always available, not just past a tile-count threshold — this is also the only way to find a
                  lesson that exists but isn't placed on the map yet (see unplacedMatches below), regardless of
                  how few areas this subject/year has. */}
              <div className="relative mb-2.5 max-w-[320px]">
                <input ref={searchRef} type="search" value={areaQuery} onChange={(e) => setAreaQuery(e.target.value)} placeholder="Search areas or lessons… (e.g. bonding, fractions)" aria-label="Search lessons or curriculum areas"
                  className={`min-h-[42px] w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13.5px] font-semibold text-[var(--ink)] ${FOCUS}`} />
              </div>
              <StrandChips strands={strandList} value={strandPick && strandList.includes(strandPick) ? strandPick : null} onPick={pickStrand} />
              {lessonView ? (
                // The search found actual lessons: show their cards straight away (only the matches), grouped by the area they sit in.
                [...new Set(placedMatches.map((m) => m.areaId))].slice(0, 3).map((areaId) => { const a = data.areas.find((x) => x.id === areaId); return a ? (
                  <div key={areaId} className="mt-1" data-testid="curriculum-search-lessons">
                    <AreaDrawer qs={qs} framework={data.framework.id} area={a} areas={data.areas} mode={mode} canCorrect={mayAuthor} inline highlight={areaQuery}
                      only={placedMatches.filter((m) => m.areaId === areaId).map((m) => m.title)} onClose={() => setAreaQuery("")}
                      onOpenLesson={(id) => onOpenLesson(id)} onChanged={load} />
                  </div>
                ) : null; })
              ) : (              <TutorTiles items={tileItems} year={yr} neutral={noList} extra={yExtra} lens={lens && !allYears ? { name: students?.find((x) => x.id === lens)?.name ?? "" } : null} ov={ov} error={ovErr} selectedIds={selectedIds}
                empty={areaQuery.trim() ? `No areas match “${areaQuery.trim()}”.` : allYears ? `No ${GROUP_LABEL[g]} lessons yet.` : `Nothing in ${GROUP_LABEL[g]} is expected in this year.`}
                onPick={toggleArea} onOpen={onOpenLesson} onSet={(pick) => lens && onSetHomework?.(lens, pick.id, pick.title)} onNew={onNewLesson} canNew={mayAuthor && !!onNewLesson} canSet={!!onSetHomework} />)}

              {/* A lesson search can match a real lesson that just isn't placed on the map yet, or one that's
                  placed under a different year than the one showing — surface both here rather than a
                  dead-end "no areas match", since the tile grid above has nowhere to show either case. */}
              {areaQuery.trim().length >= 3 && otherYearMatches.length > 0 && (
                <div className="mt-2.5 rounded-2xl border border-dashed border-[var(--line)] p-3">
                  <p className="m-0 mb-1.5 text-[12px] font-extrabold text-[var(--ink-2)]">Found, but in a different year:</p>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {otherYearMatches.map((m) => (
                      <li key={`${m.areaId}-${m.year}`}>
                        <button type="button" onClick={() => pickYear(m.year)} className={`text-left text-[13px] font-bold text-[var(--brand)] underline underline-offset-2 ${FOCUS}`}>{m.title} — Year {m.year}, switch to see it</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {areaQuery.trim().length >= 3 && unplacedMatches.length > 0 && (
                <div className="mt-2.5 rounded-2xl border border-dashed border-[var(--line)] p-3">
                  <p className="m-0 mb-1.5 text-[12px] font-extrabold text-[var(--ink-2)]">Found, but not yet placed on the map:</p>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {unplacedMatches.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => onOpenLesson(m.id)} className={`text-left text-[13px] font-bold text-[var(--brand)] underline underline-offset-2 ${FOCUS}`}>{m.title}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clicking a tile shows its lessons right here, in the page — no popup over the grid. Tap a ticked
                  card again (or its own panel's close button) to close just that one; several can stay open. */}
              {selected.map((a) => (
                <div key={a.id} className="mt-2.5">
                  <AreaDrawer qs={qs} framework={data.framework.id} area={a} areas={data.areas} mode={mode} canCorrect={mayAuthor} inline highlight={areaQuery} onClose={() => toggleArea(a)}
                    onOpenLesson={(id) => { toggleArea(a); onOpenLesson(id); }} onChanged={load} />
                </div>
              ))}

              {mode === "tutor" && data.unplaced > 0 && (
                <p className="m-0 mt-3 text-[11.5px] font-semibold leading-snug text-[var(--ink-3)]">
                  {data.unplaced} of your lessons aren’t on this map yet.{" "}
                  <button type="button" onClick={() => searchRef.current?.focus()} className={`ml-1 font-extrabold text-[var(--brand)] underline underline-offset-2 ${FOCUS}`}>Search for one</button>
                </p>
              )}
              </>)}
              </div>
            </>
          )}
      </div>
    </section>
  );
}

/** "Geometry – position and direction" reads as "Position and direction" under its strand header. */
const shortArea = (area: string) => { const t = area.includes(" – ") ? area.split(" – ").slice(1).join(" – ") : area; return t.charAt(0).toUpperCase() + t.slice(1); };


/** Y1…Y11 pills (a tablist): scroll sideways at phone width with an edge fade; each is a 44px target. */
function YearPills({ years, value, onPick }: { years: number[]; value: number | null; onPick: (y: number | null) => void }) {
  // The row scrolls sideways (many years, e.g. Y1–13), but nothing scrolled the SELECTED year into
  // view when it changed from elsewhere (a framework/subject switch can pick a year that's off-screen
  // in the current scroll position) — so it looked like the pills just "stopped at Y8" (P-31).
  useEffect(() => { document.getElementById(`hub-cur-year-${value ?? "all"}`)?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [value]);
  return (
    <div className="relative mb-2">
      <div role="tablist" aria-label="Year" data-testid="curriculum-years" className="flex gap-1.5 overflow-x-auto pb-1 pr-8 [scrollbar-width:none]"
        onKeyDown={(e) => {
          const opts: (number | null)[] = [null, ...years];
          const i = opts.indexOf(value);
          const n = e.key === "ArrowRight" ? (i + 1) % opts.length : e.key === "ArrowLeft" ? (i - 1 + opts.length) % opts.length : e.key === "Home" ? 0 : e.key === "End" ? opts.length - 1 : -1;
          if (n < 0) return;
          e.preventDefault(); onPick(opts[n]!);
          requestAnimationFrame(() => document.getElementById(`hub-cur-year-${opts[n] ?? "all"}`)?.focus());
        }}>
        <button type="button" role="tab" id="hub-cur-year-all" aria-selected={value === null} aria-label="All years" tabIndex={value === null ? 0 : -1} onClick={() => onPick(null)} data-testid="curriculum-year-all"
          className={`min-h-[44px] flex-none rounded-full border px-3.5 text-[14px] font-extrabold ${FOCUS} ${value === null ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>All years</button>
        {years.map((y) => (
          <button key={y} type="button" role="tab" id={`hub-cur-year-${y}`} aria-selected={value === y} aria-label={`Year ${y}`} tabIndex={value === y ? 0 : -1} onClick={() => onPick(y)}
            className={`min-h-[44px] min-w-[48px] flex-none rounded-full border px-3.5 text-[14px] font-extrabold ${FOCUS} ${value === y ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>Y{y}</button>
        ))}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--surface)] to-transparent" />
    </div>
  );
}

interface PickStudent { id: string; name: string; yearText: string | null; year: number | null; calm: boolean }

/** "Everyone" (the year-first view) or one of the tutor's own students: their year's areas become a checklist.
 *  A dropdown, not a pill row — a class of 15+ students used to crowd out the Year pills next to it (P-24). */
function StudentPills({ students, value, onPick }: { students: PickStudent[]; value: string | null; onPick: (id: string | null) => void }) {
  return (
    <div className="mb-2" data-testid="curriculum-students">
      <select aria-label="Whose curriculum" value={value ?? ""} onChange={(e) => onPick(e.target.value || null)}
        className={`min-h-[44px] w-full max-w-[220px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[13.5px] font-extrabold text-[var(--ink)] ${FOCUS}`}>
        <option value="">Everyone</option>
        {students.map((x) => <option key={x.id} value={x.id}>{x.name}{x.year ? ` · Y${x.year}` : ""}</option>)}
      </select>
    </div>
  );
}

type TileKind = "got" | "next" | "covered" | "thin" | "gap" | "neutral";
const TILE_LOOK: Record<TileKind, { border: string; bg: string; cue: string; cueVar: string }> = {
  got: { border: "3px solid var(--sem-ok)", bg: TINT("--sem-ok", 18), cue: "✓", cueVar: "var(--sem-ok)" },
  next: { border: "3px dashed var(--line)", bg: "var(--panel)", cue: "", cueVar: "var(--ink-3)" },
  covered: { border: "3px solid var(--sem-ok)", bg: TINT("--sem-ok", 22), cue: "✓", cueVar: "var(--sem-ok)" },
  thin: { border: "3px dashed var(--sem-warn)", bg: TINT("--sem-warn", 18), cue: "!", cueVar: "var(--sem-warn)" },
  gap: { border: "3px dashed var(--sem-crit)", bg: `repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--sem-crit) 22%, transparent) 6px 8px), ${TINT("--sem-crit", 10)}`, cue: "＋", cueVar: "var(--sem-crit)" },
  neutral: { border: "3px solid var(--brand-2)", bg: TINT("--brand-2", 12), cue: "", cueVar: "var(--brand-2)" },
};
// Status still reads from the word ("covered"/"thin"/"gap ＋"), coloured to match — but the card's
// identity colour (its 4px top rule) is the NC STRAND, stable per strand, not the coverage amount.
const STATUS_COLOR: Record<TileKind, string> = {
  covered: "var(--sem-ok)", thin: "var(--sem-warn)", gap: "var(--sem-crit)",
  neutral: "var(--brand-2)", got: "var(--sem-ok)", next: "var(--ink-3)",
};
/** ONE sticker tile, shared by the child's sticker book (no number) and the provider's map (lesson count inside). Status is the border style + a corner glyph + a word, never colour alone. */
function Tile({ area, kind, count, word, sub, badge, label, selected, onClick }: { area: MapArea; kind: TileKind; count?: number; word: string; sub?: string; badge?: string; label: string; selected?: boolean; onClick: () => void }) {
  const dim = kind === "next", emoji = emojiFor(area.area, area.strand);
  if (count === undefined) { // child sticker: big picture, centred — unchanged, still status-coloured (not area-coloured)
    const l = TILE_LOOK[kind];
    return (
      <button type="button" onClick={onClick} aria-label={label} data-sticker={kind === "got" || kind === "next" ? kind : undefined} data-tile={kind} data-area={area.id}
        className={`grid min-h-[120px] w-full place-content-center place-items-center gap-0.5 rounded-[22px] px-2 py-3 text-center ${FOCUS}`} style={{ border: l.border, background: l.bg }}>
        <span aria-hidden className="text-[44px] leading-none" style={dim ? { filter: "grayscale(1)", opacity: 0.35 } : undefined}>{emoji}</span>
        <span className="text-[14px] font-extrabold leading-tight text-[var(--ink)]">{shortArea(area.area)}</span>
        <span className="text-[12.5px] font-bold text-[var(--ink-2)]">{word}</span>
      </button>
    );
  }
  // provider tile: a restrained "stat block" — white card, hairline border, a 4px top rule carrying
  // the STRAND's colour (stable per strand, e.g. every "Writing" card matches). The status word carries
  // its own colour (green/amber/red) so coverage is still legible without a rainbow of border colours.
  const rule = strandColor(area);
  const statusColor = STATUS_COLOR[kind];
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={selected} title={sub ? `${shortArea(area.area)} · ${sub}` : undefined} data-tile={kind} data-area={area.id} data-count={count} data-selected={selected ? "1" : undefined}
      className={`relative grid h-[148px] w-full content-between gap-1.5 overflow-hidden rounded-[10px] border bg-[var(--surface)] px-3.5 pb-3 pt-3 text-left ${FOCUS} ${selected ? "border-[var(--brand)] ring-2 ring-[var(--brand)] ring-offset-1 ring-offset-[var(--panel)]" : "border-[var(--line)]"}`} style={{ borderTop: `4px solid ${rule}` }}>
      {selected && <span aria-hidden className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand)] text-[11px] font-extrabold text-[var(--on-brand,#fff)]">✓</span>}
      <span className="min-w-0 truncate text-[10px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{area.strand}</span>
      <span className="line-clamp-2 text-[13px] font-extrabold leading-tight text-[var(--ink)]">{shortArea(area.area)}</span>
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[26px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }} aria-hidden>{count}</span>
          {sub && <span className="truncate text-[10.5px] font-bold text-[var(--ink-3)]">{sub}</span>}
        </span>
        <span className="flex-none text-[11px] font-extrabold" style={{ color: statusColor }}>{word}{badge ? ` · ${badge}` : ""}</span>
      </span>
    </button>
  );
}
const TILE_GRID = "m-0 grid list-none gap-2.5 p-0 [grid-template-columns:repeat(auto-fill,minmax(148px,1fr))]";
const KIND_WORD: Record<string, string> = { covered: "covered", thin: "thin", gap: "gap ＋" };
const BADGE: Record<string, string> = { done: "Done ✓", assigned: "Assigned", ready: "Ready" };

/** Compact strand filter (All · Number · Algebra …) instead of headings that break the tile flow. */
function StrandChips({ strands, value, onPick }: { strands: string[]; value: string | null; onPick: (s: string | null) => void }) {
  if (strands.length < 2) return null;
  const base = "min-h-[36px] flex-none rounded-full border-2 px-3 text-[12.5px] font-extrabold";
  return (
    <div role="group" aria-label="Strand" data-testid="curriculum-strands" className="mb-2.5 flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className={`${base} ${FOCUS} ${value === null ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>All</button>
      {/* Every strand keeps its own colour whether picked or not — an unpicked chip is that colour outlined on white, picked is that colour filled — so no two ever read as "just grey". */}
      {strands.map((x) => {
        const c = strandColor({ strand: x, area: x });
        return (
          <button key={x} type="button" aria-pressed={value === x} onClick={() => onPick(x)} className={`${base} ${FOCUS}`}
            style={value === x ? { borderColor: c, background: c, color: "#fff" } : { borderColor: c, background: "var(--surface)", color: c }}>{x}</button>
        );
      })}
    </div>
  );
}

/** The provider's map for one year (and optionally one student): sticker tiles for ONLY the areas the curriculum expects, lesson count inside. */
function TutorTiles({ items, year, empty, neutral, extra, lens, ov, error, selectedIds, onPick, onOpen, onSet, onNew, canNew, canSet }: {
  items: YearItem[]; year: number | null; empty: string; neutral: boolean; extra: number;
  lens: { name: string } | null; ov: StudentArea[] | null; error: string | null; selectedIds?: Set<string>;
  onPick: (a: MapArea) => void; onOpen: (id: string) => void; onSet: (p: { id: string; title: string }) => void; onNew?: () => void; canNew: boolean; canSet: boolean;
}) {
  if (lens && error) return <p role="alert" className="m-0 rounded-xl border border-[var(--sem-crit)] px-3 py-2 text-[13px] font-semibold text-[var(--ink)]">{error}</p>;
  if (lens && !ov) return <SkeletonRows rows={3} label={`Loading ${lens.name}’s year`} variant="card" />;
  const by = new Map((ov ?? []).map((o) => [o.areaId, o]));
  return (
    <div id="hub-cur-year-list" data-testid="curriculum-year-list">
      {items.length === 0 && <p className="m-0 py-6 text-center text-[14px] font-bold text-[var(--ink-2)]">{empty}</p>}
      <ul className={TILE_GRID}>
        {items.map((it) => {
          const a = it.area, k = (neutral ? "neutral" : it.cell.kind) as TileKind, n = it.count;
          const o = by.get(a.id), st = lens ? studentState(o) : null;
          const sp = it.cell.span, span = sp && sp.to > sp.from && sp.lessons !== n ? `Y${sp.from}–${sp.to}: ${sp.lessons}` : undefined;
          const word = neutral ? "placed" : KIND_WORD[k] ?? "";
          const label = `${shortArea(a.area)}, ${n} ${n === 1 ? "lesson" : "lessons"}${neutral ? "" : `, ${(KIND_WORD[k] ?? "").split(" ")[0]}`}${st ? `, ${st === "none" ? "no lesson yet" : st === "ready" ? "ready to set" : st}` : ""}`;
          const act = !lens || !st ? null : st === "done" && o?.review ? { label: "Review", run: () => onOpen(o.review!.id) } : st === "assigned" && o?.open ? { label: "View", run: () => onOpen(o.open!.id) }
            : st === "ready" && o?.next && canSet ? { label: "Set homework", run: () => onSet(o.next!) } : st === "none" && canNew ? { label: "＋ New lesson", run: () => onNew?.() } : null;
          return (
            <li key={a.id} data-state={st ?? undefined} className="grid content-start gap-1">
              <Tile area={a} kind={k} count={n} word={word} sub={span} badge={st ? (st === "none" ? undefined : BADGE[st]) : undefined} label={label} selected={!!selectedIds?.has(a.id)} onClick={() => onPick(a)} />
              {act && <button type="button" onClick={act.run} className={`min-h-[44px] rounded-full border border-[var(--brand)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] ${FOCUS}`}>{act.label}<span className="sr-only"> for {shortArea(a.area)}</span></button>}
            </li>
          );
        })}
      </ul>
      {extra > 0 && year !== null && <p className="m-0 mt-1 text-[12px] font-semibold text-[var(--ink-3)]" data-testid="curriculum-extra">Also in this year: {extra} extra {extra === 1 ? "lesson" : "lessons"} on topics beyond the curriculum for Year {year}.</p>}
    </div>
  );
}

/** The child's view of the map: their own year only. KS1/KS2 = a sticker book (no scores, no "gaps"); Year 7+ = a plain checklist. */
function ChildBook({ items, year, name, band, stars, calm, onPick }: { items: YearItem[]; year: number; name: string; band: string; stars: number; calm: boolean; onPick: (a: MapArea) => void }) {
  const teen = band === "ks3" || band === "teen";
  const got = (i: YearItem) => { const sp = i.cell.span; let n = 0; for (let y = sp?.from ?? year; y <= (sp?.to ?? year); y++) n += i.area.done?.[y - 1] ?? 0; return n > 0; };
  if (!year || items.length === 0) return <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] p-5 text-center text-[14px] font-semibold text-[var(--ink-2)]">{STICKER_COPY.empty}</p>;
  if (teen) {
    return (
      <div data-testid="curriculum-progress-list" data-band={band}>
        <h3 className="m-0 mb-2 text-[16px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{STICKER_COPY.teenTitle}</h3>
        {byStrand(items.map((i) => i.area)).map(([strand, list]) => (
          <section key={strand} aria-label={strand} className="mb-3">
            <h4 className="m-0 mb-1 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{strand}</h4>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {list.map((a) => { const it = items.find((i) => i.area.id === a.id)!, d = got(it); return (
                <li key={a.id}><button type="button" onClick={() => onPick(a)} data-done={d ? "1" : "0"} className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left ${FOCUS}`}>
                  <span className="text-[14px] font-bold text-[var(--ink)]">{shortArea(a.area)}</span>
                  <span className="text-[13px] font-bold text-[var(--ink-2)]">{d ? `✓ ${STICKER_COPY.teenDone}` : STICKER_COPY.teenNotYet}</span></button></li>
              ); })}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div data-testid="curriculum-sticker-book" data-band={band} data-calm={calm ? "1" : undefined}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--panel)] p-3.5">
        <div><h3 className="m-0 text-[18px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{name ? STICKER_COPY.title(name, year) : STICKER_COPY.titleNoName(year)}</h3><p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">{STICKER_COPY.intro}</p></div>
        <span className="text-[24px] leading-none" role="img" aria-label={STICKER_COPY.stars(stars)} data-testid="curriculum-book-stars">{[0, 1, 2, 3, 4].map((i) => <span key={i} aria-hidden style={{ color: i < stars ? "var(--sem-warn)" : "var(--ink-3)" }}>{i < stars ? "★" : "☆"}</span>)}</span>
      </div>
      <ul className={TILE_GRID}>
        {items.map((it) => { const d = got(it); return (
          <li key={it.area.id}><Tile area={it.area} kind={d ? "got" : "next"} word={d ? `✓ ${STICKER_COPY.got}` : STICKER_COPY.next} label={`${shortArea(it.area.area)}: ${d ? STICKER_COPY.got : STICKER_COPY.next}`} onClick={() => onPick(it.area)} /></li>
        ); })}
      </ul>
    </div>
  );
}

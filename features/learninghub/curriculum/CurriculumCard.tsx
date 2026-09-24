"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get } from "@/lib/api";
import { errMsg, type Student } from "../types";
import { FOCUS, Icon, SkeletonRows } from "../kit";
import { bandOrDefault } from "../family/kidCopy";
import { getMap, getStudentYear, type CurriculumMap, type StudentArea } from "./api";
import { STICKER_COPY, emojiFor } from "./stickers";
import { AreaDrawer } from "./AreaDrawer";
import { GROUP_LABEL, GROUP_ORDER, byStrand, cellKind, childSummary, defaultYear, expectedInYear, extraInYear, parseYear, rowsByArea, stickerDone, stickerStars, studentState, summarise, yearSummary, yearsWithContent, type CellKind, type MapArea, type YearItem } from "./cells";

// "Where do these lessons fit the curriculum?" — the first line on the Lessons tab (grid closed until opened).
//  Tutor: a heat-map of every curriculum area × year, coloured by how many lessons cover it (gaps and thin spots stand out).
//  Child: the same grid recoloured by what THIS child has been given and finished.
// Tap a cell → the lessons behind it (open one; a tutor can also move a lesson that was auto-mapped wrongly).

const LS = "hub.curriculum.v2"; // v2: the grid starts closed (P-09); the summary line is what shows first
const readPref = (): { open?: boolean; fw?: string; group?: string; onlyGaps?: boolean; year?: number } => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };
const writePref = (p: object) => { try { localStorage.setItem(LS, JSON.stringify({ ...readPref(), ...p })); } catch { /* a nicety */ } };

const TINT = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${pct}%, var(--surface))`;
const KIND_STYLE: Record<CellKind, { bg: string; fg: string; ring: string }> = {
  covered: { bg: TINT("--sem-ok", 30), fg: "var(--ink)", ring: TINT("--sem-ok", 55) },
  thin: { bg: TINT("--sem-warn", 34), fg: "var(--ink)", ring: TINT("--sem-warn", 70) },
  gap: { bg: TINT("--sem-crit", 22), fg: "var(--ink)", ring: TINT("--sem-crit", 60) },
  extra: { bg: TINT("--brand-2", 14), fg: "var(--ink)", ring: TINT("--brand-2", 40) },
  na: { bg: "transparent", fg: "var(--ink-3)", ring: "var(--line)" },
  done: { bg: TINT("--sem-ok", 36), fg: "var(--ink)", ring: TINT("--sem-ok", 65) },
  assigned: { bg: TINT("--brand-2", 22), fg: "var(--ink)", ring: TINT("--brand-2", 55) },
  todo: { bg: "transparent", fg: "var(--ink-2)", ring: "var(--line)" },
};
/** Not colour alone: a gap is striped, a thin spot is dotted. */
const PATTERN: Partial<Record<CellKind, string>> = {
  gap: "repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--sem-crit) 28%, transparent) 5px 7px)",
  thin: "radial-gradient(color-mix(in srgb, var(--sem-warn) 55%, transparent) 1.2px, transparent 1.6px) 0 0 / 6px 6px",
};

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

export function CurriculumCard({ qs, canEdit, mayAuthor, onOpenLesson, onSetHomework, onNewLesson }: {
  /** The hub query string for READS ("?tenantId=…", plus &childId=… for a parent). */
  qs: string; canEdit: boolean; mayAuthor: boolean; onOpenLesson: (id: string) => void;
  /** Student lens: open the shared "set homework" flow with this student and lesson ticked. */
  onSetHomework?: (childId: string, lessonId: string, title: string) => void; onNewLesson?: () => void;
}) {
  const pref = useMemo(readPref, []);
  const [open, setOpen] = useState(pref.open === true);
  const [fw, setFw] = useState(pref.fw ?? "nc2014");
  const [group, setGroup] = useState<string | null>(pref.group ?? null);
  const [onlyGaps, setOnlyGaps] = useState(!!pref.onlyGaps);
  const [yearPick, setYearPick] = useState<number | null>(typeof pref.year === "number" ? pref.year : null);
  const [students, setStudents] = useState<PickStudent[] | null>(null);
  const [lens, setLens] = useState<string | null>(null);
  const [ov, setOv] = useState<StudentArea[] | null>(null);
  const [ovErr, setOvErr] = useState<string | null>(null);
  const [data, setData] = useState<CurriculumMap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cell, setCell] = useState<{ area: MapArea; year: number | null } | null>(null);
  const mode: "tutor" | "child" = canEdit ? "tutor" : "child";

  const [fwList, setFwList] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => { setData(null); setErr(null); setCell(null); }, [qs]); // a different child / provider: never show the previous one's grid
  const load = useCallback(() => {
    let live = true;
    getMap(qs, fw).then((d) => { if (live) { setData(d); setFwList(d.frameworks); setErr(null); } }).catch((e) => { if (live) setErr(errMsg(e, "Couldn't load the curriculum map")); });
    return () => { live = false; };
  }, [qs, fw]);
  useEffect(() => load(), [load]); // load while closed too: the summary line needs it

  // The students' school years pick the year the map opens on; a child's own year + calm setting come from the same call (a parent's list is just their own children).
  useEffect(() => {
    if (!open || students) return;
    let live = true;
    get<Student[]>(`/api/learning-hub/students${qs}`).then((l) => { if (live) setStudents(l.filter((s) => s.active !== false).map((s) => ({ id: s.childId, name: s.childName, yearText: s.yearGroup ?? null, year: parseYear(s.yearGroup), calm: !!s.support?.calm }))); }).catch(() => { if (live) setStudents([]); });
    return () => { live = false; };
  }, [open, qs, students]);
  useEffect(() => { setStudents(null); setLens(null); }, [qs]);
  const wantChild = new URLSearchParams(qs.split("?")[1] ?? "").get("childId");
  const me = mode === "child" ? students?.find((x) => x.id === wantChild) ?? students?.[0] ?? null : null;

  const groups = useMemo(() => GROUP_ORDER.filter((g) => data?.areas.some((a) => a.group === g && (a.y.some((n) => n > 0) || data.rows.some((r) => r.areaId === a.id)))), [data]);
  const g = group && groups.includes(group as never) ? group : groups[0] ?? null;
  const byArea = useMemo(() => rowsByArea(data?.rows ?? []), [data]);
  const inGroup = useMemo(() => (data?.areas ?? []).filter((a) => a.group === g), [data, g]);
  const yearList = useMemo(() => yearsWithContent(inGroup, byArea), [inGroup, byArea]);
  const yr = yearPick && yearList.includes(yearPick) ? yearPick : defaultYear(yearList, (students ?? []).map((x) => x.year), inGroup);
  const yItems = useMemo<YearItem[]>(() => {
    if (yr === null) return [];
    const ex = expectedInYear(inGroup, yr, byArea);
    // A subject with no checklist (languages): list the areas that hold lessons this year, neutrally.
    return ex.length || inGroup.some((a) => (byArea.get(a.id) ?? []).length) ? ex : inGroup.filter((a) => (a.y[yr - 1] ?? 0) > 0).map((a) => ({ area: a, cell: cellKind("tutor", a, yr, byArea), count: a.y[yr - 1] ?? 0 }));
  }, [inGroup, byArea, yr]);
  const ySum = useMemo(() => yearSummary(yItems), [yItems]);
  const yExtra = useMemo(() => (yr === null ? 0 : extraInYear(inGroup, yr, byArea)), [inGroup, byArea, yr]);
  const yShown = useMemo(() => (onlyGaps ? yItems.filter((i) => i.cell.kind === "gap" || i.cell.kind === "thin") : yItems), [yItems, onlyGaps]);
  const kidYear = (() => { const y = me?.year ?? null; return y && yearList.includes(y) && expectedInYear(inGroup, y, byArea).length ? y : defaultYear(yearList, [], inGroup); })() ?? 0;
  const kidBand = bandOrDefault(me?.yearText);
  const kidItems = useMemo<YearItem[]>(() => (kidYear ? expectedInYear(inGroup, kidYear, byArea) : []), [inGroup, byArea, kidYear]);
  const kidGot = kidItems.filter((i) => stickerDone(i.area, kidYear, byArea) > 0).length;
  const kidStars = stickerStars(kidGot, kidItems.length);
  // Student lens: that student's state for each area of the year on show.
  useEffect(() => {
    if (!lens || !open || yr === null || mode !== "tutor") return;
    let live = true;
    setOv(null); setOvErr(null);
    getStudentYear(qs, fw, lens, yr).then((d) => { if (live) setOv(d.areas); }).catch((e) => { if (live) setOvErr(errMsg(e, "Couldn't load this student")); });
    return () => { live = false; };
  }, [lens, open, yr, qs, fw, mode, data]);
  const pickLens = (id: string | null) => { setLens(id); const y = students?.find((x) => x.id === id)?.year; if (y && yearList.includes(y)) pickYear(y); };
  const [strandPick, setStrandPick] = useState<string | null>(null);
  const strandList = useMemo(() => byStrand(yShown.map((i) => i.area)).map(([x]) => x).filter((x, i, a) => a.indexOf(x) === i), [yShown]);
  const tileItems = useMemo(() => {
    const order = new Map(strandList.map((x, i) => [x, i]));
    return yShown.filter((i) => !strandPick || i.area.strand === strandPick).sort((a, b) => (order.get(a.area.strand) ?? 0) - (order.get(b.area.strand) ?? 0) || a.area.area.localeCompare(b.area.area));
  }, [yShown, strandPick, strandList]);
  const pickYear = (y: number) => { setYearPick(y); writePref({ year: y }); };
  const sum = useMemo(() => summarise(data?.rows ?? [], new Set(inGroup.map((a) => a.id))), [data, inGroup]);
  const placed = useMemo(() => inGroup.reduce((n, a) => n + a.y.reduce((x, y) => x + y, 0), 0), [inGroup]);
  /** The curriculum gives this subject no checklist of areas (e.g. languages), so there is no honest "% covered" — show the lessons placed instead. */
  const noList = mode === "tutor" && sum.checked === 0;
  const kid = useMemo(() => childSummary(inGroup, (data?.rows ?? []).filter((r) => inGroup.some((a) => a.id === r.areaId))), [data, inGroup]);
  const autoPct = data && data.lessons ? Math.round(((data.autoMapped.medium + data.autoMapped.low) / Math.max(1, data.autoMapped.high + data.autoMapped.medium + data.autoMapped.low)) * 100) : 0;

  const all = useMemo(() => childSummary(data?.areas ?? [], data?.rows ?? []), [data]);
  const starsOn = all.expected > 0 ? Math.round((5 * all.touched) / all.expected) : 0;
  const title = mode === "tutor" ? "Where our lessons fit the curriculum" : "What I’ve covered";
  const pickFw = (id: string) => { setFw(id); setData(null); setCell(null); writePref({ fw: id }); };

  return (
    <section aria-label="Curriculum map" data-testid="curriculum-card" className="mb-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <button type="button" onClick={() => { setOpen(!open); writePref({ open: !open }); }} aria-expanded={open} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${FOCUS}`}>
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
        <Icon name={open ? "chevronDown" : "chevronRight"} size={18} className="flex-none text-[var(--ink-2)]" />
      </button>

      {open && (
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
                  <button key={x} type="button" role="tab" id={`hub-cur-tab-${x}`} aria-selected={g === x} aria-controls={g === x ? "hub-cur-panel" : undefined} tabIndex={g === x ? 0 : -1} onClick={() => { setGroup(x); writePref({ group: x }); }} className={`min-h-[40px] rounded-full border px-4 text-[13.5px] font-extrabold ${FOCUS} ${g === x ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{GROUP_LABEL[x]}</button>
                ))}
              </div>

              <div role="tabpanel" id="hub-cur-panel" aria-labelledby={`hub-cur-tab-${g}`}>
              {mode === "child" ? (
                <ChildBook items={kidItems} year={kidYear} name={me?.name ?? ""} band={kidBand} stars={kidStars} calm={!!me?.calm} onPick={(a) => setCell({ area: a, year: kidYear })} />
              ) : (<>
              <div className="mb-1 flex flex-wrap items-start gap-x-4 gap-y-0">
                {students && students.length > 0 && <div className="min-w-0 flex-1 basis-[300px]"><StudentPills students={students} value={lens} onPick={pickLens} /></div>}
                {yr !== null && <div className="min-w-0 flex-1 basis-[300px]"><YearPills years={yearList} value={yr} onPick={pickYear} /></div>}
              </div>
              {/* headline */}
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-[var(--panel)] px-3.5 py-2.5">
                <Ring size={64} pct={mode === "tutor" ? ySum.pct : kid.pct} count={noList ? placed : undefined} label={noList ? "lessons placed" : mode === "tutor" ? "of areas covered" : "of the curriculum touched"} />
                <div className="grid gap-1.5">
                  {mode === "tutor" ? (
                    noList ? (
                      <>
                        <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{placed} {GROUP_LABEL[g]} lessons placed on the curriculum ({ySum.checked} topics in Year {yr})</p>
                        <p className="m-0 max-w-[46ch] text-[12.5px] font-semibold text-[var(--ink-2)]">The national curriculum doesn’t list checkable areas for {GROUP_LABEL[g].toLowerCase()}, so there’s no coverage score — pick a year to see where each lesson sits.</p>
                      </>
                    ) : <>
                      <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{ySum.covered} of {ySum.checked} areas covered in {GROUP_LABEL[g]} · Year {yr}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1"><Stat n={ySum.covered} label="covered (5+ lessons)" dot="var(--sem-ok)" /><Stat n={ySum.thin} label="thin (1–4)" dot="var(--sem-warn)" /><Stat n={ySum.gaps} label="gaps" dot="var(--sem-crit)" /></div>
                    </>
                  ) : (
                    <>
                      <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]" aria-label={`${GROUP_LABEL[g]}: ${kid.touched} of ${kid.expected} topics started`}>{GROUP_LABEL[g]}: <span aria-hidden>{[0, 1, 2, 3, 4].map((i) => (i < Math.round((5 * kid.touched) / Math.max(1, kid.expected)) ? "★" : "☆"))}</span></p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1"><Stat n={kid.done} label="lessons finished" dot="var(--sem-ok)" /><Stat n={Math.max(0, kid.total - kid.done)} label="to go" dot="var(--brand-2)" /></div>
                    </>
                  )}
                </div>
                {mode === "tutor" && (
                  <label className="ml-auto inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[13px] font-bold text-[var(--ink)]">
                    <input type="checkbox" checked={onlyGaps} onChange={(e) => { setOnlyGaps(e.target.checked); writePref({ onlyGaps: e.target.checked }); }} className="h-4 w-4 accent-[var(--brand)]" />
                    Show only gaps &amp; thin spots
                  </label>
                )}
              </div>

              <StrandChips strands={strandList} value={strandPick && strandList.includes(strandPick) ? strandPick : null} onPick={setStrandPick} />
              <TutorTiles items={tileItems} year={yr} neutral={noList} extra={yExtra} lens={lens ? { name: students?.find((x) => x.id === lens)?.name ?? "" } : null} ov={ov} error={ovErr}
                empty={onlyGaps && yItems.length > 0 ? `No gaps or thin spots in ${GROUP_LABEL[g]} · Year ${yr} 🎉` : `Nothing in ${GROUP_LABEL[g]} is expected in this year.`}
                onPick={(a) => setCell({ area: a, year: yr })} onOpen={onOpenLesson} onSet={(pick) => lens && onSetHomework?.(lens, pick.id, pick.title)} onNew={onNewLesson} canNew={mayAuthor && !!onNewLesson} canSet={!!onSetHomework} />

              {/* legend + honesty */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-[var(--ink-2)]">
                {([["covered", "5+ lessons"], ["thin", "1–4"], ["gap", "none"]] as const).map(([k, t]) => (
                  <span key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3.5 w-3.5 rounded-[5px]" style={{ background: PATTERN[k] ? `${PATTERN[k]}, ${KIND_STYLE[k].bg}` : KIND_STYLE[k].bg, boxShadow: `inset 0 0 0 1.5px ${KIND_STYLE[k].ring}` }} />{t}</span>
                ))}
              </div>
              <p className="m-0 mt-2 text-[11.5px] font-semibold leading-snug text-[var(--ink-3)]">
                {data.framework.label} · {data.framework.version}. {mode === "tutor" && data.lessons > 0 ? `About ${autoPct}% of these placements are automatic best guesses — open an area and use “Wrong place?” to correct any. ` : ""}
                {mode === "tutor" ? "“Covered” only means lessons exist, not how deep they go." : "A lesson counts as finished once its quiz is handed in."}{mode === "tutor" && data.unplaced > 0 ? ` ${data.unplaced} of your lessons aren’t on this map yet.` : ""}
              </p>
              </>)}
              </div>
            </>
          )}
        </div>
      )}

      {cell && data && (
        <AreaDrawer qs={qs} framework={data.framework.id} area={cell.area} year={cell.year} areas={data.areas} mode={mode} canCorrect={mayAuthor} onClose={() => setCell(null)}
          onOpenLesson={(id) => { setCell(null); onOpenLesson(id); }} onChanged={load} />
      )}
    </section>
  );
}

/** "Geometry – position and direction" reads as "Position and direction" under its strand header. */
const shortArea = (area: string) => { const t = area.includes(" – ") ? area.split(" – ").slice(1).join(" – ") : area; return t.charAt(0).toUpperCase() + t.slice(1); };


/** Y1…Y11 pills (a tablist): scroll sideways at phone width with an edge fade; each is a 44px target. */
function YearPills({ years, value, onPick }: { years: number[]; value: number; onPick: (y: number) => void }) {
  return (
    <div className="relative mb-2">
      <div role="tablist" aria-label="Year" data-testid="curriculum-years" className="flex gap-1.5 overflow-x-auto pb-1 pr-8 [scrollbar-width:none]"
        onKeyDown={(e) => {
          const i = years.indexOf(value);
          const n = e.key === "ArrowRight" ? (i + 1) % years.length : e.key === "ArrowLeft" ? (i - 1 + years.length) % years.length : e.key === "Home" ? 0 : e.key === "End" ? years.length - 1 : -1;
          if (n < 0) return;
          e.preventDefault(); onPick(years[n]!);
          requestAnimationFrame(() => document.getElementById(`hub-cur-year-${years[n]}`)?.focus());
        }}>
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

/** "Everyone" (the year-first view) or one of the tutor's own students: their year's areas become a checklist. */
function StudentPills({ students, value, onPick }: { students: PickStudent[]; value: string | null; onPick: (id: string | null) => void }) {
  const chip = (on: boolean) => `min-h-[44px] flex-none rounded-full border px-3.5 text-[13.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
  return (
    <div className="relative mb-2">
      <div role="group" aria-label="Whose curriculum" data-testid="curriculum-students" className="flex gap-1.5 overflow-x-auto pb-1 pr-8 [scrollbar-width:none]">
        <button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className={chip(value === null)}>Everyone</button>
        {students.map((x) => <button key={x.id} type="button" aria-pressed={value === x.id} onClick={() => onPick(x.id)} className={chip(value === x.id)}>{x.name}{x.year ? ` · Y${x.year}` : ""}</button>)}
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--surface)] to-transparent" />
    </div>
  );
}

type TileKind = "got" | "next" | "covered" | "thin" | "gap" | "neutral";
const TILE_LOOK: Record<TileKind, { border: string; bg: string; cue: string; cueVar: string }> = {
  got: { border: "3px solid var(--sem-ok)", bg: TINT("--sem-ok", 18), cue: "✓", cueVar: "--sem-ok" },
  next: { border: "3px dashed var(--line)", bg: "var(--panel)", cue: "", cueVar: "--ink-3" },
  covered: { border: "3px solid var(--sem-ok)", bg: TINT("--sem-ok", 22), cue: "✓", cueVar: "--sem-ok" },
  thin: { border: "3px dashed var(--sem-warn)", bg: TINT("--sem-warn", 18), cue: "!", cueVar: "--sem-warn" },
  gap: { border: "3px dashed var(--sem-crit)", bg: `repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in srgb, var(--sem-crit) 22%, transparent) 6px 8px), ${TINT("--sem-crit", 10)}`, cue: "＋", cueVar: "--sem-crit" },
  neutral: { border: "3px solid var(--brand-2)", bg: TINT("--brand-2", 12), cue: "", cueVar: "--brand-2" },
};
/** ONE sticker tile, shared by the child's sticker book (no number) and the provider's map (lesson count inside). Status is the border style + a corner glyph + a word, never colour alone. */
function Tile({ area, kind, count, word, sub, badge, label, onClick }: { area: MapArea; kind: TileKind; count?: number; word: string; sub?: string; badge?: string; label: string; onClick: () => void }) {
  const l = TILE_LOOK[kind], dim = kind === "next", emoji = emojiFor(area.area, area.strand);
  if (count === undefined) { // child sticker: big picture, centred
    return (
      <button type="button" onClick={onClick} aria-label={label} data-sticker={kind === "got" || kind === "next" ? kind : undefined} data-tile={kind} data-area={area.id}
        className={`grid min-h-[120px] w-full place-content-center place-items-center gap-0.5 rounded-[22px] px-2 py-3 text-center ${FOCUS}`} style={{ border: l.border, background: l.bg }}>
        <span aria-hidden className="text-[44px] leading-none" style={dim ? { filter: "grayscale(1)", opacity: 0.35 } : undefined}>{emoji}</span>
        <span className="text-[14px] font-extrabold leading-tight text-[var(--ink)]">{shortArea(area.area)}</span>
        <span className="text-[12.5px] font-bold text-[var(--ink-2)]">{word}</span>
      </button>
    );
  }
  // provider tile: strand tag + cue on top, name, big lesson count. Left-aligned so ~120px tall packs into one wrapping grid.
  return (
    <button type="button" onClick={onClick} aria-label={label} title={sub ? `${shortArea(area.area)} · ${sub}` : undefined} data-tile={kind} data-area={area.id} data-count={count}
      className={`relative grid min-h-[112px] w-full content-between gap-1 rounded-[20px] px-3 pb-2.5 pt-2 text-left ${FOCUS}`} style={{ border: l.border, background: l.bg }}>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="text-[20px] leading-none">{emoji}</span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-[color-mix(in_srgb,var(--brand-2)_14%,transparent)] px-1.5 py-px text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-2)]">{area.strand}</span>
        {l.cue && <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-extrabold text-[var(--on-brand,#fff)]" style={{ background: `var(${l.cueVar})` }}>{l.cue}</span>}
      </span>
      <span className="line-clamp-2 text-[13px] font-extrabold leading-tight text-[var(--ink)]">{shortArea(area.area)}</span>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-[30px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }} aria-hidden>{count}</span>
        <span className="text-[11.5px] font-bold text-[var(--ink-2)]">{count === 1 ? "lesson" : "lessons"} · {word}</span>
        {sub && <span className="rounded-full border border-[var(--line)] px-1.5 text-[10.5px] font-bold text-[var(--ink-3)]">{sub}</span>}
        {badge && <span className="rounded-full bg-[var(--surface)] px-1.5 text-[10.5px] font-extrabold text-[var(--ink)] shadow-[inset_0_0_0_1px_var(--line)]">{badge}</span>}
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
  const chip = (on: boolean) => `min-h-[36px] flex-none rounded-full border px-3 text-[12.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
  return (
    <div role="group" aria-label="Strand" data-testid="curriculum-strands" className="mb-2.5 flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className={chip(value === null)}>All</button>
      {strands.map((x) => <button key={x} type="button" aria-pressed={value === x} onClick={() => onPick(x)} className={chip(value === x)}>{x}</button>)}
    </div>
  );
}

/** The provider's map for one year (and optionally one student): sticker tiles for ONLY the areas the curriculum expects, lesson count inside. */
function TutorTiles({ items, year, empty, neutral, extra, lens, ov, error, onPick, onOpen, onSet, onNew, canNew, canSet }: {
  items: YearItem[]; year: number | null; empty: string; neutral: boolean; extra: number;
  lens: { name: string } | null; ov: StudentArea[] | null; error: string | null;
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
              <Tile area={a} kind={k} count={n} word={word} sub={span} badge={st ? (st === "none" ? undefined : BADGE[st]) : undefined} label={label} onClick={() => onPick(a)} />
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

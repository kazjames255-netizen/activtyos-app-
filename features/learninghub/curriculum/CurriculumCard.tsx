"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { errMsg } from "../types";
import { FOCUS, Icon, SkeletonRows } from "../kit";
import { getMap, type CurriculumMap } from "./api";
import { AreaDrawer } from "./AreaDrawer";
import { GROUP_LABEL, GROUP_ORDER, byStrand, cellKind, cellLabel, childSummary, rowsByArea, summarise, visibleYears, type CellKind, type MapArea } from "./cells";

// "Where do these lessons fit the curriculum?" — the first thing on the Lessons tab.
//  Tutor: a heat-map of every curriculum area × year, coloured by how many lessons cover it (gaps and thin spots stand out).
//  Child: the same grid recoloured by what THIS child has been given and finished.
// Tap a cell → the lessons behind it (open one; a tutor can also move a lesson that was auto-mapped wrongly).

const LS = "hub.curriculum.v1";
const readPref = (): { open?: boolean; fw?: string; group?: string; onlyGaps?: boolean } => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };
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

function Ring({ pct, label, size = 92 }: { pct: number; label: string; size?: number }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r;
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

export function CurriculumCard({ qs, canEdit, mayAuthor, onOpenLesson }: {
  /** The hub query string for READS ("?tenantId=…", plus &childId=… for a parent). */
  qs: string; canEdit: boolean; mayAuthor: boolean; onOpenLesson: (id: string) => void;
}) {
  const pref = useMemo(readPref, []);
  const [open, setOpen] = useState(pref.open !== false);
  const [fw, setFw] = useState(pref.fw ?? "nc2014");
  const [group, setGroup] = useState<string | null>(pref.group ?? null);
  const [onlyGaps, setOnlyGaps] = useState(!!pref.onlyGaps);
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
  useEffect(() => { if (open) return load(); }, [load, open]);

  const groups = useMemo(() => GROUP_ORDER.filter((g) => data?.areas.some((a) => a.group === g && (a.y.some((n) => n > 0) || data.rows.some((r) => r.areaId === a.id)))), [data]);
  const g = group && groups.includes(group as never) ? group : groups[0] ?? null;
  const byArea = useMemo(() => rowsByArea(data?.rows ?? []), [data]);
  const inGroup = useMemo(() => (data?.areas ?? []).filter((a) => a.group === g), [data, g]);
  const years = useMemo(() => visibleYears(inGroup, byArea), [inGroup, byArea]);
  const shown = useMemo(() => (onlyGaps && mode === "tutor" ? inGroup.filter((a) => years.some((y) => { const k = cellKind(mode, a, y, byArea).kind; return k === "gap" || k === "thin"; })) : inGroup), [inGroup, onlyGaps, mode, years, byArea]);
  const sum = useMemo(() => summarise(data?.rows ?? [], new Set(inGroup.map((a) => a.id))), [data, inGroup]);
  const kid = useMemo(() => childSummary(inGroup, (data?.rows ?? []).filter((r) => inGroup.some((a) => a.id === r.areaId))), [data, inGroup]);
  const autoPct = data && data.lessons ? Math.round(((data.autoMapped.medium + data.autoMapped.low) / Math.max(1, data.autoMapped.high + data.autoMapped.medium + data.autoMapped.low)) * 100) : 0;

  const title = mode === "tutor" ? "Where our lessons fit the curriculum" : "What I’ve covered";
  const pickFw = (id: string) => { setFw(id); setData(null); setCell(null); writePref({ fw: id }); };

  return (
    <section aria-label="Curriculum map" data-testid="curriculum-card" className="mb-5 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <button type="button" onClick={() => { setOpen(!open); writePref({ open: !open }); }} aria-expanded={open} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${FOCUS}`}>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}><Icon name="layers" size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{title}</span>
          <span className="block truncate text-[12.5px] font-semibold text-[var(--ink-2)]">{data ? (mode === "tutor" ? `${data.summary.covered} of ${data.summary.checked} curriculum areas covered · ${data.summary.thin} thin · ${data.summary.gaps} gaps` : `${kid.total} ${kid.total === 1 ? "lesson" : "lessons"} given · ${kid.done} finished`) : "National curriculum & GCSE, at a glance"}</span>
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
              <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Subject">
                {groups.map((x) => (
                  <button key={x} type="button" role="tab" aria-selected={g === x} onClick={() => { setGroup(x); writePref({ group: x }); }} className={`min-h-[40px] rounded-full border px-4 text-[13.5px] font-extrabold ${FOCUS} ${g === x ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>{GROUP_LABEL[x]}</button>
                ))}
              </div>

              {/* headline */}
              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-[var(--panel)] p-3.5">
                <Ring pct={mode === "tutor" ? sum.pct : kid.pct} label={mode === "tutor" ? "of areas covered" : "of the curriculum touched"} />
                <div className="grid gap-1.5">
                  {mode === "tutor" ? (
                    <>
                      <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{sum.covered} of {sum.checked} areas covered in {GROUP_LABEL[g]}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1"><Stat n={sum.covered} label="covered (5+ lessons)" dot="var(--sem-ok)" /><Stat n={sum.thin} label="thin (1–4)" dot="var(--sem-warn)" /><Stat n={sum.gaps} label="gaps" dot="var(--sem-crit)" /></div>
                    </>
                  ) : (
                    <>
                      <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{kid.touched} of {kid.expected} topics started in {GROUP_LABEL[g]}</p>
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

              {/* grid */}
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <table className="w-full border-separate border-spacing-y-1 text-left" style={{ minWidth: 150 + years.length * 46 }}>
                  <thead>
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 bg-[var(--surface)] pr-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Topic</th>
                      {years.map((y) => <th key={y} scope="col" className="w-[42px] min-w-[42px] text-center text-[11px] font-extrabold uppercase text-[var(--ink-2)]">Y{y}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {byStrand(shown).map(([strand, list]) => (
                      <StrandBlock key={strand} strand={strand} list={list} years={years} mode={mode} byArea={byArea} onPick={(area, year) => setCell({ area, year })} />
                    ))}
                    {shown.length === 0 && <tr><td colSpan={years.length + 1} className="py-6 text-center text-[14px] font-bold text-[var(--ink-2)]">No gaps or thin spots in {GROUP_LABEL[g]} 🎉</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* legend + honesty */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-[var(--ink-2)]">
                {(mode === "tutor" ? [["covered", "5+ lessons"], ["thin", "1–4"], ["gap", "none"], ["extra", "beyond the curriculum"]] as const : [["done", "finished"], ["assigned", "given"], ["todo", "not started"]] as const).map(([k, t]) => (
                  <span key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3.5 w-3.5 rounded-[5px]" style={{ background: PATTERN[k] ? `${PATTERN[k]}, ${KIND_STYLE[k].bg}` : KIND_STYLE[k].bg, boxShadow: `inset 0 0 0 1.5px ${KIND_STYLE[k].ring}` }} />{t}</span>
                ))}
              </div>
              <p className="m-0 mt-2 text-[11.5px] font-semibold leading-snug text-[var(--ink-3)]">
                {data.framework.label} · {data.framework.version}. {mode === "tutor" && data.lessons > 0 ? `About ${autoPct}% of these placements are automatic best guesses — open a cell and use “Wrong place?” to correct any. ` : ""}
                {mode === "tutor" ? "“Covered” only means lessons exist, not how deep they go." : "A lesson counts as finished once its quiz is handed in."}{mode === "tutor" && data.unplaced > 0 ? ` ${data.unplaced} of your lessons aren’t on this map yet.` : ""}
              </p>
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

function StrandBlock({ strand, list, years, mode, byArea, onPick }: { strand: string; list: MapArea[]; years: number[]; mode: "tutor" | "child"; byArea: ReturnType<typeof rowsByArea>; onPick: (a: MapArea, y: number | null) => void }) {
  return (
    <>
      <tr><th scope="colgroup" colSpan={years.length + 1} className="pt-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-2)]">{strand}</th></tr>
      {list.map((a) => (
        <tr key={a.id}>
          <th scope="row" className="sticky left-0 z-10 w-[124px] max-w-[124px] bg-[var(--surface)] py-0.5 pr-2 text-[12.5px] font-bold leading-tight text-[var(--ink)] sm:w-[220px] sm:max-w-[220px] sm:text-[13px]">
            <button type="button" onClick={() => onPick(a, null)} className={`text-left hover:underline ${FOCUS}`}>{shortArea(a.area)}</button>
          </th>
          {years.map((y) => {
            const c = cellKind(mode, a, y, byArea), st = KIND_STYLE[c.kind];
            const shownN = mode === "child" ? (c.count ? `${c.done}/${c.count}` : "") : c.count || (c.kind === "gap" ? "0" : c.span && c.span.to > c.span.from ? "·" : "");
            return (
              <td key={y} className="p-0 text-center">
                <button type="button" disabled={c.kind === "na"} onClick={() => onPick(a, y)} aria-label={cellLabel(a, y, c, mode)} title={cellLabel(a, y, c, mode)}
                  className={`mx-auto grid h-[38px] w-[38px] place-items-center rounded-[10px] text-[12px] font-extrabold tabular-nums transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100 disabled:cursor-default disabled:hover:scale-100 ${FOCUS}`}
                  style={{ background: PATTERN[c.kind] ? `${PATTERN[c.kind]}, ${st.bg}` : st.bg, color: st.fg, boxShadow: `inset 0 0 0 1.5px ${st.ring}` }}>{c.kind === "na" ? "" : shownN}</button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

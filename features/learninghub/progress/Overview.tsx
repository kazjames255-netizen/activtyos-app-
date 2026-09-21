"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Icon } from "../kit";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { hubPath, type Mastery, type OverviewStudent } from "../shared-assess/api";
import { bandTone, timeAgo } from "../shared-assess/format";
import { useHubData } from "../shared-assess/hooks";
import { LevelLegend, LevelsModal } from "./levels";
import { ScopeToggle, useScope } from "../mineKit";
import { display, EmptyState, FOCUS, ListSkeleton, Notice, TAP } from "../shared-assess/ui";

// Tutor overview: students × subjects (× topics once a subject is chosen). Each cell
// is a band-coloured tile carrying the percentage AND the band name, so colour is
// never the only signal; a legend names the scale. The first column and the header
// row stay put while the grid scrolls, names wrap instead of truncating, and the
// "last active" time lives under the name so it can never scroll out of view.

const NAME_W = 236;
const CELL_W = 118;

interface Col { key: string; label: string; sub?: string; subject: string; topicId?: string }

export function Overview({ p, onOpen }: { p: PanelProps; onOpen: (childId: string, name: string) => void }) {
  const { data, loading, error, reload } = useHubData<{ students: OverviewStudent[] }>(hubPath(p.qs, "/mastery/overview"), ["hubMastery", "hubAttempts", "hubEnrolments"]);
  const [q, setQ] = useState("");
  const [scoredOnly, setScoredOnly] = useState(false);
  // F21: narrow the grid by school year or by group; F11: a tutor in a multi-tutor business sees their own students first.
  const [year, setYear] = useState("");
  const [groupId, setGroupId] = useState("");
  const myUid = p.me?.uid ?? null;
  const enrol = useMemo(() => new Map(p.students.map((s) => [s.childId, s])), [p.students]);
  const years = useMemo(() => [...new Set(p.students.map((s) => s.yearGroup).filter((y): y is string => !!y))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [p.students]);
  const mineCount = myUid ? p.students.filter((s) => s.tutorUid === myUid).length : 0;
  const multiTutor = !!myUid && (p.me?.role === "staff" || p.students.some((s) => s.tutorUid && s.tutorUid !== myUid));
  const [scope, setScope] = useScope(p.me?.role === "staff" && mineCount > 0 ? "mine" : "all");
  const mineOnly = multiTutor && scope === "mine";
  const group = groupId ? (p.groups ?? []).find((g) => g.id === groupId) ?? null : null;
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const bands = p.config.masteryBands;
  const subjectFilter = p.filter.subject;

  // Columns. Overall view: every subject somebody has been scored in. With a subject
  // chosen: that subject (always, even if nobody has scored yet) plus its topics.
  const cols = useMemo<Col[]>(() => {
    const out: Col[] = [];
    if (subjectFilter) {
      out.push({ key: `s:${subjectFilter}`, label: subjectFilter, sub: "Overall", subject: subjectFilter });
      const topics = p.topics.filter((t) => t.subject === subjectFilter && (!p.filter.topicId || p.covered.has(t.id)))
        .sort((a, b) => (a.topic + (a.subtopic ?? "")).localeCompare(b.topic + (b.subtopic ?? "")));
      for (const t of topics) out.push({ key: `t:${t.id}`, label: t.subtopic ? `${t.topic} › ${t.subtopic}` : t.topic, sub: "Topic", subject: subjectFilter, topicId: t.id });
      return out;
    }
    const set = new Set<string>();
    for (const s of data?.students ?? []) for (const x of s.subjects) set.add(x.subject);
    return [...set].sort((a, b) => a.localeCompare(b)).map((s) => ({ key: `s:${s}`, label: s, subject: s }));
  }, [data, subjectFilter, p.topics, p.filter.topicId, p.covered]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const known = new Map((data?.students ?? []).map((s) => [s.childId, s]));
    // Enrolled students with no attempts yet still appear (as blank rows).
    const all: OverviewStudent[] = [...known.values()];
    for (const s of p.students) if (!known.has(s.childId) && s.active !== false) all.push({ childId: s.childId, childName: s.childName, subjects: [], lastActive: null });
    const scored = (s: OverviewStudent) => (subjectFilter ? s.subjects.some((x) => x.subject === subjectFilter) : s.subjects.length > 0);
    const inGroup = group ? new Set(group.childIds) : null;
    return all.filter((s) => !needle || s.childName.toLowerCase().includes(needle)).filter((s) => !scoredOnly || scored(s))
      .filter((s) => !year || enrol.get(s.childId)?.yearGroup === year)
      .filter((s) => !inGroup || inGroup.has(s.childId))
      .filter((s) => !mineOnly || enrol.get(s.childId)?.tutorUid === myUid)
      .sort((a, b) => Number(scored(b)) - Number(scored(a)) || a.childName.localeCompare(b.childName));
  }, [data, p.students, q, subjectFilter, scoredOnly, year, group, enrol, mineOnly, myUid]);

  // Topic columns need each student's per-topic mastery (GET /mastery?childId=…), so
  // fetch it — only for students already scored in this subject, a few at a time.
  const topicCols = cols.some((c) => c.topicId);
  const wanted = useMemo(() => (topicCols ? rows.filter((s) => s.subjects.some((x) => x.subject === subjectFilter)).map((s) => s.childId) : []), [topicCols, rows, subjectFilter]);
  const wantedKey = wanted.join(",");
  const [tick, setTick] = useState(0);
  useRealtime(["hubMastery", "hubAttempts"], () => setTick((n) => n + 1));
  const [detail, setDetail] = useState<Record<string, Mastery>>({});
  const [detailBusy, setDetailBusy] = useState(false);
  const alive = useRef(0);
  useEffect(() => {
    if (!wantedKey) { setDetail({}); return; }
    const run = ++alive.current;
    const ids = wantedKey.split(",");
    setDetailBusy(true);
    (async () => {
      const acc: Record<string, Mastery> = {};
      let i = 0;
      const worker = async () => {
        while (i < ids.length && run === alive.current) {
          const id = ids[i++];
          try { acc[id] = await get<Mastery>(hubPath(p.qs, "/mastery", { childId: id })); } catch { /* a missing row just shows blank cells */ }
        }
      };
      await Promise.all(Array.from({ length: Math.min(5, ids.length) }, worker));
      if (run === alive.current) { setDetail(acc); setDetailBusy(false); }
    })();
    return () => { alive.current++; };
  }, [wantedKey, p.qs, tick]);

  const recomputeAll = async () => {
    setBusy(true);
    try { await post(hubPath(p.qs, "/mastery/recompute"), {}); setNote("Mastery recalculated for every student."); reload(); }
    catch (e) { p.onError(errMsg(e, "Couldn't recalculate")); }
    finally { setBusy(false); }
  };

  // Right-edge fade + shadow under the sticky column, shown only while there is more to scroll.
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const next = { left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 };
    setEdge((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  };
  const shape = `${rows.length}:${cols.length}:${loading}`;
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape]);

  if (loading && !data) return <ListSkeleton rows={5} label="Loading students" />;
  if (!data) return error ? <Notice action={<button type="button" onClick={reload} className="min-h-[44px] rounded-lg px-2 text-[12px] font-extrabold underline">Retry</button>}>{error}</Notice> : null;

  const scoredCount = rows.filter((s) => (subjectFilter ? s.subjects.some((x) => x.subject === subjectFilter) : s.subjects.length > 0)).length;
  const nobodyInSubject = !!subjectFilter && !rows.some((s) => s.subjects.some((x) => x.subject === subjectFilter));

  return (
    <div className="grid gap-3" data-testid="hub-overview">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1"><Input aria-label="Search students" placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} className="min-h-[44px] w-full !rounded-xl" /></div>
        {years.length > 1 && (
          <select aria-label="Filter by year group" data-testid="hub-progress-year" value={year} onChange={(e) => setYear(e.target.value)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] ${FOCUS}`}>
            <option value="">All year groups</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {(p.groups ?? []).length > 0 && (
          <select aria-label="Filter by group" data-testid="hub-progress-group" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] ${FOCUS}`}>
            <option value="">All groups</option>
            {(p.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        {multiTutor && <ScopeToggle scope={scope} onChange={setScope} mine={mineCount} all={p.students.length} what="students" />}
        {!p.readOnly && <Button variant="ghost" className={TAP} onClick={recomputeAll} disabled={busy} title="Rebuild every student's mastery from their marked attempts">{busy ? "Recalculating…" : "↻ Recalculate"}</Button>}
      </div>
      {note && <Notice tone="ok" onDismiss={() => setNote(null)}>{note}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-0.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold text-[var(--ink-3)]">
          <span><b className="tabular-nums text-[var(--ink)]">{rows.length}</b> {rows.length === 1 ? "student" : "students"} · <b className="tabular-nums text-[var(--ink)]">{scoredCount}</b> with scores{subjectFilter ? <> in <b className="text-[var(--ink)]">{subjectFilter}</b></> : null}</span>
          {(scoredOnly || rows.some((r) => !(subjectFilter ? r.subjects.some((x) => x.subject === subjectFilter) : r.subjects.length > 0))) && (
            <button type="button" role="switch" aria-checked={scoredOnly} onClick={() => setScoredOnly((v) => !v)} className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-1 text-[12px] font-bold text-[var(--ink-2)] ${FOCUS}`}>
              <span className="relative h-5 w-9 flex-none rounded-full transition-colors" style={{ background: scoredOnly ? "var(--brand)" : "var(--line)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-[var(--surface)] shadow transition-all" style={{ left: scoredOnly ? 18 : 2 }} /></span>
              Only students with scores
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3"><LevelLegend bands={bands} onEdit={p.readOnly ? undefined : () => setEditing(true)} /><NotStarted /></div>
      </div>

      {nobodyInSubject && (
        <Notice tone="info">Nobody has been scored in {subjectFilter} yet. Marked quizzes and placement tests fill these columns in as they come in.</Notice>
      )}

      {rows.length === 0 ? (
        <EmptyState icon="users" title="No students to show yet" body="Enrol students in the Teaching Hub roster, then set them a quiz. Their mastery will appear here." />
      ) : (
        <Card className="relative overflow-hidden">
          <div ref={scroller} onScroll={measure} className="max-h-[72vh] overflow-auto" tabIndex={0} aria-label="Mastery by student. Scroll for more columns.">
            <table className="border-separate border-spacing-0 text-left" style={{ minWidth: NAME_W + cols.length * CELL_W, width: "100%" }}>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-[3] w-[150px] min-w-[150px] border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)] sm:w-[236px] sm:min-w-[236px] sm:px-4" style={{ boxShadow: edge.left ? "6px 0 10px -6px rgba(16,35,86,.18)" : undefined }}>Student</th>
                  {cols.map((c) => (
                    <th key={c.key} scope="col" title={c.label} className="sticky top-0 z-[2] border-b border-[var(--line)] bg-[var(--panel)] px-2 py-2 align-bottom" style={{ width: CELL_W, minWidth: CELL_W }}>
                      <div className="line-clamp-2 text-[11.5px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]">{c.label}</div>
                      {c.sub && <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">{c.sub}</div>}
                    </th>
                  ))}
                  {cols.length === 0 && <th scope="col" className="sticky top-0 z-[2] border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[11px] font-bold text-[var(--ink-3)]">No scores yet</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((st) => (
                  <tr key={st.childId} className="group">
                    <th scope="row" className="sticky left-0 z-[1] w-[150px] min-w-[150px] border-b border-[var(--line)] bg-[var(--surface)] p-0 text-left group-hover:bg-[var(--panel)] sm:w-[236px] sm:min-w-[236px]" style={{ boxShadow: edge.left ? "6px 0 10px -6px rgba(16,35,86,.18)" : undefined }}>
                      <button type="button" onClick={() => onOpen(st.childId, st.childName)} title={st.childName} className={`flex min-h-[56px] w-full items-center gap-2.5 px-3 py-1.5 text-left sm:px-4 ${FOCUS}`} aria-label={`Open ${st.childName}'s progress`}>
                        <span className="hidden h-8 w-8 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[12px] font-extrabold text-[var(--brand-strong)] sm:grid" aria-hidden>{st.childName.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-extrabold leading-tight text-[var(--ink)] [overflow-wrap:anywhere]" style={display}>{st.childName}</span>
                          <span className="block text-[11px] font-semibold text-[var(--ink-3)]">{enrol.get(st.childId)?.active === false ? <span data-testid="hub-progress-paused">Paused{st.lastActive ? ` · active ${timeAgo(st.lastActive)}` : ""}</span> : st.lastActive ? `Active ${timeAgo(st.lastActive)}` : "Not started yet"}</span>
                        </span>
                        <Icon name="chevronRight" size={14} className="ml-auto text-[var(--ink-3)] opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    </th>
                    {cols.map((c) => {
                      let pct: number | null = null, band: string | null = null, tried = true;
                      if (c.topicId) {
                        const t = detail[st.childId]?.subjects.find((x) => x.subject === c.subject)?.topics.find((x) => x.topicId === c.topicId);
                        if (t && t.attempts > 0) { pct = t.masteryPct; band = t.band; } else tried = false;
                      } else {
                        const x = st.subjects.find((y) => y.subject === c.subject);
                        if (x && x.masteryPct != null) { pct = x.masteryPct; band = x.band; } else tried = false;
                      }
                      const loadingCell = !!c.topicId && detailBusy && !detail[st.childId] && st.subjects.some((x) => x.subject === c.subject);
                      return <td key={c.key} className="border-b border-[var(--line)] px-2 py-2 group-hover:bg-[var(--panel)]/60" style={{ width: CELL_W, minWidth: CELL_W }}><HeatCell pct={tried ? pct : null} band={band} bands={bands} loading={loadingCell} who={st.childName} what={c.label} /></td>;
                    })}
                    {cols.length === 0 && <td className="border-b border-[var(--line)] px-3 text-[12px] text-[var(--ink-3)]">·</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 transition-opacity" style={{ background: "linear-gradient(90deg, transparent, var(--surface))", opacity: edge.right ? 1 : 0 }} />
        </Card>
      )}
      {editing && <LevelsModal p={p} onClose={() => setEditing(false)} />}
      {edge.right && <p className="m-0 -mt-1 px-1 text-[11.5px] font-semibold text-[var(--ink-3)]">Scroll sideways for more {topicCols ? "topics" : "subjects"}. Student names stay in view.</p>}
    </div>
  );
}

function HeatCell({ pct, band, bands, loading, who, what }: { pct: number | null; band: string | null; bands: PanelProps["config"]["masteryBands"]; loading?: boolean; who: string; what: string }) {
  if (loading) return <div aria-hidden className="h-10 animate-pulse rounded-lg bg-[var(--line)]/60" />;
  if (pct == null) return <div className="grid h-10 place-items-center rounded-lg bg-[var(--panel)] text-[12px] text-[var(--ink-3)] opacity-70" aria-label={`${who}, ${what}: not started`}>–</div>;
  const t = bandTone(bands, band);
  return (
    <div title={`${who} · ${what}: ${Math.round(pct)}%${band ? ` ${band}` : ""}`} className="flex h-10 flex-col justify-center rounded-lg px-2.5 leading-none" style={{ background: t.soft, color: t.ink, boxShadow: `inset 3px 0 0 ${t.fill}` }}>
      <span className="text-[13.5px] font-extrabold tabular-nums">{Math.round(pct)}%</span>
      {band && <span className="mt-[3px] truncate text-[11px] font-bold opacity-85">{band}</span>}
    </div>
  );
}

function NotStarted() {
  return <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--panel)]" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} />Not started</span>;
}

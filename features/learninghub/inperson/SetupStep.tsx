"use client";

import { useEffect, useMemo, useState } from "react";
import { get } from "@/lib/api";
import { Btn, StepCard, Tag, display } from "../lesson/lessonUi";
import { GroupQuickPick, pruneGroups } from "../groupKit";
import { Segmented, Skeleton, StudentPicker, FOCUS, withQs } from "../teachKit";
import { errMsg, type HubGroup, type Note, type NoteLite, type Student } from "../types";
import type { IpSession } from "./api";

// "Teach in person": what are you teaching (an interactive lesson, or a quiz / placement test on its own) and which children are here.
// Also lists a session still open from earlier ("Resume") so a refresh or a closed tab never loses a class.

interface PaperRow { id: string; title: string; subject: string; type: "quiz" | "diagnostic"; questionCount: number }
export interface SetupChoice { noteId: string | null; assessmentId: string | null; childIds: string[]; groupIds: string[]; title: string }

function useDebounced<T>(v: T, ms = 250) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

const searchCls = `min-h-[44px] w-full rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--brand)]`;

/** A search box over a server-side search, as a radio list: pick exactly one. */
function PickList<T extends { id: string }>({ load, value, onPick, row, empty, label, id, filterKey = "" }: { filterKey?: string; load: (q: string, cursor?: string) => Promise<{ rows: T[]; next: string | null }>; value: string | null; onPick: (r: T) => void; row: (r: T) => React.ReactNode; empty: string; label: string; id: string }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [rows, setRows] = useState<T[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setErr(null);
    load(dq).then((r) => { if (live) { setRows(r.rows); setNext(r.next); } }).catch((e) => { if (live) { setRows([]); setNext(null); setErr(errMsg(e, "Couldn't load the list")); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, filterKey]);
  // The library can hold thousands: the list is a page at a time, "Show more" fetches the next one.
  const showMore = async () => {
    if (!next || more) return;
    setMore(true);
    try { const r = await load(dq, next); setRows((cur) => [...(cur ?? []), ...r.rows.filter((x) => !(cur ?? []).some((c) => c.id === x.id))]); setNext(r.next); }
    catch (e) { setErr(errMsg(e, "Couldn't load more")); }
    finally { setMore(false); }
  };
  return (
    <div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label}…`} aria-label={`Search ${label}`} id={`${id}-search`} className={searchCls} />
      {err && <p role="alert" className="mt-2 text-[13px] font-semibold text-[var(--red)]">{err}</p>}
      <div className="mt-2 max-h-[260px] overflow-y-auto rounded-xl border border-[var(--line)]" role="radiogroup" aria-label={label}>
        {rows === null ? <div className="p-3"><Skeleton className="h-10" /></div> : rows.length === 0 ? <p className="m-0 px-3 py-3 text-[13px] text-[var(--ink-3)]">{empty}</p> : rows.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={value === r.id} onClick={() => onPick(r)} data-pick={r.id}
            className={`flex min-h-[48px] w-full items-center gap-3 border-b border-[var(--line)] px-3.5 py-2 text-left last:border-b-0 ${FOCUS} ${value === r.id ? "bg-[var(--brand-soft)]" : "bg-[var(--surface)] hover:bg-[var(--panel)]"}`}>
            <span aria-hidden className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 ${value === r.id ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--line)]"}`}>{value === r.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
            <span className="min-w-0 flex-1">{row(r)}</span>
          </button>
        ))}
        {next && <button type="button" onClick={() => void showMore()} disabled={more} data-testid={`${id}-more`} className={`min-h-[48px] w-full bg-[var(--surface)] px-3.5 py-2 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--panel)] ${FOCUS}`}>{more ? "Loading…" : "Show more"}</button>}
      </div>
    </div>
  );
}

export function SetupStep({ qs, students, groups, preset, live, onStart, onResume, onCancel, busy, error }: {
  qs: string; students: Student[]; groups: HubGroup[];
  preset: { noteId?: string; assessmentId?: string; childIds?: string[]; groupIds?: string[] };
  live: IpSession[]; onStart: (c: SetupChoice) => void; onResume: (s: IpSession) => void; onCancel: () => void; busy: boolean; error: string | null;
}) {
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const [what, setWhat] = useState<"lesson" | "quiz">(preset.assessmentId && !preset.noteId ? "quiz" : "lesson");
  const [note, setNote] = useState<{ id: string; title: string } | null>(null);
  const [paper, setPaper] = useState<{ id: string; title: string } | null>(null);
  const [childIds, setChildIds] = useState<string[]>(preset.childIds ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(preset.groupIds ?? []);
  // Narrow a big library (thousands of lessons): by school year and subject — filtered on the server, the list stays a small page.
  const [year, setYear] = useState<string>("all");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    get<{ subject: string }[]>(`/api/learning-hub/topics${qs}`).then((r) => { if (live && Array.isArray(r)) setSubjects([...new Set(r.map((t) => t.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b))); }).catch(() => undefined);
    return () => { live = false; };
  }, [qs]);
  const filterKey = `${year}|${subject}`;

  // A lesson / quiz handed in by the button that opened this (the Lessons card, a quiz card): show its name straight away.
  useEffect(() => {
    if (preset.noteId) get<Note>(`/api/learning-hub/notes/${preset.noteId}${qs}`).then((n) => setNote({ id: n.id, title: n.title })).catch(() => undefined);
    if (preset.assessmentId) get<{ id: string; title: string }>(`/api/learning-hub/assessments/${preset.assessmentId}${qs}`).then((a) => setPaper({ id: a.id, title: a.title })).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLessons = async (q: string, cursor?: string) => {
    const r = await get<{ items: NoteLite[]; nextCursor?: string | null }>(`/api/learning-hub/notes${withQs(qs, { limit: "40", cursor, sort: "topic", published: "1", lessons: "1", q: q || undefined, year: year === "all" ? undefined : year, subject: subject || undefined })}`);
    return { rows: (r.items ?? []).filter((n) => n.isLesson), next: r.nextCursor ?? null };
  };
  const loadPapers = async (q: string, cursor?: string) => {
    const r = await get<{ items: PaperRow[]; nextCursor?: string | null } | PaperRow[]>(`/api/learning-hub/assessments${withQs(qs, { light: "1", published: "1", limit: "40", cursor, q: q || undefined, yearGroup: year === "all" ? undefined : `Year ${year}`, subject: subject || undefined })}`);
    return Array.isArray(r) ? { rows: r, next: null } : { rows: r.items ?? [], next: r.nextCursor ?? null };
  };

  const chosen = what === "lesson" ? note : paper;
  const ready = !!chosen && childIds.length > 0;
  const start = () => {
    if (!ready || !chosen) return;
    onStart({ noteId: what === "lesson" ? chosen.id : null, assessmentId: what === "quiz" ? chosen.id : null, childIds, groupIds, title: chosen.title });
  };

  return (
    <StepCard>
      <Tag tone="brand">Teach in person</Tag>
      <h2 className="m-0 mb-1 mt-2 text-[24px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>Run a lesson with the children beside you</h2>
      <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">No video call. You run the lesson on this device, then tap in each child&apos;s answers. Each child gets a real result their parent can see.</p>

      {live.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] p-3.5" data-testid="ip-resume">
          <div className="mb-2 text-[13.5px] font-extrabold text-[var(--ink)]">A session is still open</div>
          <ul className="m-0 grid list-none gap-2 p-0">
            {live.slice(0, 3).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-[13.5px] text-[var(--ink-2)]"><b className="text-[var(--ink)]">{s.title}</b> · {s.students.map((x) => x.childName.split(" ")[0]).slice(0, 4).join(", ")}{s.students.length > 4 ? ` +${s.students.length - 4}` : ""}</span>
                <Btn tone="ghost" className="!min-h-[44px]" onClick={() => onResume(s)} data-testid={`ip-resume-${s.id}`}>Resume</Btn>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-5" aria-labelledby="ip-what">
        <h3 id="ip-what" className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">1 · What are you teaching?</h3>
        <Segmented label="What to teach" value={what} onChange={setWhat} options={[{ v: "lesson", label: "An interactive lesson" }, { v: "quiz", label: "A quiz or placement test" }]} />
        <div className="mt-3 grid gap-2" data-testid="ip-filters">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ip-subject" className="text-[12.5px] font-bold text-[var(--ink-3)]">Subject</label>
            <select id="ip-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="min-h-[44px] rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)]">
              <option value="">All subjects</option>
              {subjects.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <Segmented label="Year" value={year} onChange={setYear} options={[{ v: "all", label: "All years" }, ...Array.from({ length: 13 }, (_, i) => ({ v: String(i + 1), label: `Year ${i + 1}` }))]} />
        </div>
        <div className="mt-3">
          {what === "lesson" ? (
            <PickList<NoteLite> key="lessons" id="ip-lesson" filterKey={filterKey} label="lessons" load={loadLessons} value={note?.id ?? null} onPick={(n) => setNote({ id: n.id, title: n.title })} empty="No interactive lessons found. Build one in the Lessons tab, or switch to a quiz."
              row={(n) => <><span className="block truncate text-[14px] font-extrabold text-[var(--ink)]">{n.title}</span><span className="block truncate text-[12px] text-[var(--ink-3)]">{n.lessonYear ? `Year ${n.lessonYear}` : "Lesson"}</span></>} />
          ) : (
            <PickList<PaperRow> key="papers" id="ip-quiz" filterKey={filterKey} label="quizzes" load={loadPapers} value={paper?.id ?? null} onPick={(p) => setPaper({ id: p.id, title: p.title })} empty="No published quizzes found."
              row={(p) => <><span className="block truncate text-[14px] font-extrabold text-[var(--ink)]">{p.title}</span><span className="block truncate text-[12px] text-[var(--ink-3)]">{p.type === "diagnostic" ? "Placement test" : "Quiz"} · {p.subject} · {p.questionCount} questions</span></>} />
          )}
          {chosen && <p className="m-0 mt-2 text-[13px] text-[var(--ink-2)]" data-testid="ip-chosen">Chosen: <b className="text-[var(--ink)]">{chosen.title}</b></p>}
        </div>
      </section>

      <section className="mt-5" aria-labelledby="ip-who">
        <h3 id="ip-who" className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">2 · Who&apos;s here?</h3>
        <div className="grid gap-3">
          <GroupQuickPick groups={groups} roster={roster} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="ip-group" />
          <StudentPicker students={roster} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, roster, ids, g)); }} idPrefix="ip-student" />
        </div>
        <p className="m-0 mt-2 text-[12.5px] text-[var(--ink-3)]">{childIds.length} {childIds.length === 1 ? "child" : "children"} here. You can change this during the lesson.</p>
      </section>

      <p className="m-0 mt-5 text-[12.5px] text-[var(--ink-3)]" data-testid="ip-portal-hint">This runs on this device only. To give the children this as homework, use Set homework from Home.</p>

      {error && <p role="alert" className="mt-4 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Btn tone="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={start} disabled={!ready || busy} data-testid="ip-start">{busy ? "Starting…" : "Start the lesson →"}</Btn>
      </div>
    </StepCard>
  );
}

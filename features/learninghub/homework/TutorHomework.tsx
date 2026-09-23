"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { del, get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { errMsg, type HubGroup } from "../types";
import { GroupChip, GroupViewChip, useGroupView } from "../groupKit";
import { isQuizHw, membersOf, relevantTo } from "../groupStatus";
import { takeHomeworkFilter, takeHubIntent } from "../hubIntent";
import { VideoChip } from "../videoKit";
import { Avatar, DISPLAY, EmptyState, FOCUS, MenuItem, MoreMenu, Overline, Pill, Segmented, Skeleton, fmtDayTime, useNow, withQs, type Tone } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { HwTile, StatusStepper } from "./hwKit";
import { HomeworkForm } from "./HomeworkForm";
import { MarkDialog } from "./MarkDialog";
import { dueState, pctOf, type InboxRow, type SubStatus, type TutorHomework as HW } from "./hwTypes";

// Tutor homework: an INBOX of hand-ins to mark, and the assignments themselves.

type Filter = SubStatus | "all";
const FILTERS: { v: Filter; label: string }[] = [
  { v: "submitted", label: "To mark" },
  { v: "marked", label: "Marked" },
  { v: "assigned", label: "Not handed in" },
  { v: "all", label: "All" },
];
const TONE_OF: Record<string, Tone> = { red: "red", gold: "gold", neutral: "neutral", green: "green", brand: "brand" };

export function TutorHomework({ qs, topics, students, config, onError, groups = [], readOnly = false }: PanelProps) {
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const [view, setView] = useState<"inbox" | "assignments">("inbox");
  const [inboxAll, setInbox] = useState<InboxRow[] | null>(null);
  const [homeworkAll, setHomework] = useState<HW[] | null>(null);
  // A group card's Homework tile lands here filtered to that group: only homework relevant to it (set for the group,
  // or set for students who are ALL in it; quizzes live under Quizzes) and only its members' hand-ins.
  const { group: viewGroup, clear: clearView } = useGroupView("homework", groups);
  const homework = useMemo(() => (viewGroup && homeworkAll ? homeworkAll.filter((h) => !isQuizHw(h) && relevantTo(viewGroup, membersOf(viewGroup), h.groupIds, h.assignedChildIds)) : homeworkAll), [homeworkAll, viewGroup]);
  const inbox = useMemo(() => {
    if (!viewGroup || !inboxAll || !homework) return inboxAll;
    const m = membersOf(viewGroup), ids = new Set(homework.map((h) => h.id));
    return inboxAll.filter((r) => ids.has(r.homeworkId) && m.has(r.childId));
  }, [inboxAll, homework, viewGroup]);
  const [filter, setFilter] = useState<Filter>("submitted");
  const [hwFilter, setHwFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<HW | "new" | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  // A group quick action from the Students tab lands here with its form open ("Set a quiz" focuses the quiz picker).
  const [preset, setPreset] = useState<{ groupId: string; quiz: boolean; assessmentId?: string; noteIds?: string[]; title?: string; instructions?: string; childIds?: string[]; packNoteId?: string } | null>(null);
  const tookIntent = useRef(false);
  // Home's "Overdue" tile asks for the not-handed-in list (consumed once).
  const requestedFilter = useRef<Filter | null>(takeHomeworkFilter());
  useEffect(() => {
    if (tookIntent.current) return;
    const i = takeHubIntent(["homework", "quiz"]);
    if (i) { tookIntent.current = true; setPreset({ groupId: i.groupId, quiz: i.kind === "quiz", assessmentId: i.assessmentId, noteIds: i.noteIds, title: i.title, instructions: i.instructions, childIds: i.childIds, packNoteId: i.packNoteId }); setEditor("new"); }
  }, []);
  const groupById = useMemo(() => new Map<string, HubGroup>(groups.map((g) => [g.id, g])), [groups]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow(60_000);
  const mounted = useRef(true);
  const autoPicked = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback(() => {
    get<InboxRow[]>(`/api/learning-hub/homework/inbox${withQs(qs, {})}`).then((r) => mounted.current && setInbox(Array.isArray(r) ? r : []))
      .catch((e) => { if (mounted.current) { setInbox((c) => c ?? []); onError(errMsg(e, "Couldn't load the homework inbox")); } });
    get<HW[]>(`/api/learning-hub/homework${withQs(qs, {})}`).then((r) => mounted.current && setHomework(Array.isArray(r) ? r : []))
      .catch((e) => { if (mounted.current) { setHomework((c) => c ?? []); onError(errMsg(e, "Couldn't load homework")); } });
  }, [qs, onError]);
  useEffect(() => { setInbox(null); setHomework(null); load(); }, [load]);
  useRealtime(["hubHomework", "hubSubmissions", "hubAttempts"], load);

  const counts = useMemo(() => {
    const c = { submitted: 0, marked: 0, assigned: 0, all: 0 };
    for (const r of inbox ?? []) if (!hwFilter || r.homeworkId === hwFilter) { c[r.status]++; c.all++; }
    return c;
  }, [inbox, hwFilter]);

  // First load: if nothing awaits marking, don't greet the tutor with an empty tab.
  useEffect(() => {
    if (!inbox || autoPicked.current) return;
    autoPicked.current = true;
    if (requestedFilter.current) { setFilter(requestedFilter.current); return; }
    if (!inbox.some((r) => r.status === "submitted")) setFilter(inbox.some((r) => r.status === "assigned") ? "assigned" : "all");
  }, [inbox]);

  const rows = useMemo(() => (inbox ?? []).filter((r) => (filter === "all" || r.status === filter) && (!hwFilter || r.homeworkId === hwFilter)), [inbox, filter, hwFilter]);
  const markingRow = marking ? (inbox ?? []).find((r) => r.submissionId === marking) ?? null : null;
  const nextRow = markingRow ? rows.filter((r) => r.status === "submitted" && r.submissionId !== markingRow.submissionId)[0] ?? null : null;
  const hwById = useMemo(() => new Map((homework ?? []).map((h) => [h.id, h])), [homework]);
  const nameOf = useMemo(() => new Map(students.map((s) => [s.childId, s.childName])), [students]);

  const removeHomework = async (h: HW) => {
    setBusy(h.id);
    try { await del(`/api/learning-hub/homework/${h.id}${withQs(qs, {})}`); if (hwFilter === h.id) setHwFilter(null); setConfirmDel(null); load(); }
    catch (e) { onError(errMsg(e, "Couldn't delete the homework")); }
    finally { setBusy(null); }
  };

  if (inbox === null || homework === null) {
    return <div className="grid gap-3" aria-busy="true" aria-label="Loading homework"><Skeleton className="h-[52px]" /><Skeleton className="h-[74px]" /><Skeleton className="h-[74px]" /><Skeleton className="h-[74px]" /></div>;
  }

  const newBtn = readOnly ? null : <Button variant="solid" id="hub-new-homework" className={`min-h-[44px] gap-2 ${FOCUS}`} onClick={() => { if (viewGroup) setPreset({ groupId: viewGroup.id, quiz: false }); setEditor("new"); }}><Ico name="plus" size={16} strokeWidth={2.4} />Set homework</Button>;
  const toMark = (inbox ?? []).filter((r) => r.status === "submitted").length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-homework">
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="homework" size={44} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Homework</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">Set practice, then mark what comes back — families are told at every step.</p>
        </div>
        {newBtn}
      </div>

      {viewGroup && <GroupViewChip group={viewGroup} what="homework" onClear={clearView} />}

      {homework.length === 0 ? (
        <EmptyState icon={<Ico name="homework" size={26} />} title={viewGroup ? `No homework set for ${viewGroup.name} yet` : "Set your first homework"}
          body={students.length ? "Write the instructions, pick a due date, optionally attach a quiz and lessons, and choose who gets it. They hand it in here and you mark it." : "Enrol a student first, then set them homework."}
          action={students.length && !readOnly ? newBtn : undefined} />
      ) : (
        <>
          <Segmented label="Homework views" value={view} onChange={setView} options={[{ v: "inbox", label: "Inbox", count: toMark }, { v: "assignments", label: "Set homework", count: homework.length }]} />

          {view === "inbox" && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter hand-ins">
                {FILTERS.map((f) => (
                  <button key={f.v} type="button" aria-pressed={filter === f.v} data-filter={f.v} onClick={() => setFilter(f.v)}
                    className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${filter === f.v ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>
                    {f.label}<span className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${filter === f.v ? "bg-white/25" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{counts[f.v]}</span>
                  </button>
                ))}
                {hwFilter && (
                  <button type="button" onClick={() => setHwFilter(null)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 text-[12px] font-bold text-[var(--brand-strong)] ${FOCUS}`}>
                    {hwById.get(hwFilter)?.title ?? "One homework"} <Ico name="close" size={13} />
                  </button>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden><Ico name={filter === "submitted" ? "check" : "inbox"} size={24} /></div>
                  <div className="mt-1 text-[14.5px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{filter === "submitted" ? "Nothing waiting to be marked" : filter === "marked" ? "Nothing marked yet" : filter === "assigned" ? "Everyone has handed in" : "No hand-ins here"}</div>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">{filter === "submitted" ? "New hand-ins appear here the moment a student submits." : "Try another filter above."}</p>
                </div>
              ) : (
                <div className="grid gap-2" id="hub-inbox">
                  {rows.map((r) => {
                    const ds = dueState(r.dueAt, r.status, now);
                    return (
                      <button key={r.submissionId} type="button" data-ui="card" data-status={r.status} data-sub={r.submissionId} onClick={() => setMarking(r.submissionId)}
                        className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-left shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS}`}>
                        <Avatar name={r.childName} size={40} tone={r.status === "submitted" ? "brand" : r.status === "marked" ? "green" : "neutral"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{r.title}</span>
                            {r.status === "submitted" && <Pill tone="brand">To mark</Pill>}
                            {r.status === "marked" && r.mark && <Pill tone="green">{r.mark.score}/{r.mark.max} · {pctOf(r.mark)}%</Pill>}
                            {r.status === "assigned" && <Pill tone={TONE_OF[ds.tone]!}>{ds.label}</Pill>}
                            {r.late && <Pill tone="red">Late</Pill>}
                            {r.attemptPending && <Pill tone="gold">Quiz needs marking</Pill>}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-3)]">
                            {r.childName} · {r.submittedAt ? `handed in ${fmtDayTime(r.submittedAt)}` : `due ${fmtDayTime(r.dueAt)}`}
                            {r.attachments.length > 0 && ` · ${r.attachments.length} file${r.attachments.length === 1 ? "" : "s"}`}{r.attemptId && " · quiz attached"}
                          </span>
                        </span>
                        <StatusStepper status={r.status} compact className="hidden w-[88px] flex-none md:flex" />
                        <span className="hidden flex-none items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--brand)] sm:inline-flex">{r.status === "marked" ? "Review" : r.status === "submitted" ? "Mark" : "Open"}<Ico name="arrowRight" size={13} /></span>
                        <Ico name="chevronRight" size={18} className="flex-none text-[var(--ink-3)] sm:hidden" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === "assignments" && (
            <div className="grid gap-2.5" id="hub-assignments">
              <Overline>{homework.length} set</Overline>
              {homework.map((h) => {
                const total = h.counts.assigned + h.counts.submitted + h.counts.marked;
                const done = h.counts.submitted + h.counts.marked;
                const overdue = new Date(h.dueAt).getTime() < now;
                const topic = h.flashcardTopicId ? topicById.get(h.flashcardTopicId) ?? null : null;
                return (
                  <div key={h.id} data-ui="card" data-hw={h.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none">
                    <div className="flex flex-wrap items-start gap-3.5">
                      <HwTile topic={topic} tone={overdue ? "neutral" : "gold"} icon={overdue ? "check" : "homework"} size={52} />
                      <div className="min-w-0 flex-1 basis-[240px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[15px] font-extrabold text-[var(--ink)]">{h.title}</span>
                          <Pill tone={overdue ? "neutral" : "gold"}>{overdue ? "Closed" : "Due"} {new Date(h.dueAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</Pill>
                          {h.assessmentId && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>Quiz</Pill>}
                          {(h.videos?.length ?? 0) > 0 && <VideoChip count={h.videos!.length} />}
                          {(h.groupIds ?? []).map((gid) => groupById.get(gid)).filter((g): g is HubGroup => !!g).map((g) => <GroupChip key={g.id} group={g} />)}
                          {h.noteIds.length > 0 && <Pill tone="brand" icon={<Ico name="notes" size={12} />}>{h.noteIds.length} note{h.noteIds.length === 1 ? "" : "s"}</Pill>}
                          {h.flashcardTopicId && <Pill tone="brand" icon={<Ico name="cards" size={12} />}>Flashcards</Pill>}
                        </div>
                        {h.instructions && <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--ink-2)]">{h.instructions}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {h.assignedChildIds.slice(0, 6).map((id) => <Pill key={id} icon={<Avatar name={nameOf.get(id) ?? "?"} size={16} />}>{nameOf.get(id) ?? "Student"}</Pill>)}
                          {h.assignedChildIds.length > 6 && <span className="text-[11.5px] text-[var(--ink-3)]">+{h.assignedChildIds.length - 6} more</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={() => { setHwFilter(h.id); setFilter("all"); setView("inbox"); }}>Hand-ins ({done}/{total})</Button>
                        {!readOnly && <button type="button" onClick={() => setEditor(h)} aria-label={`Edit ${h.title}`} title="Edit homework" className={`grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] ${FOCUS}`}><Ico name="edit" size={17} /></button>}
                        {!readOnly && <MoreMenu label={`More actions for ${h.title}`}>
                          {(close) => confirmDel === h.id ? (
                            <div className="grid gap-1 p-1">
                              <div className="px-2 pt-1 text-[12px] font-bold text-[var(--ink-2)]">Delete for everyone?</div>
                              <button type="button" disabled={busy === h.id} onClick={() => { close(); void removeHomework(h); }} className={`min-h-[44px] rounded-lg bg-[var(--red)] px-3 text-[13px] font-extrabold text-white ${FOCUS}`}>{busy === h.id ? "Deleting…" : "Delete for everyone"}</button>
                              <button type="button" onClick={() => { setConfirmDel(null); close(); }} className={`min-h-[44px] rounded-lg px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>Keep it</button>
                            </div>
                          ) : <MenuItem icon="trash" tone="danger" onClick={() => setConfirmDel(h.id)}>Delete homework…</MenuItem>}
                        </MoreMenu>}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-3.5 grid gap-2 border-t border-[var(--line)] pt-3" aria-label="Hand-in progress">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { n: h.counts.assigned, label: "Waiting", c: "var(--ink-3)" },
                            { n: h.counts.submitted, label: "To mark", c: "var(--brand-2)" },
                            { n: h.counts.marked, label: "Marked", c: "var(--green)" },
                          ].map((x) => (
                            <div key={x.label} className="rounded-xl bg-[var(--panel)] px-2 py-1.5">
                              <div className="text-[18px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: x.c }}>{x.n}</div>
                              <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{x.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]" role="img" aria-label={`${h.counts.marked} marked, ${h.counts.submitted} to mark, ${h.counts.assigned} not handed in`}>
                          <div className="flex h-full"><div className="transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${(h.counts.marked / total) * 100}%`, background: "var(--green)" }} /><div className="transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${(h.counts.submitted / total) * 100}%`, background: "var(--brand-2)" }} /></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editor && <HomeworkForm homework={editor === "new" ? null : editor} students={students} topics={topics} qs={qs} config={config} groups={groups}
        initialGroupId={editor === "new" ? preset?.groupId || null : null} initialChildIds={editor === "new" ? preset?.childIds : undefined} focusQuiz={editor === "new" && !!preset?.quiz}
        initialAssessmentId={editor === "new" ? preset?.assessmentId : undefined} initialNoteIds={editor === "new" ? preset?.noteIds : undefined} initialTitle={editor === "new" ? preset?.title : undefined} initialInstructions={editor === "new" ? preset?.instructions : undefined} packNoteId={editor === "new" ? preset?.packNoteId : undefined}
        onClose={() => { setEditor(null); setPreset(null); }} onSaved={() => { setEditor(null); setPreset(null); load(); }} />}
      {markingRow && (
        <MarkDialog key={markingRow.submissionId} row={markingRow} readOnly={readOnly} hasNext={!!nextRow} qs={qs} onClose={() => setMarking(null)}
          onMarked={(advance) => { load(); setMarking(advance && nextRow ? nextRow.submissionId : null); }} />
      )}
    </div>
  );
}

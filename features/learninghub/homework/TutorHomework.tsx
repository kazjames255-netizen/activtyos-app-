"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { del, get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { errMsg, type HubGroup } from "../types";
import { GroupChip, GroupViewChip, useGroupView } from "../groupKit";
import { isQuizHw, membersOf, relevantTo } from "../groupStatus";
import { takeHomeworkFilter, takeHubIntent, takeMarkQueue } from "../hubIntent";
import { PlanPicker } from "../plan/PlanNextWeek";
import { MarkQueue } from "../mark/MarkQueue";
import { useMarkItems } from "../mark/useMarkItems";
import { VideoChip } from "../videoKit";
import { Avatar, DISPLAY, EmptyState, FOCUS, MenuItem, MoreMenu, Overline, Pill, Segmented, Skeleton, fmtDayTime, useNow, withQs, type Tone } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { HwTile, StatusStepper } from "./hwKit";
import { HomeworkForm } from "./HomeworkForm";
import { MarkDialog } from "./MarkDialog";
import { ResultsBoard } from "./hwResults";
import { useHw } from "./hwI18n";
import { LessonPreviewDialog, LinkedRows, QuizPreviewDialog, WorksheetPreviewDialog } from "./hwPreview";
import { dueState, pctOf, type InboxRow, type SubStatus, type TutorHomework as HW } from "./hwTypes";

// Tutor homework: an INBOX of hand-ins to mark, and the assignments themselves.

type Filter = SubStatus | "all";
const FILTERS: { v: Filter; key: string }[] = [
  { v: "submitted", key: "fToMark" },
  { v: "marked", key: "fMarked" },
  { v: "assigned", key: "fNotIn" },
  { v: "all", key: "fAll" },
];
type View = "mark" | "inbox" | "assignments" | "results";
const TONE_OF: Record<string, Tone> = { red: "red", gold: "gold", neutral: "neutral", green: "green", brand: "brand" };

export function TutorHomework(p: PanelProps) {
  const x = useHw();
  const { h: tr, hp } = x;
  const { qs, topics, students, config, onError, groups = [], readOnly = false } = p;
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
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
  // R-2: the first view is the one Mark queue (all three kinds). A group card, Home's Overdue tile or an old inbox link still lands
  // on the Inbox exactly as before; Home's to-mark rows ask for the queue.
  const requestedFilter = useRef<Filter | null>(takeHomeworkFilter());
  const wantsQueue = useRef(takeMarkQueue());
  // eslint-disable-next-line react-hooks/refs -- one-shot intents read once, for the first view only
  const [view, setView] = useState<View>(() => (p.subView === "mark" || p.subView === "inbox" || p.subView === "assignments" || p.subView === "results" ? p.subView : viewGroup || (requestedFilter.current && !wantsQueue.current) ? "inbox" : "mark"));
  // Grouped tutor strip: the shell's sub-tabs (To mark / Inbox / Set homework) drive the view and this panel reports the one it is on.
  const prevSubView = useRef(p.subView);
  const groupedRef = useRef(!!p.onSubView);
  const { subView, onSubView } = p;
  useEffect(() => { if (subView && subView !== prevSubView.current) { prevSubView.current = subView; setView(subView as View); } }, [subView]);
  useEffect(() => { onSubView?.(view); }, [view, onSubView]);
  const mq = useMarkItems(qs, students);
  const [filter, setFilter] = useState<Filter>("submitted");
  const [hwFilter, setHwFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<HW | "new" | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  // A group quick action from the Students tab lands here with its form open ("Set a quiz" focuses the quiz picker).
  const [view2, setView2] = useState<{ kind: "note" | "quiz" | "worksheet"; id: string; title?: string; quizId?: string } | null>(null);
  const [preset, setPreset] = useState<{ groupId: string; quiz: boolean; assessmentId?: string; noteIds?: string[]; title?: string; instructions?: string; childIds?: string[]; packNoteId?: string } | null>(null);
  const tookIntent = useRef(false);
  // Home's "Overdue" tile asks for the not-handed-in list (consumed once).
  useEffect(() => {
    if (tookIntent.current) return;
    const i = takeHubIntent(["homework", "quiz"]);
    if (i) { tookIntent.current = true; setPreset({ groupId: i.groupId, quiz: i.kind === "quiz", assessmentId: i.assessmentId, noteIds: i.noteIds, title: i.title, instructions: i.instructions, childIds: i.childIds, packNoteId: i.packNoteId }); setEditor("new"); if (groupedRef.current) setView("assignments"); }
  }, []);
  const groupById = useMemo(() => new Map<string, HubGroup>(groups.map((g) => [g.id, g])), [groups]);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow(60_000);
  const mounted = useRef(true);
  const autoPicked = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadInbox = useCallback(() => {
    get<InboxRow[]>(`/api/learning-hub/homework/inbox${withQs(qs, {})}`).then((r) => mounted.current && setInbox(Array.isArray(r) ? r : []))
      .catch((e) => { if (mounted.current) { setInbox((c) => c ?? []); onError(errMsg(e, tr("errInbox"))); } });
  }, [qs, onError, tr]);
  const loadList = useCallback(() => {
    get<HW[]>(`/api/learning-hub/homework${withQs(qs, {})}`).then((r) => mounted.current && setHomework(Array.isArray(r) ? r : []))
      .catch((e) => { if (mounted.current) { setHomework((c) => c ?? []); onError(errMsg(e, tr("errList"))); } });
  }, [qs, onError, tr]);
  const load = useCallback(() => { loadInbox(); loadList(); }, [loadInbox, loadList]);
  useEffect(() => { setInbox(null); setHomework(null); load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);
  useRealtime(["hubHomework", "hubSubmissions"], load);
  // A child answering a quiz pings hubAttempts constantly; that only ever changes the inbox's "quiz needs marking" flag, so it
  // re-reads the inbox alone, at most every 4 seconds, and never the homework list.
  const attemptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtime(["hubAttempts"], () => { if (attemptTimer.current) return; attemptTimer.current = setTimeout(() => { attemptTimer.current = null; if (mounted.current) loadInbox(); }, 4000); });
  useEffect(() => () => { if (attemptTimer.current) clearTimeout(attemptTimer.current); }, []);

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
    catch (e) { onError(errMsg(e, tr("errDelete"))); }
    finally { setBusy(null); }
  };

  if (inbox === null || homework === null) {
    return <div className="grid gap-3" aria-busy="true" aria-label={tr("loading")}><Skeleton className="h-[52px]" /><Skeleton className="h-[74px]" /><Skeleton className="h-[74px]" /><Skeleton className="h-[74px]" /></div>;
  }

  const newBtn = readOnly ? null : <Button variant="solid" id="hub-new-homework" className={`min-h-[44px] gap-2 ${FOCUS}`} onClick={() => { if (viewGroup) setPreset({ groupId: viewGroup.id, quiz: false }); setEditor("new"); }}><Ico name="plus" size={16} strokeWidth={2.4} />{tr("setHomework")}</Button>;
  const toMark = (inbox ?? []).filter((r) => r.status === "submitted").length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-homework">
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="homework" size={44} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{tr("title")}</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{tr("subtitle")}</p>
        </div>
        {!readOnly && <PlanPicker students={students} groups={groups} qs={qs} onDone={load} />}
        {newBtn}
      </div>

      {viewGroup && <GroupViewChip group={viewGroup} what="homework" onClear={clearView} />}

      {homework.length === 0 && mq.count === 0 ? (
        <EmptyState icon={<Ico name="homework" size={26} />} title={viewGroup ? tr("emptyGroup", { name: viewGroup.name }) : view === "inbox" ? tr("emptyInboxTitle") : view === "results" ? tr("emptyResultsTitle") : tr("emptyTitle")}
          body={view === "inbox" ? tr("emptyInboxBody") : view === "results" ? tr("emptyResultsBody") : students.length ? tr("emptyBody") : tr("emptyNoStudents")}
          action={students.length && !readOnly ? newBtn : undefined} />
      ) : (
        <>
          {!p.onSubView && <Segmented label={tr("views")} value={view} onChange={setView} options={[{ v: "mark", label: tr("fToMark"), count: mq.count }, { v: "inbox", label: tr("inbox"), count: toMark }, { v: "results", label: tr("results") }, { v: "assignments", label: tr("setHomework"), count: homework.length }]} />}

          {view === "mark" && <MarkQueue p={p} q={mq} />}

          {view === "inbox" && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={tr("filterAria")}>
                {FILTERS.map((f) => (
                  <button key={f.v} type="button" aria-pressed={filter === f.v} data-filter={f.v} onClick={() => setFilter(f.v)}
                    className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${filter === f.v ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>
                    {tr(f.key)}<span className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${filter === f.v ? "bg-white/25" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>{counts[f.v]}</span>
                  </button>
                ))}
                {hwFilter && (
                  <button type="button" onClick={() => setHwFilter(null)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 text-[12px] font-bold text-[var(--brand-strong)] ${FOCUS}`}>
                    {hwById.get(hwFilter)?.title ?? tr("oneHomework")} <Ico name="close" size={13} />
                  </button>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden><Ico name={filter === "submitted" ? "check" : "inbox"} size={24} /></div>
                  <div className="mt-1 text-[14.5px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{filter === "submitted" ? tr("nothingToMark") : filter === "marked" ? tr("nothingMarked") : filter === "assigned" ? tr("allIn") : tr("noHandIns")}</div>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">{filter === "submitted" ? tr("newAppear") : tr("tryFilter")}</p>
                </div>
              ) : (
                <div className="grid gap-2" id="hub-inbox">
                  {rows.map((r) => {
                    const ds = dueState(r.dueAt, r.status, now);
                    return (
                      <button key={r.submissionId} type="button" data-ui="card" data-status={r.status} data-sub={r.submissionId} onClick={() => setMarking(r.submissionId)}
                        className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-start shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS}`}>
                        <Avatar name={r.childName} size={40} tone={r.status === "submitted" ? "brand" : r.status === "marked" ? "green" : "neutral"} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{r.title}</span>
                            {r.status === "submitted" && <Pill tone="brand">{tr("fToMark")}</Pill>}
                            {r.status === "marked" && r.mark && <Pill tone="green">{r.mark.score}/{r.mark.max} · {pctOf(r.mark)}%</Pill>}
                            {r.status === "assigned" && <Pill tone={TONE_OF[ds.tone]!}>{ds.label}</Pill>}
                            {r.late && <Pill tone="red">{tr("late")}</Pill>}
                            {r.attemptPending && <Pill tone="gold">{tr("quizNeedsMarking")}</Pill>}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-3)]">
                            {r.childName} · {r.submittedAt ? tr("handedInAt", { when: x.dayTime(r.submittedAt) }) : tr("dueAt", { when: x.dayTime(r.dueAt) })}
                            {r.attachments.length > 0 && ` · ${hp("nFiles", r.attachments.length)}`}{r.attemptId && ` · ${tr("quizAttached")}`}
                          </span>
                        </span>
                        <StatusStepper status={r.status} compact className="hidden w-[88px] flex-none md:flex" />
                        <span className="hidden flex-none items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--brand)] sm:inline-flex">{r.status === "marked" ? tr("review") : r.status === "submitted" ? tr("mark") : tr("open")}<Ico name="arrowRight" size={13} /></span>
                        <Ico name="chevronRight" size={18} className="flex-none text-[var(--ink-3)] sm:hidden" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* One place for marking AND results: everything waiting for a mark (homework hand-ins, quiz written answers, entry tests) above the markbook. */}
          {view === "results" && <div className="grid gap-4"><MarkQueue p={p} q={mq} /><ResultsBoard inbox={inbox} homework={homework} now={now} groups={groups} onOpen={setMarking} /></div>}

          {view === "assignments" && (
            <div className="grid gap-2.5" id="hub-assignments">
              <Overline>{tr("nSet", { n: homework.length })}</Overline>
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
                          <Pill tone={overdue ? "neutral" : "gold"}>{overdue ? tr("closed", { day: x.day(h.dueAt) }) : tr("dueOn", { day: x.day(h.dueAt) })}</Pill>
                          {h.assessmentId && <Pill tone="violet" icon={<Ico name="quiz" size={12} />}>{tr("quiz")}</Pill>}
                          {(h.videos?.length ?? 0) > 0 && <VideoChip count={h.videos!.length} />}
                          {(h.groupIds ?? []).map((gid) => groupById.get(gid)).filter((g): g is HubGroup => !!g).map((g) => <GroupChip key={g.id} group={g} />)}
                          {h.noteIds.length > 0 && <Pill tone="brand" icon={<Ico name="notes" size={12} />}>{hp("nNotes", h.noteIds.length)}</Pill>}
                          {(h.worksheets?.length ?? 0) > 0 && <Pill tone="brand" icon={<Ico name="file" size={12} />}>{hp("nWorksheets", h.worksheets!.length)}</Pill>}
                          {h.flashcardTopicId && <Pill tone="brand" icon={<Ico name="cards" size={12} />}>{tr("flashcards")}</Pill>}
                        </div>
                        {(h.assessmentId || h.noteIds.length > 0 || (h.worksheets?.length ?? 0) > 0) && (
                          <div className="mt-2"><LinkedRows quizId={h.assessmentId} notes={h.noteIds.map((id) => ({ id }))} worksheets={h.worksheets} onPreview={(p) => setView2(p)} /></div>
                        )}
                        {h.instructions && <p className="mt-1 line-clamp-2 text-[12.5px] text-[var(--ink-2)]">{h.instructions}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {h.assignedChildIds.slice(0, 6).map((id) => <Pill key={id} icon={<Avatar name={nameOf.get(id) ?? "?"} size={16} />}>{nameOf.get(id) ?? tr("student")}</Pill>)}
                          {h.assignedChildIds.length > 6 && <span className="text-[11.5px] text-[var(--ink-3)]">{tr("plusMore", { n: h.assignedChildIds.length - 6 })}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={() => { setHwFilter(h.id); setFilter("all"); setView("inbox"); }}>{tr("handIns", { done, total })}</Button>
                        {!readOnly && <button type="button" onClick={() => setEditor(h)} aria-label={tr("editAria", { title: h.title })} title={tr("editHw")} className={`grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] ${FOCUS}`}><Ico name="edit" size={17} /></button>}
                        {!readOnly && <MoreMenu label={tr("moreAria", { title: h.title })}>
                          {(close) => confirmDel === h.id ? (
                            <div className="grid gap-1 p-1">
                              <div className="px-2 pt-1 text-[12px] font-bold text-[var(--ink-2)]">{tr("delQ")}</div>
                              <button type="button" disabled={busy === h.id} onClick={() => { close(); void removeHomework(h); }} className={`min-h-[44px] rounded-lg bg-[var(--red)] px-3 text-[13px] font-extrabold text-white ${FOCUS}`}>{busy === h.id ? tr("deleting") : tr("delAll")}</button>
                              <button type="button" onClick={() => { setConfirmDel(null); close(); }} className={`min-h-[44px] rounded-lg px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>{tr("keepIt")}</button>
                            </div>
                          ) : <MenuItem icon="trash" tone="danger" onClick={() => setConfirmDel(h.id)}>{tr("delMenu")}</MenuItem>}
                        </MoreMenu>}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-3.5 grid gap-2 border-t border-[var(--line)] pt-3" aria-label={tr("progressAria")}>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { n: h.counts.assigned, label: tr("waiting"), c: "var(--ink-3)" },
                            { n: h.counts.submitted, label: tr("fToMark"), c: "var(--brand-2)" },
                            { n: h.counts.marked, label: tr("fMarked"), c: "var(--green)" },
                          ].map((x) => (
                            <div key={x.label} className="rounded-xl bg-[var(--panel)] px-2 py-1.5">
                              <div className="text-[18px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: x.c }}>{x.n}</div>
                              <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{x.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]" role="img" aria-label={tr("barAria", { marked: h.counts.marked, toMark: h.counts.submitted, waiting: h.counts.assigned })}>
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
        initialGroupId={editor === "new" ? preset?.groupId || null : null} initialChildIds={editor === "new" ? preset?.childIds : undefined}
        initialTitle={editor === "new" ? preset?.title : undefined} initialInstructions={editor === "new" ? preset?.instructions : undefined} packNoteId={editor === "new" ? preset?.packNoteId : undefined}
        onClose={() => { setEditor(null); setPreset(null); }} onSaved={() => { setEditor(null); setPreset(null); load(); }} />}
      {view2?.kind === "note" && <LessonPreviewDialog noteId={view2.id} qs={qs} config={config} topics={topics} onClose={() => setView2(null)} />}
      {view2?.kind === "worksheet" && <WorksheetPreviewDialog noteId={view2.id} title={view2.title} quizId={view2.quizId} qs={qs} onClose={() => setView2(null)} />}
      {view2?.kind === "quiz" && <QuizPreviewDialog assessmentId={view2.id} qs={qs} onClose={() => setView2(null)} />}
      {markingRow && (
        <MarkDialog key={markingRow.submissionId} row={markingRow} readOnly={readOnly} hasNext={!!nextRow} qs={qs} onClose={() => setMarking(null)}
          onMarked={(advance) => { load(); setMarking(advance && nextRow ? nextRow.submissionId : null); }} />
      )}
    </div>
  );
}

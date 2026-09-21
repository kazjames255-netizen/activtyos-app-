"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { errMsg } from "./types";
import { EmptyState, FOCUS, FullscreenPortal, Overline, Segmented, DISPLAY, tzLabel, useNow, withQs } from "./teachKit";
import { GradientTile, Ico } from "./teachIcons";
import { StageSkeleton } from "./live/LessonStage";
import { useCall } from "./live/CallProvider";
import { LessonNotesDialog } from "./live/workspace/LessonNotesEditor";
import { LessonForm } from "./live/LessonForm";
import { LessonRow, NextLessonHero } from "./live/LessonCards";
import { Lobby, type JoinPrefs } from "./live/Lobby";
import { TodayStrip } from "./live/TodayStrip";
import { stageInfo } from "./live/liveKit";
import { lessonStage, lessonTiming, type Lesson } from "./live/lessonTypes";
import { topicLabel } from "./types";
import { takeHubIntent } from "./hubIntent";
import { TeachInPersonButton } from "./inperson/TeachInPersonButton";
import { wantBoardFirst } from "./live/board/callObject";
import { GroupViewChip, useGroupView } from "./groupKit";
import { membersOf, relevantTo } from "./groupStatus";
import { ScopeToggle, useScope } from "./mineKit";

// Live lessons — the hero of the Learning Hub. Tutors schedule and run lessons,
// students join them; the video is embedded right here (Daily, themed to the
// portal) with the lesson's topic notes in a rail beside it. The server owns the
// join window, room privacy and tokens (POST /lessons/:id/join); this panel
// only mirrors the window so the button reads honestly.

export const meta: PanelMeta = { key: "live", label: "Live lessons", icon: "🎥", status: "live", blurb: "Join your 1:1 or small-group lesson right here, on video, with your lessons and topics alongside." };

const asList = (r: unknown): Lesson[] => (Array.isArray(r) ? (r as Lesson[]) : Array.isArray((r as { lessons?: Lesson[] } | null)?.lessons) ? (r as { lessons: Lesson[] }).lessons : []);

export function Panel(props: PanelProps) {
  const call = useCall();
  if (!call) return <EmptyState icon={<Ico name="video" size={26} />} title="Live lessons aren't available here" body="Open the Teaching Hub from your portal to join a lesson." />;
  return <LivePanel {...props} call={call} />;
}

function LivePanel(props: PanelProps & { call: NonNullable<ReturnType<typeof useCall>> }) {
  const { qs, canEdit, topics, students, childId, filter, onError, setFocus, groups = [], call, readOnly, me } = props;
  const [allLessons, setLessons] = useState<Lesson[] | null>(null);
  // A group card's Lesson tile lands here filtered to that group: lessons set for it, or for students who are ALL in it.
  const { group: viewGroup, clear: clearView } = useGroupView("lesson", groups);
  // F11: in a business with more than one tutor a tutor sees their own lessons by default (Everyone is one tap away).
  const myUid = canEdit && me ? me.uid : null;
  const mineCount = useMemo(() => (myUid && allLessons ? allLessons.filter((l) => l.tutorUid === myUid).length : 0), [allLessons, myUid]);
  const multiTutor = !!myUid && !!allLessons && (me?.role === "staff" || allLessons.some((l) => l.tutorUid && l.tutorUid !== myUid));
  const [scope, setScope] = useScope(me?.role === "staff" && mineCount > 0 ? "mine" : "all");
  const scoped = multiTutor && scope === "mine" ? (allLessons ?? []).filter((l) => l.tutorUid === myUid) : allLessons;
  const lessons = useMemo(() => (viewGroup && scoped ? scoped.filter((l) => relevantTo(viewGroup, membersOf(viewGroup), l.groupIds, l.childIds)) : scoped), [scoped, viewGroup]);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [pastN, setPastN] = useState(40); // the Past list shows this many, "Show more" adds another page
  const [editor, setEditor] = useState<Lesson | "new" | null>(null);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // A group quick action ("Schedule video lesson") from the Students tab opens the form with that group invited.
  const [presetGroup, setPresetGroup] = useState<string | null>(null);
  const tookIntent = useRef(false);
  useEffect(() => {
    if (tookIntent.current || !canEdit || readOnly) return;
    const i = takeHubIntent(["lesson"]);
    if (i) { tookIntent.current = true; setPresetGroup(i.groupId); setEditor("new"); }
  }, [canEdit]);
  const now = useNow(1000);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // The lobby is a full-screen moment, and an in-page call is a focused layout: ask the shell to drop its
  // chrome (hero, tab strip, topic sidebar) and ALWAYS give it back. The call keeps running when this tab unmounts.
  const focusRef = useRef(setFocus);
  useEffect(() => { focusRef.current = setFocus; });
  const inlineCall = call.inline;
  const focusOn = !!lobbyId || inlineCall;
  useEffect(() => {
    if (!focusOn) return;
    focusRef.current?.(true, { bare: inlineCall && !lobbyId });
    return () => focusRef.current?.(false);
  }, [focusOn, inlineCall, lobbyId]);
  const attachHost = call.attachHost;
  useEffect(() => attachHost(), [attachHost]);

  const listPath = `/api/learning-hub/lessons${withQs(qs, canEdit ? {} : { childId })}`;
  const load = useCallback(() => {
    get<unknown>(listPath)
      .then((r) => { if (mounted.current) setLessons(asList(r)); })
      .catch((e) => { if (mounted.current) { setLessons((cur) => cur ?? []); onError(errMsg(e, "Couldn't load your lessons")); } });
  }, [listPath, onError]);
  useEffect(() => { setLessons(null); load(); }, [load]);
  useRealtime(["hubLessons"], load);

  // Minute-level clock is enough for phase flips, but the hero countdown ticks each second (useNow above).
  const nameOf = useMemo(() => new Map(students.map((s) => [s.childId, s.childName])), [students]);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const attendeesOf = (l: Lesson) => l.students?.length ? l.students.map((s) => s.childName) : (l.childIds ?? []).map((id) => nameOf.get(id) ?? "Student");
  const tutorOf = (l: Lesson) => l.tutorName || students.find((s) => s.tutorName)?.tutorName || "Your tutor";

  const { upcoming, past } = useMemo(() => {
    const up: Lesson[] = [], pa: Lesson[] = [];
    for (const l of lessons ?? []) (["upcoming", "open"].includes(lessonTiming(l, now).phase) ? up : pa).push(l);
    // Live first, then soonest; lessons past their slot (still joinable) sink so a fresh one leads.
    const rank = (l: Lesson) => { const st = lessonStage(l, now); return st === "live" ? 0 : st === "grace" ? 2 : 1; };
    up.sort((a, b) => rank(a) - rank(b) || a.startsAt.localeCompare(b.startsAt));
    pa.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return { upcoming: up, past: pa };
  }, [lessons, now]);

  // Zero-click way back in: the last camera/mic choices, no lobby.
  const quickJoin = (l: Lesson) => call.start(l);

  // Tutor: start a NEW session of a lesson whose window has closed (POST /reopen), then straight into the call.
  const reopenAndJoin = async (l: Lesson) => {
    setBusyId(l.id);
    try {
      const fresh = await post<Lesson>(`/api/learning-hub/lessons/${l.id}/reopen${withQs(qs, {})}`, {});
      load();
      call.start({ ...l, ...fresh });
    } catch (e) { onError(errMsg(e, "Couldn't reopen the lesson")); }
    finally { setBusyId(null); }
  };

  const cancelLesson = async (l: Lesson, following = false) => {
    if (readOnly) return;
    setBusyId(l.id);
    try { await put(`/api/learning-hub/lessons/${l.id}${withQs(qs, {})}`, { status: "cancelled", ...(following ? { applyTo: "following" } : {}) }); load(); }
    catch (e) { onError(errMsg(e, "Couldn't cancel the lesson")); }
    finally { setBusyId(null); }
  };

  useEffect(() => { if (lobbyId && allLessons && !allLessons.some((l) => l.id === lobbyId)) setLobbyId(null); }, [lobbyId, allLessons]);

  // ── in the call, in the page ──
  // The room itself lives in the persistent call layer (see CallProvider); this tab only reserves its space.
  if (inlineCall) return <div ref={call.slotRef} id="hub-call-slot" aria-hidden="true" className="w-full" style={{ height: "clamp(520px, calc(100dvh - 7.5rem), 1100px)" }} />;

  // ── pre-join lobby ──
  const lobbyLesson = lobbyId ? (allLessons ?? []).find((l) => l.id === lobbyId) ?? null : null;
  if (lobbyLesson && !["ended", "cancelled"].includes(lessonStage(lobbyLesson, now))) {
    const tp = lobbyLesson.topicId ? topicById.get(lobbyLesson.topicId) : undefined;
    return (
      <FullscreenPortal>
      <Lobby lesson={lobbyLesson} isTutor={canEdit} tutorLabel={canEdit ? "You" : tutorOf(lobbyLesson)} attendees={attendeesOf(lobbyLesson)}
        topicLabel={tp ? topicLabel(tp) : undefined} joining={call.joiningId === lobbyLesson.id}
        qs={qs} onJoin={(p, asChild) => { setLobbyId(null); call.start(lobbyLesson, p, asChild); }} onClose={() => setLobbyId(null)} />
      </FullscreenPortal>
    );
  }

  // ── list view ──
  const next = upcoming[0] ?? null;
  const rest = next ? upcoming.slice(1) : upcoming;
  const liveRows = rest.filter((l) => lessonStage(l, now) === "live");
  const laterRows = rest.filter((l) => lessonStage(l, now) !== "live");
  const openStrip = (l: Lesson) => {
    if (readOnly && canEdit) return; // view-only: joining is a write
    if (stageInfo(l, now, canEdit).canJoin) { setLobbyId(l.id); return; }
    document.querySelector(`[data-lesson-id="${l.id}"], #hub-next-lesson`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const rowFor = (l: Lesson) => (
    <LessonRow key={l.id} lesson={l} now={now} isTutor={canEdit} readOnly={readOnly} topic={l.topicId ? topicById.get(l.topicId) ?? null : null}
      tutorLabel={tutorOf(l)} attendees={attendeesOf(l)} busy={busyId === l.id}
      onJoin={() => setLobbyId(l.id)} onQuickJoin={() => quickJoin(l)} onEdit={() => setEditor(l)} onCancel={() => void cancelLesson(l)} onCancelFollowing={() => void cancelLesson(l, true)} onEditNotes={() => setNotesFor(l.id)} />
  );
  const form = editor && (
    <LessonForm
      lesson={editor === "new" ? null : editor}
      topics={topics}
      students={students}
      qs={qs}
      defaultTopicId={filter.topicId}
      groups={groups}
      initialGroupId={editor === "new" ? presetGroup : null}
      onClose={() => { setEditor(null); setPresetGroup(null); }}
      onSaved={(l) => { setEditor(null); setPresetGroup(null); setTab(l.held ? "past" : "upcoming"); load(); }}
    />
  );

  if (lessons === null) return <div className="grid gap-3" aria-busy="true" aria-label="Loading lessons"><StageSkeleton /></div>;

  const scheduleBtn = canEdit && !readOnly && (
    <span className="inline-flex flex-wrap items-center gap-2">
      <TeachInPersonButton qs={qs} config={props.config} goTo={props.goTo} preset={viewGroup ? { groupIds: [viewGroup.id], childIds: [...membersOf(viewGroup)] } : undefined} variant="outline" testId="live-teach-in-person" />
      <Button variant="solid" id="hub-schedule-lesson" className={`min-h-[44px] gap-2 ${FOCUS}`} onClick={() => { if (viewGroup) setPresetGroup(viewGroup.id); setEditor("new"); }}><Ico name="plus" size={16} strokeWidth={2.4} />Schedule video lesson</Button>
    </span>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-live-lessons">
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="video" size={44} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Live lessons</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{canEdit ? "Schedule video lessons with your students and run them right here." : "Join your lesson on video — your lessons stay right beside the call."} Times shown in your timezone ({tzLabel()}).</p>
        </div>
        {multiTutor && <ScopeToggle scope={scope} onChange={setScope} mine={mineCount} all={allLessons?.length ?? 0} what="lessons" />}
        {scheduleBtn}
      </div>

      {viewGroup && <GroupViewChip group={viewGroup} what="live lessons" onClear={clearView} />}

      {lessons.length === 0 ? (
        canEdit ? (
          <EmptyState icon={<Ico name="video" size={26} />} title={viewGroup ? `No live lessons for ${viewGroup.name} yet` : "Schedule your first live lesson"}
            body={students.length ? "Pick a time, choose who's invited and they'll get a private video room — no links to paste, nothing to install." : "Enrol a student first, then schedule a private video lesson with them right here."}
            action={students.length && !readOnly ? scheduleBtn : undefined} />
        ) : (
          <EmptyState icon={<Ico name="video" size={26} />} title="No lessons scheduled yet" body="When your tutor schedules a live lesson it will appear here with a countdown and a Join button that opens 10 minutes before the start." />
        )
      ) : (
        <>
          {next ? (
            <NextLessonHero
              lesson={next} now={now} isTutor={canEdit} readOnly={readOnly}
              topic={next.topicId ? topicById.get(next.topicId) ?? null : null}
              tutorLabel={canEdit ? "You" : tutorOf(next)}
              attendees={attendeesOf(next)}
              joining={busyId === next.id}
              onJoin={() => setLobbyId(next.id)}
              onCheck={() => setLobbyId(next.id)}
              onQuickJoin={() => quickJoin(next)}
              onOpenBoard={canEdit && !readOnly ? () => { wantBoardFirst(); quickJoin(next); } : undefined}
              onEditNotes={readOnly ? undefined : () => setNotesFor(next.id)}
              onEdit={canEdit && !readOnly ? () => setEditor(next) : undefined}
            />
          ) : (
            <div className="rounded-3xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-6 py-7 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--brand)]" aria-hidden><Ico name="check" size={24} strokeWidth={2.4} /></div>
              <div className="mt-1 text-[16px] font-extrabold text-[var(--brand-strong)]" style={DISPLAY}>Nothing coming up</div>
              <p className="mt-1 text-[13px] text-[var(--ink-2)]">{canEdit ? "Your calendar is clear — schedule the next lesson." : "No upcoming lessons right now. Your tutor will schedule the next one."}</p>
            </div>
          )}

          <TodayStrip lessons={lessons} now={now} isTutor={canEdit} topicById={topicById} attendeesOf={attendeesOf} tutorOf={tutorOf} onOpen={openStrip} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented label="Live lessons" value={tab} onChange={setTab} options={[{ v: "upcoming", label: "Upcoming", count: rest.length }, { v: "past", label: "Past", count: past.length }]} />
          </div>

          {tab === "upcoming" ? (
            rest.length ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" id="hub-lessons-upcoming">
                {liveRows.length > 0 && (
                  <>
                    <Overline right={<span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--hub-green-ink)]"><span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--green)] motion-reduce:animate-none" />{liveRows.length} running</span>}>Live now</Overline>
                    {liveRows.map(rowFor)}
                  </>
                )}
                {laterRows.length > 0 && (
                  <>
                    <Overline>{next ? "Coming up" : "Upcoming"}</Overline>
                    {laterRows.map(rowFor)}
                  </>
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-3)]">{next ? "That's the only lesson booked so far." : "No upcoming lessons."}</p>
            )
          ) : past.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" id="hub-lessons-past">
              {past.slice(0, pastN).map((l) => (
                <LessonRow key={l.id} lesson={l} now={now} isTutor={canEdit} readOnly={readOnly} topic={l.topicId ? topicById.get(l.topicId) ?? null : null}
                  tutorLabel={tutorOf(l)} attendees={attendeesOf(l)} busy={busyId === l.id}
                  onJoin={() => undefined} onEdit={() => undefined} onCancel={() => undefined} onReopen={canEdit && !readOnly ? () => void reopenAndJoin(l) : undefined} onEditNotes={() => setNotesFor(l.id)} />
              ))}
              {past.length > pastN && <button type="button" data-action="show-more-past" onClick={() => setPastN((n) => n + 40)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:border-[var(--brand)] ${FOCUS}`}>Show {Math.min(40, past.length - pastN)} more of {past.length - pastN} older</button>}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-3)]">Finished lessons will show up here.</p>
          )}
        </>
      )}
      {form}
      {notesFor && (() => { const nl = (allLessons ?? []).find((x) => x.id === notesFor); return nl ? <LessonNotesDialog p={props} lesson={nl} onClose={() => setNotesFor(null)} /> : null; })()}
      <span className="sr-only" aria-live="polite">{busyId ? "Working…" : ""}</span>
    </div>
  );
}

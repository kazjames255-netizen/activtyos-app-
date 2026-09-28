"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
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
import { InPersonApp } from "./inperson/InPersonApp";
import { listSessions, startScheduledSession, type IpSession } from "./inperson/api";
import { InPersonRow } from "./live/InPersonRow";
import { ScheduledInPersonRow } from "./live/ScheduledInPersonRow";
import { IpEditDialog } from "./live/IpEditDialog";
import { NewSessionChooser, type SessionHow, type SessionWhen } from "./live/NewSessionChooser";
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
  const t = useT();
  if (!call) return <EmptyState icon={<Ico name="video" size={26} />} title={t("hublive.aPanel_unavailTitle")} body={t("hublive.aPanel_unavailBody")} />;
  return <LivePanel {...props} call={call} />;
}

function LivePanel(props: PanelProps & { call: NonNullable<ReturnType<typeof useCall>> }) {
  const { qs, canEdit, topics, students, childId, filter, onError, setFocus, groups = [], call, readOnly, me } = props;
  const t = useT();
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
  // The merged "New session" chooser (When: now/later, How: video/in person) and where its answer routes to.
  const [chooserOpen, setChooserOpen] = useState(false);
  const [startNow, setStartNow] = useState(false);
  // The form is scheduling an IN-PERSON lesson (New session → In person → Schedule for later).
  const [formInPerson, setFormInPerson] = useState(false);
  // "new" = the in-person setup screen (a fresh session); an IpSession = resuming one still left open.
  const [ipOverlay, setIpOverlay] = useState<"new" | IpSession | null>(null);
  const [ipEdit, setIpEdit] = useState<IpSession | null>(null);
  // In-person sessions are ordinary hubLessons rows under the hood (mode: "in_person" — server/src/routes/hub/inPersonApi.ts)
  // but GET /lessons hides them (no room to join); fetched separately so Past/"still open" can show real in-person history
  // alongside video lessons in the one list, honestly (tutor-only: the endpoint refuses a view-only role).
  const [ipSessions, setIpSessions] = useState<IpSession[] | null>(null);
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
  const canSeeIp = canEdit && !readOnly;
  const load = useCallback(() => {
    get<unknown>(listPath)
      .then((r) => { if (mounted.current) setLessons(asList(r)); })
      .catch((e) => { if (mounted.current) { setLessons((cur) => cur ?? []); onError(errMsg(e, t("hublive.aPanel_loadFail"))); } });
    if (canSeeIp) listSessions(qs).then((r) => { if (mounted.current) setIpSessions(Array.isArray(r) ? r : []); }).catch(() => { if (mounted.current) setIpSessions((cur) => cur ?? []); });
    else setIpSessions([]);
  }, [listPath, onError, t, canSeeIp, qs]);
  useEffect(() => { setLessons(null); load(); }, [load]);
  useRealtime(["hubLessons"], load);

  // Minute-level clock is enough for phase flips, but the hero countdown ticks each second (useNow above).
  const nameOf = useMemo(() => new Map(students.map((s) => [s.childId, s.childName])), [students]);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const attendeesOf = (l: Lesson) => l.students?.length ? l.students.map((s) => s.childName) : (l.childIds ?? []).map((id) => nameOf.get(id) ?? t("hublive.aPanel_student"));
  const tutorOf = (l: Lesson) => l.tutorName || students.find((s) => s.tutorName)?.tutorName || t("hublive.aPanel_yourTutor");

  // Lessons scheduled AHEAD to run in person (mode "in_person", still not started): no room, nothing to join, so they get their own
  // rows with a Start button instead of the video join window. Once started they become ordinary in-person sessions (ipSessions below).
  const videoLessons = useMemo(() => (lessons ?? []).filter((l) => l.mode !== "in_person"), [lessons]);
  const ipScheduled = useMemo(() => (lessons ?? []).filter((l) => l.mode === "in_person" && l.status === "scheduled" && new Date(l.startsAt).getTime() + l.durationMins * 60_000 > now - 3 * 86_400_000)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [lessons, now]);
  const { upcoming, past } = useMemo(() => {
    const up: Lesson[] = [], pa: Lesson[] = [];
    for (const l of videoLessons) (["upcoming", "open"].includes(lessonTiming(l, now).phase) ? up : pa).push(l);
    // Live first, then soonest; lessons past their slot (still joinable) sink so a fresh one leads.
    const rank = (l: Lesson) => { const st = lessonStage(l, now); return st === "live" ? 0 : st === "grace" ? 2 : 1; };
    up.sort((a, b) => rank(a) - rank(b) || a.startsAt.localeCompare(b.startsAt));
    pa.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return { upcoming: up, past: pa };
  }, [videoLessons, now]);

  // In-person sessions folded into the same picture: "live" ones are exactly as "happening now" as a video lesson
  // mid-call (a tutor should never lose track of one left open); "ended" ones are real history, so they interleave
  // by date into the one Past list rather than sitting on a second screen. There is no "upcoming in person" — the
  // server has no concept of scheduling one ahead (see server/src/routes/hub/inPersonApi.ts), so that column stays
  // honestly video-only.
  const ipLive = useMemo(() => (ipSessions ?? []).filter((s) => s.status === "live"), [ipSessions]);
  const ipPast = useMemo(() => (ipSessions ?? []).filter((s) => s.status !== "live").sort((a, b) => b.startsAt.localeCompare(a.startsAt)), [ipSessions]);
  type PastItem = { at: string; kind: "video"; lesson: Lesson } | { at: string; kind: "in_person"; session: IpSession };
  const pastItems = useMemo<PastItem[]>(() => {
    const items: PastItem[] = [
      ...past.map((lesson): PastItem => ({ at: lesson.startsAt, kind: "video", lesson })),
      ...ipPast.map((session): PastItem => ({ at: session.startsAt, kind: "in_person", session })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [past, ipPast]);

  // Zero-click way back in: the last camera/mic choices, no lobby.
  const quickJoin = (l: Lesson) => call.start(l);

  // Tutor: start a NEW session of a lesson whose window has closed (POST /reopen), then straight into the call.
  const reopenAndJoin = async (l: Lesson) => {
    setBusyId(l.id);
    try {
      const fresh = await post<Lesson>(`/api/learning-hub/lessons/${l.id}/reopen${withQs(qs, {})}`, {});
      load();
      call.start({ ...l, ...fresh });
    } catch (e) { onError(errMsg(e, t("hublive.aPanel_reopenFail"))); }
    finally { setBusyId(null); }
  };

  const cancelLesson = async (l: Lesson, following = false) => {
    if (readOnly) return;
    setBusyId(l.id);
    try { await put(`/api/learning-hub/lessons/${l.id}${withQs(qs, {})}`, { status: "cancelled", ...(following ? { applyTo: "following" } : {}) }); load(); }
    catch (e) { onError(errMsg(e, t("hublive.aPanel_cancelFail"))); }
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
      <Lobby lesson={lobbyLesson} isTutor={canEdit} tutorLabel={canEdit ? t("hublive.aPanel_you") : tutorOf(lobbyLesson)} attendees={attendeesOf(lobbyLesson)}
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
  const startScheduledIp = async (l: Lesson) => {
    setBusyId(l.id);
    try { const s = await startScheduledSession(qs, l.id); if (mounted.current) setIpOverlay(s); load(); }
    catch (e) { onError(errMsg(e, t("hublive.aIp_startFail"))); }
    finally { if (mounted.current) setBusyId(null); }
  };
  const ipRowFor = (l: Lesson) => (
    <ScheduledInPersonRow key={l.id} lesson={l} now={now} isTutor={canEdit} readOnly={readOnly} tutorLabel={tutorOf(l)} attendees={attendeesOf(l)} busy={busyId === l.id}
      onStart={() => void startScheduledIp(l)} onEdit={() => setEditor(l)} onCancel={() => void cancelLesson(l)} onCancelFollowing={() => void cancelLesson(l, true)} />
  );
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
      startNow={editor === "new" && startNow}
      inPerson={editor === "new" && formInPerson}
      onClose={() => { setEditor(null); setPresetGroup(null); setStartNow(false); setFormInPerson(false); }}
      onSaved={(l) => { setEditor(null); setPresetGroup(null); setStartNow(false); setFormInPerson(false); setTab(l.held ? "past" : "upcoming"); load(); if (startNow) setLobbyId(l.id); }}
    />
  );

  const ipEditDialog = ipEdit && <IpEditDialog qs={qs} session={ipEdit} onClose={() => setIpEdit(null)} onSaved={() => { setIpEdit(null); load(); }} />;

  if (lessons === null) return <div className="grid gap-3" aria-busy="true" aria-label={t("hublive.aPanel_loading")}><StageSkeleton /></div>;

  // The New session chooser's answer routes to whichever existing flow already does the real work: LessonForm
  // (video now/later, or in person scheduled for later) or InPersonApp (in person, starting right now; see NewSessionChooser).
  const chooseSession = (when: SessionWhen, how: SessionHow) => {
    setChooserOpen(false);
    if (viewGroup) setPresetGroup(viewGroup.id);
    if (how === "video") { setFormInPerson(false); setStartNow(when === "now"); setEditor("new"); }
    else if (when === "now") setIpOverlay("new");
    else { setStartNow(false); setFormInPerson(true); setEditor("new"); }
  };
  const hasAnything = lessons.length > 0 || (ipSessions?.length ?? 0) > 0;

  // Kaz: "we dont needs 2 places where it says schedule video lesson just the one in the muddle" — a first-time
  // tutor (no lessons yet, not viewing a group) saw this exact button twice: once here in the header, once as the
  // empty state's own centred action. The header copy now says "your first" until there's a lesson to prove it,
  // "video lesson" after — and the header button itself is skipped whenever the empty state is about to show its
  // own copy of it, so there is only ever one.
  const firstTime = !hasAnything && !viewGroup;
  const scheduleBtn = canEdit && !readOnly && (
    <Button variant="solid" id="hub-schedule-lesson" className={`min-h-[44px] gap-2 ${FOCUS}`} onClick={() => setChooserOpen(true)}><Ico name="plus" size={16} strokeWidth={2.4} />{firstTime ? t("hublive.aNew_buttonFirst") : t("hublive.aNew_button")}</Button>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-live-lessons">
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="video" size={44} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{canEdit ? t("hublive.aPanel_titleTutor") : t("hublive.aPanel_title")}</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{canEdit ? t("hublive.aPanel_subTutor") : t("hublive.aPanel_subStudent")} {t("hublive.aPanel_tz", { tz: tzLabel() })}</p>
        </div>
        {multiTutor && <ScopeToggle scope={scope} onChange={setScope} mine={mineCount} all={allLessons?.length ?? 0} what={t("hublive.aPanel_whatLessons")} />}
        {/* The empty state below shows this same button as its own centred action — never render it twice. */}
        {!(firstTime && canEdit && students.length && !readOnly) && scheduleBtn}
      </div>

      {viewGroup && <GroupViewChip group={viewGroup} what={t("hublive.aPanel_whatLive")} onClear={clearView} />}

      {!hasAnything ? (
        canEdit ? (
          <EmptyState icon={<Ico name="video" size={26} />} title={viewGroup ? t("hublive.aPanel_emptyGroupTitle", { name: viewGroup.name }) : t("hublive.aPanel_emptyFirstTitle")}
            body={students.length ? t("hublive.aPanel_emptyBodyStudents") : t("hublive.aPanel_emptyBodyNone")}
            action={students.length && !readOnly ? scheduleBtn : undefined} />
        ) : (
          <EmptyState icon={<Ico name="video" size={26} />} title={t("hublive.aPanel_emptyStuTitle")} body={t("hublive.aPanel_emptyStuBody")} />
        )
      ) : (
        <>
          {next ? (
            <NextLessonHero
              lesson={next} now={now} isTutor={canEdit} readOnly={readOnly}
              topic={next.topicId ? topicById.get(next.topicId) ?? null : null}
              tutorLabel={canEdit ? t("hublive.aPanel_you") : tutorOf(next)}
              attendees={attendeesOf(next)}
              joining={busyId === next.id}
              onJoin={() => setLobbyId(next.id)}
              onCheck={() => setLobbyId(next.id)}
              onQuickJoin={() => quickJoin(next)}
              onOpenBoard={canEdit && !readOnly ? () => { wantBoardFirst(); quickJoin(next); } : undefined}
              onEditNotes={readOnly ? undefined : () => setNotesFor(next.id)}
              onEdit={canEdit && !readOnly ? () => setEditor(next) : undefined}
            />
          ) : ipScheduled.length || ipLive.length ? null : (   // an in-person lesson still open (Resume) or scheduled is something coming up: never say "Nothing coming up" above it
            <div className="rounded-3xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-6 py-7 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--brand)]" aria-hidden><Ico name="check" size={24} strokeWidth={2.4} /></div>
              <div className="mt-1 text-[16px] font-extrabold text-[var(--brand-strong)]" style={DISPLAY}>{t("hublive.aPanel_nothingTitle")}</div>
              <p className="mt-1 text-[13px] text-[var(--ink-2)]">{canEdit ? t("hublive.aPanel_nothingTutor") : t("hublive.aPanel_nothingStudent")}</p>
            </div>
          )}

          <TodayStrip lessons={videoLessons} now={now} isTutor={canEdit} topicById={topicById} attendeesOf={attendeesOf} tutorOf={tutorOf} onOpen={openStrip} />

          {ipLive.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" id="hub-ip-still-open">
              <Overline>{t("hublive.aIp_stillOpenTitle")}</Overline>
              {ipLive.map((s) => { const ed = (lessons ?? []).find((l) => l.id === s.id); return <InPersonRow key={s.id} session={s} now={now} onResume={() => setIpOverlay(s)} onEdit={canEdit && !readOnly ? () => (ed ? setEditor(ed) : setIpEdit(s)) : undefined} />; })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented label={t("hublive.aPanel_title")} value={tab} onChange={setTab} options={[{ v: "upcoming", label: t("hublive.aPanel_upcoming"), count: rest.length + ipScheduled.length }, { v: "past", label: t("hublive.aPanel_past"), count: pastItems.length }]} />
          </div>

          {tab === "upcoming" ? (
            rest.length || ipScheduled.length ? (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" id="hub-lessons-upcoming">
                {ipScheduled.length > 0 && (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" id="hub-ip-scheduled">
                    <Overline>{t("hublive.aIp_scheduledTitle")}</Overline>
                    {ipScheduled.map(ipRowFor)}
                  </div>
                )}
                {liveRows.length > 0 && (
                  <>
                    <Overline right={<span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--hub-green-ink)]"><span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--green)] motion-reduce:animate-none" />{t("hublive.aPanel_running", { n: liveRows.length })}</span>}>{t("hublive.aPanel_liveNow")}</Overline>
                    {liveRows.map(rowFor)}
                  </>
                )}
                {laterRows.length > 0 && (
                  <>
                    <Overline>{next ? t("hublive.aPanel_comingUp") : t("hublive.aPanel_upcoming")}</Overline>
                    {laterRows.map(rowFor)}
                  </>
                )}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-3)]">{next ? t("hublive.aPanel_onlyOne") : t("hublive.aPanel_noUpcoming")}</p>
            )
          ) : pastItems.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5" id="hub-lessons-past">
              {pastItems.slice(0, pastN).map((item) => item.kind === "video" ? (
                <LessonRow key={item.lesson.id} lesson={item.lesson} now={now} isTutor={canEdit} readOnly={readOnly} topic={item.lesson.topicId ? topicById.get(item.lesson.topicId) ?? null : null}
                  tutorLabel={tutorOf(item.lesson)} attendees={attendeesOf(item.lesson)} busy={busyId === item.lesson.id}
                  onJoin={() => undefined} onEdit={() => undefined} onCancel={() => undefined} onReopen={canEdit && !readOnly ? () => void reopenAndJoin(item.lesson) : undefined} onEditNotes={() => setNotesFor(item.lesson.id)} />
              ) : (
                <InPersonRow key={item.session.id} session={item.session} now={now} onEdit={canEdit && !readOnly && item.session.status === "ended" ? () => setIpEdit(item.session) : undefined} />
              ))}
              {pastItems.length > pastN && <button type="button" data-action="show-more-past" onClick={() => setPastN((n) => n + 40)} className={`min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:border-[var(--brand)] ${FOCUS}`}>{t("hublive.aPanel_showMore", { n: Math.min(40, pastItems.length - pastN), m: pastItems.length - pastN })}</button>}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-3)]">{t("hublive.aPanel_finished")}</p>
          )}
        </>
      )}
      {chooserOpen && <NewSessionChooser onChoose={chooseSession} onClose={() => setChooserOpen(false)} />}
      {ipOverlay && (
        <InPersonApp qs={qs} config={props.config} goTo={props.goTo}
          preset={ipOverlay === "new" && viewGroup ? { groupIds: [viewGroup.id], childIds: [...membersOf(viewGroup)] } : undefined}
          initialSession={ipOverlay !== "new" ? ipOverlay : undefined}
          onClose={() => { setIpOverlay(null); setPresetGroup(null); load(); }} />
      )}
      {form}{ipEditDialog}
      {notesFor && (() => { const nl = (allLessons ?? []).find((x) => x.id === notesFor); return nl ? <LessonNotesDialog p={props} lesson={nl} onClose={() => setNotesFor(null)} /> : null; })()}
      <span className="sr-only" aria-live="polite">{busyId ? t("hublive.aPanel_working") : ""}</span>
    </div>
  );
}

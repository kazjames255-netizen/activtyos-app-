"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { useRealtime } from "@/lib/realtime";
import { Icon } from "../kit";
import type { WarmupQuestion } from "../lesson/api";
import { LessonCard } from "../lesson/LessonCard";
import { LessonStyles } from "../lesson/lessonUi";
import { FOCUS, FullscreenPortal, StudentPicker } from "../teachKit";
import { errMsg, type Note, type Student } from "../types";
import { RemoteDrivenQuizGrid } from "./RemoteDrivenQuiz";
import { RemoteDrivenWarmupExtra } from "./RemoteDrivenWarmup";
import { getRemoteSync, listLiveRemoteSync, patchProgress, startRemoteSync, updateRemoteSyncSession, type RsPace, type RsSession } from "./api";
import { listDoubts, type Doubt } from "../lesson/doubts/api";
import { MessagesCard } from "../lesson/doubts/MessagesCard";
import { FlashcardsForLesson } from "../lesson/FlashcardsForLesson";
import { HomeworkForLesson } from "../lesson/HomeworkForLesson";
import { HelpToolsPicker, type HelpToolId } from "./HelpTools";
import { MiniScreenCard, MINI_STEPS } from "./MiniScreenCard";

// "Start lesson now (remote)" — the full-screen tutor shell: pick who's joining remotely, and HOW the class moves
// through it (pace — see api.ts's RsPace / remoteSyncApi.ts's file header) → drive the lesson → End. Mirrors
// features/learninghub/inperson/InPersonApp.tsx's shape, but for a remote roster with no video call.

export interface RemoteSyncProps {
  qs: string; config: HubSettings; noteId: string; title: string;
  onClose: () => void;
}

const newKey = () => `rs${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const PACE_OPTIONS: { value: RsPace; label: string; hint: string }[] = [
  { value: "driven", label: "I answer, they watch", hint: "You tap in warm-up/quiz answers for the class — students just watch it happen, live." },
  { value: "lockstep", label: "Locked to my pace", hint: "Each student answers for real on their own device, but can't get ahead of where you are." },
  { value: "own_pace", label: "Their own pace", hint: "Each student moves freely. You'll see a live mini-screen of what each one is working on during the warm-up/quiz." },
];

export function RemoteSyncApp({ qs, config, noteId, title, onClose }: RemoteSyncProps) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [session, setSession] = useState<RsSession | null>(null);
  // A tutor who refreshed or closed the tab mid-broadcast: any session THIS lesson still has "live" (see
  // listLiveRemoteSync's comment) — offered below as "Resume broadcasting" instead of silently starting a second one.
  const [live, setLive] = useState<RsSession[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [pace, setPace] = useState<RsPace>("own_pace");
  const [tools, setTools] = useState<HelpToolId[]>([]);
  // Same idea, but for a session already live — the start screen's picker above only ever sets tools at creation,
  // so resuming needs its own copy, pre-filled from what this session already has (see the prefill effect below).
  const [resumeTools, setResumeTools] = useState<HelpToolId[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [startingNew, setStartingNew] = useState(false);
  // Whether we've actually heard back on "is there a live session to resume". Rendering the plain start-fresh
  // form before this resolves would flash it for a beat even when there IS one to rejoin — wait for the real
  // answer instead of guessing from an empty initial `live`.
  const [liveChecked, setLiveChecked] = useState(false);
  const key = useRef(newKey());
  // So the pickers start pre-filled with who's already in / which tools are already on for the class you're
  // returning to (see `resume` below) — applied once, the first time a live session for this lesson shows up.
  const prefilled = useRef(false);

  useEffect(() => {
    let alive = true;
    get<Student[]>(`/api/learning-hub/students${qs}`).then((r) => { if (alive) setStudents(Array.isArray(r) ? r.filter((s) => s.active !== false) : []); })
      .catch((e) => { if (alive) { setStudents([]); setErr(errMsg(e, "Couldn't load your students")); } });
    listLiveRemoteSync(qs, noteId).then((r) => { if (alive) setLive(Array.isArray(r) ? r : []); }).catch(() => undefined).finally(() => { if (alive) setLiveChecked(true); });
    return () => { alive = false; };
  }, [qs, noteId]);
  useEffect(() => {
    if (live.length && !prefilled.current) { prefilled.current = true; setChildIds(live[0]!.childIds); setResumeTools(live[0]!.tools); }
  }, [live]);

  const start = async () => {
    if (!childIds.length) { setErr("Choose at least one student"); return; }
    setBusy(true); setErr(null);
    try {
      const s = await startRemoteSync(qs, { noteId, childIds, title, key: key.current, pace, tools });
      key.current = newKey();
      setSession(s);
    } catch (e) { setErr(errMsg(e, "Couldn't start the lesson")); }
    finally { setBusy(false); }
  };

  // Returning to a session already live: bring in anyone newly ticked in the picker (on top of who's already in —
  // never fewer) and/or apply a changed tools selection, then resume into it. Reads as "add more students" /
  // "change the help tools", never as starting a second class.
  const resume = async (s: RsSession) => {
    const extra = childIds.filter((id) => !s.childIds.includes(id));
    const toolsChanged = resumeTools.length !== s.tools.length || resumeTools.some((t) => !s.tools.includes(t));
    if (!extra.length && !toolsChanged) { setSession(s); return; }
    setBusy(true); setErr(null);
    try {
      setSession(await updateRemoteSyncSession(qs, s.id, { ...(extra.length ? { childIds } : {}), ...(toolsChanged ? { tools: resumeTools } : {}) }));
    } catch (e) { setErr(errMsg(e, "Couldn't update the class")); }
    finally { setBusy(false); }
  };

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-[var(--bg)] text-[var(--ink)]" role="dialog" aria-modal="true" aria-label="Start lesson now (remote)" data-testid="remote-sync-app">
        <LessonStyles />
        {session ? (
          <TutorRunner key={session.id} qs={qs} config={config} initial={session} onClose={onClose} />
        ) : (
          <div className="mx-auto w-full max-w-[880px] p-3 sm:p-6">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-[18px] font-extrabold text-[var(--ink)]">Start lesson now (remote)</h2>
                  <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">“{title}” — no video call. Each student opens it on their own device.</p>
                </div>
                <button type="button" onClick={onClose} className={`min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] hover:border-[var(--ink-3)] ${FOCUS}`}>Cancel</button>
              </div>
              {err && <p role="alert" className="mt-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
              {live.length > 0 && !startingNew && (() => {
                const primary = live[0]!;
                return (
                  <div className="mt-4 rounded-2xl border border-[var(--line)] border-l-4 border-l-[var(--gold)] bg-[var(--panel)] p-3.5" data-testid="remote-sync-resume">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[13.5px] font-extrabold text-[var(--ink)]">You're still broadcasting this lesson — <b>{primary.connectedCount} of {primary.totalCount} connected</b></div>
                      <button type="button" onClick={() => void resume(primary)} disabled={busy} data-testid={`remote-sync-resume-${primary.id}`}
                        className={`min-h-[44px] rounded-full border border-[var(--green-line)] bg-[var(--green-soft)] px-4 text-[13px] font-extrabold text-[var(--hub-green-ink)] hover:brightness-95 disabled:opacity-50 ${FOCUS}`}>{busy ? "…" : "Resume lesson"}</button>
                    </div>
                    <h3 className="m-0 mb-1.5 mt-3 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Add more students?</h3>
                    <p className="m-0 mb-2 text-[12px] text-[var(--ink-3)]">{primary.students.map((s) => s.childName.split(" ")[0]).join(", ")} {primary.students.length === 1 ? "is" : "are"} already in — tick anyone else joining, or just resume as is.</p>
                    {students === null ? <div className="h-16 animate-pulse rounded-xl bg-[var(--panel)]" /> : (
                      <StudentPicker students={students.map((s) => ({ childId: s.childId, childName: s.childName, yearGroup: null }))} value={childIds} onChange={setChildIds} idPrefix="remote-sync" />
                    )}
                    <div className="mt-4">
                      <HelpToolsPicker value={resumeTools} onChange={setResumeTools} />
                    </div>
                    {live.length > 1 && (
                      <ul className="m-0 mt-3 grid list-none gap-2 border-t border-[var(--line)] p-0 pt-3">
                        {live.slice(1, 3).map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="min-w-0 text-[13px] text-[var(--ink-2)]"><b className="text-[var(--ink)]">{s.connectedCount} of {s.totalCount} connected</b> · {s.students.map((x) => x.childName.split(" ")[0]).slice(0, 4).join(", ")}</span>
                            <button type="button" onClick={() => setSession(s)} data-testid={`remote-sync-resume-${s.id}`}
                              className={`min-h-[40px] rounded-full border border-[var(--green-line)] bg-[var(--green-soft)] px-3.5 text-[12.5px] font-extrabold text-[var(--hub-green-ink)] hover:brightness-95 ${FOCUS}`}>Resume lesson</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button type="button" onClick={() => { setStartingNew(true); setChildIds([]); }} className={`mt-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>Start a separate class instead</button>
                  </div>
                );
              })()}
              {(live.length === 0 || startingNew) && (
                <>
                  <div className="mt-4">
                    <h3 className="m-0 mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Who's joining remotely?</h3>
                    {students === null ? <div className="h-16 animate-pulse rounded-xl bg-[var(--panel)]" /> : (
                      <StudentPicker students={students.map((s) => ({ childId: s.childId, childName: s.childName, yearGroup: null }))} value={childIds} onChange={setChildIds} idPrefix="remote-sync" />
                    )}
                  </div>
                  <div className="mt-5">
                    <h3 className="m-0 mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">How do you want to run this?</h3>
                    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Pace">
                      {PACE_OPTIONS.map((o) => (
                        <button key={o.value} type="button" role="radio" aria-checked={pace === o.value} onClick={() => setPace(o.value)} data-testid={`remote-sync-pace-${o.value}`}
                          className={`rounded-xl border-2 p-3 text-left transition ${FOCUS} ${pace === o.value ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand-2)]"}`}>
                          <span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{o.label}</span>
                          <span className="mt-1 block text-[12px] text-[var(--ink-2)]">{o.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5">
                    <HelpToolsPicker value={tools} onChange={setTools} />
                  </div>
                  <button type="button" onClick={() => void start()} disabled={busy || !students || !childIds.length} data-testid="remote-sync-start"
                    className={`mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-6 text-[15px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-50 ${FOCUS}`}>
                    {busy ? "Starting…" : "Start now"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </FullscreenPortal>
  );
}

function TutorRunner({ qs, config, initial, onClose }: { qs: string; config: HubSettings; initial: RsSession; onClose: () => void }) {
  const [sess, setSess] = useState<RsSession>(initial);
  const [note, setNote] = useState<Note | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<Note>(`/api/learning-hub/notes/${initial.noteId}${qs}`).then((n) => { if (alive) setNote(n); })
      .catch((e) => { if (alive) setNoteErr(errMsg(e, "Couldn't open this lesson")); });
    return () => { alive = false; };
  }, [initial.noteId, qs]);

  const refresh = useCallback(() => {
    getRemoteSync(qs, initial.id).then(setSess).catch(() => undefined);
  }, [qs, initial.id]);
  useRealtime(["hubLessons"], refresh);
  // A student's heartbeat alone doesn't always change something the tutor is watching render — poll gently too, so
  // "X of Y connected" ages out even if nothing else pings.
  useEffect(() => { const t = setInterval(refresh, 10_000); return () => clearInterval(t); }, [refresh]);

  // "Ask my teacher": open questions raised from THIS lesson, surfaced live on the asking student's own mini-screen
  // card — right where the tutor is already looking, not off on the Home tab. See AskTeacher.tsx / doubtsApi.ts.
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const loadDoubts = useCallback(() => {
    // Every thread raised in THIS lesson, for as long as the session runs — not just the unread ones, so a
    // conversation the tutor already answered stays visible (and reply-able) instead of vanishing after one reply.
    listDoubts(qs).then((rows) => setDoubts(rows.filter((d) => d.noteId === initial.noteId))).catch(() => undefined);
  }, [qs, initial.noteId]);
  useEffect(() => { loadDoubts(); const t = setInterval(loadDoubts, 10_000); return () => clearInterval(t); }, [loadDoubts]);
  useRealtime(["hubDoubts"], loadDoubts);
  // One card per child: if they've raised more than one thread this lesson, the most recently active one.
  const doubtByChild = useMemo(() => {
    const m = new Map<string, Doubt>();
    for (const d of [...doubts].sort((a, b) => a.lastAt.localeCompare(b.lastAt))) m.set(d.childId, d);
    return m;
  }, [doubts]);
  const onDoubtUpdate = useCallback((next: Doubt) => setDoubts((ds) => ds.map((d) => (d.id === next.id ? next : d))), []);

  const onProgress = useCallback((p: { step: string; slide: number }) => {
    // The tutor already knows their own step — update locally right away rather than waiting on the network
    // round-trip (SSE / the 10s poll) to reflect it back, so mini-screens etc. don't lag behind what's on screen.
    setSess((s) => (s.step === p.step && s.slide === p.slide ? s : { ...s, step: p.step, slide: p.slide }));
    void patchProgress(qs, initial.id, p.step, p.slide).catch(() => undefined);
  }, [qs, initial.id]);

  // "own_pace" running commentary: each liveAnswer already reports one question's verdict once known (warm-up
  // only — see RsLiveAnswer) — turned into a small append-only feed here (key = who + which question, so a poll
  // re-fetching the SAME still-current answer never logs it twice, only an actual new resolved verdict does).
  const seenVerdicts = useRef<Map<string, boolean>>(new Map());
  const [activity, setActivity] = useState<{ id: string; childName: string; correct: boolean; prompt?: string; step: string; at: string }[]>([]);
  useEffect(() => {
    for (const a of sess.liveAnswers) {
      if (typeof a.verdict !== "boolean" || !a.questionId) continue;
      const key = `${a.childId}:${a.questionId}`;
      if (seenVerdicts.current.get(key) === a.verdict) continue;
      seenVerdicts.current.set(key, a.verdict);
      const stepLabel = MINI_STEPS.find((s) => s.id === a.step)?.label ?? a.step;
      setActivity((rows) => [{ id: `${key}@${a.updatedAt}`, childName: a.childName, correct: a.verdict as boolean, prompt: a.questionPrompt, step: stepLabel, at: a.updatedAt }, ...rows].slice(0, 40));
    }
  }, [sess.liveAnswers]);

  // "Leave" — NOT "End": the session stays live server-side (the same "you refreshed/closed the tab" state
  // TutorLiveBanner already covers), so coming back — from that banner, or "Share with children" on this lesson —
  // finds it still broadcasting and offers "Resume broadcasting", not a dead session. Mirrors the pupil's own
  // side (leaving LessonPlayer never ends anything either — see JoinRemoteSyncBanner's onLeft).
  const leave = () => onClose();

  const connectedLabel = `${sess.connectedCount} of ${sess.totalCount} connected`;
  const pace = sess.pace;
  const connectedRoster = useMemo(() => sess.students.filter((s) => s.connected).map((s) => ({ childId: s.childId, childName: s.childName })), [sess.students]);
  const fullRoster = useMemo(() => sess.students.map((s) => ({ childId: s.childId, childName: s.childName, connected: s.connected })), [sess.students]);
  // own_pace: each child moves entirely independently of the tutor's own step (`sess.step`), so the panel stays up
  // for the whole session once started — never gated on where the TUTOR happens to be, or a kid on "Lesson" while
  // the tutor is on "Quiz" would wrongly vanish from view.
  const showMiniScreens = pace === "own_pace";

  const banner = pace === "driven"
    ? "Broadcasting “" + sess.title + "” — you answer for the class, students watch."
    : pace === "lockstep"
      ? "Broadcasting “" + sess.title + "” — students answer for real, but can't get ahead of you."
      : "Broadcasting “" + sess.title + "” — each student moves at their own pace.";

  const drivenBanner = (
    <div role="note" className="mb-3 rounded-xl border border-[var(--line)] border-l-4 border-l-[var(--brand-2)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink)]">
      You're answering for the class — this records a real result for each connected student.
    </div>
  );

  const joinedCount = sess.students.filter((s) => s.connected).length;

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px" }}>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--green-soft)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--hub-green-ink)]">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />LIVE
        </span>
        <h2 className="m-0 min-w-0 flex-1 truncate text-[18px] font-extrabold text-[var(--ink)]">{sess.title}</h2>
        <span data-testid="remote-sync-connected" className="text-[13px] font-bold text-[var(--ink-2)]">{joinedCount} student{joinedCount === 1 ? "" : "s"} joined</span>
        <button type="button" onClick={leave} data-testid="remote-sync-end"
          className={`min-h-[36px] rounded-lg border border-[var(--red)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}>Leave lesson</button>
      </div>
      {pace === "driven" && <div role="status" className="pt-3 text-[12.5px] font-semibold text-[var(--ink-2)]">{banner}</div>}

      <div className="grid grid-cols-1 gap-6 pt-6 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="min-w-0">
          <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Live — where each student is</h3>
          {showMiniScreens ? (
            <MiniScreens roster={fullRoster} liveAnswers={sess.liveAnswers} doubtByChild={doubtByChild} />
          ) : sess.students.length > 0 ? (
            <ul className="mb-6 flex flex-wrap gap-1.5" aria-label="Students in this lesson">
              {sess.students.map((s) => (
                <li key={s.childId} data-ui="card" data-connected={s.connected ? "1" : "0"}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${s.connected ? "border-[var(--green-line)] bg-[var(--green-soft)] text-[var(--green)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)]"}`}>
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.connected ? "bg-current" : "bg-[var(--ink-3)]"}`} />
                  {s.childName}
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="m-0 mb-2 mt-6 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">What students see</h3>
          {noteErr ? (
            <p role="alert" className="rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{noteErr}</p>
          ) : !note ? (
            <div className="h-48 animate-pulse rounded-xl bg-[var(--panel)]" />
          ) : (
            <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}>
              {pace === "driven" ? (
                <LessonCard key={note.id} note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={null} config={config}
                  readOnly onExit={leave} onProgress={onProgress}
                  driven={{
                    banner: drivenBanner,
                    warmupExtra: (q: WarmupQuestion) => <RemoteDrivenWarmupExtra q={q} noteId={note.id} qs={qs} roster={connectedRoster} config={config} />,
                    quiz: (p) => <RemoteDrivenQuizGrid qs={qs} roster={connectedRoster} quiz={p.quiz} config={config} onBack={p.onBack} onFinish={p.onFinish} />,
                  }} />
              ) : (
                <LessonCard key={note.id} note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={null} config={config}
                  readOnly onExit={leave} onProgress={onProgress} />
              )}
            </div>
          )}
        </div>

        <div className="min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:self-start">
          <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Needs you</h3>
          <div className="mb-6">
            <MessagesCard mode="teacher" qs={qs} doubts={doubts} onUpdate={onDoubtUpdate} students={sess.students.map((s) => ({ childId: s.childId, childName: s.childName }))} />
          </div>
          {note && (
            <>
              <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Send to class</h3>
              <div className="grid gap-3">
                <FlashcardsForLesson qs={qs} topicId={note.topicId} />
                <HomeworkForLesson qs={qs} note={{ id: note.id, title: note.title, lesson: note.lesson }} />
              </div>
            </>
          )}
          {showMiniScreens && (
            <>
              <div className="mb-2 mt-6 flex items-baseline justify-between">
                <h3 className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Activity</h3>
                {activity.length > 0 && <span className="text-[11px] font-bold text-[var(--ink-3)]">Most recent {Math.min(5, activity.length)}</span>}
              </div>
              <ActivityFeed rows={activity.slice(0, 5)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const relTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

/** Running commentary of every child's warm-up right/wrong as they work through the lesson, newest first — so
 *  the tutor doesn't have to keep watching every mini-screen to notice who just got something wrong. */
function ActivityFeed({ rows }: { rows: { id: string; childName: string; correct: boolean; prompt?: string; step: string; at: string }[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: "1px solid #E4E4EE" }}>
      {rows.length === 0 ? (
        <p className="m-0 p-4 text-center text-[13px] text-[var(--ink-3)]">Right/wrong answers will appear here as students work through the warm-up.</p>
      ) : rows.map((r) => (
        <div key={r.id} className="px-4 py-2.5" style={{ borderBottom: "1px solid #F0F0F5" }}>
          <div className="flex items-center gap-2">
            <Icon name={r.correct ? "check" : "close"} size={14} strokeWidth={3} className={r.correct ? "text-[var(--hub-green-ink)]" : "text-[var(--red)]"} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)]">{r.childName}</span>
            <span className={`flex-none text-[11.5px] font-extrabold ${r.correct ? "text-[var(--hub-green-ink)]" : "text-[var(--red)]"}`}>{r.correct ? "Correct" : "Not quite"}</span>
          </div>
          {r.prompt && <p className="m-0 mt-0.5 truncate text-[12px] text-[var(--ink-3)]">{r.step} · {r.prompt}</p>}
          <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{relTime(r.at)}</div>
        </div>
      ))}
    </div>
  );
}

/** own_pace: a live tile per roster child showing their REAL current position — not tied to the tutor's own step
 *  (see `showMiniScreens` above) — up for the whole session, including a sensible empty/idle state before anyone's
 *  joined. Not marked, not recorded; purely a live read (GET session → liveAnswers). */
function MiniScreens({ roster, liveAnswers, doubtByChild }: { roster: { childId: string; childName: string; connected: boolean }[]; liveAnswers: RsSession["liveAnswers"]; doubtByChild: Map<string, Doubt> }) {
  const byChild = new Map(liveAnswers.map((a) => [a.childId, a]));
  // No outer panel — the label above already frames this. The placeholder is for "nobody's here yet", not for a
  // small class: a roster of one who HAS joined must show their real card, not a generic "still waiting" message.
  if (!roster.some((r) => r.connected)) {
    return (
      <div data-testid="remote-sync-mini-screens" className="grid min-h-[110px] place-items-center rounded-[14px] text-center text-[13px] text-[var(--ink-3)]" style={{ border: "1.5px dashed #CFCFE0" }}>
        Students appear here as they join
      </div>
    );
  }
  return <MiniScreensGrid roster={roster} byChild={byChild} doubtByChild={doubtByChild} />;
}

/** More than 9 in the class: page across 9 at a time instead of an ever-growing/wrapping grid. */
/** More than 3 in the class: show the first 3, the rest behind an open/close toggle instead of an ever-growing grid. */
function MiniScreensGrid({ roster, byChild, doubtByChild }: {
  roster: { childId: string; childName: string; connected: boolean }[];
  byChild: Map<string, RsSession["liveAnswers"][number]>; doubtByChild: Map<string, Doubt>;
}) {
  const SHOWN = 3;
  const [expanded, setExpanded] = useState(false);
  // Connected students always lead, whatever order the roster itself is in — collapsing to "+N more" must never
  // hide someone who's actually here behind names still waiting to join.
  const ordered = useMemo(() => [...roster].sort((a, b) => Number(b.connected) - Number(a.connected)), [roster]);
  const visible = expanded ? ordered : ordered.slice(0, SHOWN);
  const rest = ordered.length - SHOWN;
  return (
    <div data-testid="remote-sync-mini-screens">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {visible.map((c) => {
          const doubt = doubtByChild.get(c.childId);
          return <MiniScreenCard key={c.childId} childName={c.childName} connected={c.connected} live={byChild.get(c.childId)} questionCount={doubt?.unreadByTutor ? doubt.messages.length : 0} />;
        })}
      </div>
      {rest > 0 && (
        <button type="button" onClick={() => setExpanded((e) => !e)} data-testid="remote-sync-mini-screens-toggle"
          className="mt-3 min-h-[36px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">
          {expanded ? "Show less" : `+${rest} more`}
        </button>
      )}
    </div>
  );
}


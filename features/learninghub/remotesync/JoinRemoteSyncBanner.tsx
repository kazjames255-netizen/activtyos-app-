"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { useRealtime } from "@/lib/realtime";
import { FullscreenPortal, withQs } from "../teachKit";
import { Icon } from "../kit";
import { LessonCard } from "../lesson/LessonCard";
import { LessonStyles } from "../lesson/lessonUi";
import { errMsg, type Note } from "../types";
import { activeRemoteSync, heartbeat, patchLiveAnswer, type LiveAnswerReport, type RsActive } from "./api";
import { HelpToolsPanel } from "./HelpTools";
import { suggestDrawerTools } from "../tools/suggest";
import { listDoubts, type Doubt } from "../lesson/doubts/api";
import { MessagesCard } from "../lesson/doubts/MessagesCard";
import { MiniScreenCard } from "./MiniScreenCard";
import type { StudentHomework } from "../homework/hwTypes";
import { dueState } from "../homework/hwTypes";
import type { DueResponse, QueueCard } from "../flashcards/fcTypes";
import { ReviewSession } from "../flashcards/ReviewSession";

// Family side of "Start lesson now (remote)": while a tutor is broadcasting a lesson to THIS child (and no video call
// is involved), show a banner offering to join; once joined, the lesson plays full-screen. What happens next depends
// on the session's pace (RsPace, chosen by the tutor when they started it):
//   "driven"    — this child's screen just follows the tutor's step/slide (LessonPlayer's `follow`), no inputs shown
//                 (LessonPlayer's own warm-up/quiz rendering is swapped out server-side... no — client-side, by the
//                 tutor's `driven` slots; THIS screen renders completely normally, just always teleported forward).
//   "lockstep"  — this child answers for real, `follow` + `pace="lockstep"` caps how far ahead of the tutor they can get.
//   "own_pace"  — no `follow` at all: this child moves entirely freely, and while on warm-up/quiz their answer-so-far
//                 is PATCHed (debounced) to the session so the tutor's mini-screens can show it live.
// Poll on an interval AND on every hubLessons realtime ping, since the session is an ordinary hubLessons row.
//
// Drop this wherever a family currently views their lessons (NotesPanel.tsx renders it once, for parents only).

const POLL_MS = 8_000;
const HEARTBEAT_MS = 12_000;
const LIVE_ANSWER_DEBOUNCE_MS = 600;

/** Remembers, per session id, that this child was already in it once — so a reconnect (they closed the lesson, got
 *  disconnected, or reloaded the page) offers "Resume" instead of "Start", which would otherwise read as though
 *  nothing had happened yet. Best-effort: a private window or blocked storage just falls back to "Start". */
const joinedKey = (id: string) => `rs-joined-${id}`;
function hasJoinedBefore(id: string): boolean {
  try { return localStorage.getItem(joinedKey(id)) === "1"; } catch { return false; }
}
function markJoined(id: string) {
  try { localStorage.setItem(joinedKey(id), "1"); } catch { /* ignore */ }
}

export function JoinRemoteSyncBanner({ qs, childId, config }: { qs: string; childId: string | null; config?: HubSettings }) {
  const [active, setActive] = useState<RsActive | null>(null);
  const [joined, setJoined] = useState(false);

  const poll = useCallback(() => {
    if (!childId) return;
    activeRemoteSync(qs).then((a) => setActive(a && a.status === "live" ? a : null)).catch(() => undefined);
  }, [qs, childId]);
  useEffect(() => { poll(); const t = setInterval(poll, POLL_MS); return () => clearInterval(t); }, [poll]);
  useRealtime(["hubLessons"], poll);

  useEffect(() => { if (!active) setJoined(false); }, [active]);

  if (!childId || !active) return null;
  if (!joined) {
    const rejoining = hasJoinedBefore(active.id);
    return (
      <div role="status" data-testid="remote-sync-offer" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-4 py-3 text-[13.5px] font-bold text-[var(--brand-strong)]">
        <span className="min-w-0 flex-1">{rejoining ? `Pick up “${active.title}” where you left off — ` : `Your tutor has started “${active.title}” — `}join now to follow along live.</span>
        <button type="button" onClick={() => { markJoined(active.id); setJoined(true); }} data-testid="remote-sync-join"
          className="min-h-[40px] rounded-full border border-[var(--brand)] bg-[var(--brand)] px-4 text-[13px] font-extrabold text-white hover:brightness-110">{rejoining ? "Resume" : "Start"}</button>
      </div>
    );
  }
  return <JoinedRemoteSync qs={qs} childId={childId} session={active} config={config} onLeft={() => setJoined(false)} />;
}

function JoinedRemoteSync({ qs, childId, session, config, onLeft }: { qs: string; childId: string; session: RsActive; config?: HubSettings; onLeft: () => void }) {
  const [note, setNote] = useState<Note | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [live, setLive] = useState<RsActive>(session);
  // Tools (calculator, ruler, etc.) are for working through the lesson, not the "Start the lesson" cover card —
  // hide the panel until the pupil has actually moved past it.
  const [inLesson, setInLesson] = useState(false);
  // Set the moment the session disappears from underneath them (the tutor ended it, or left broadcasting) — shown
  // as a dialog instead of silently dropping them back out, so it doesn't read as the app just breaking.
  const [tutorLeft, setTutorLeft] = useState(false);
  const sessionId = useRef(session.id);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "My progress" sidebar card: the exact same tile/data shape the tutor's own mini-screens use (see
  // MiniScreenCard) — tracked locally from the same step/slide/answer reports this screen already produces for
  // the tutor, so it can never show something different from what the tutor sees for this child.
  const [myPos, setMyPos] = useState<{ step: string; slide: number; questionId?: string; questionPrompt?: string; response?: unknown; verdict: boolean | null; updatedAt: string }>(
    { step: "start", slide: 0, verdict: null, updatedAt: new Date().toISOString() },
  );

  // "Ask my teacher" thread for this child, for THIS lesson — same hubDoubts data AskTeacher already uses, just
  // also surfaced here as the "My questions" sidebar card.
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const loadDoubts = useCallback(() => {
    listDoubts(qs, { noteId: session.noteId }).then((rows) => setDoubts(rows.filter((d) => d.childId === childId))).catch(() => undefined);
  }, [qs, session.noteId, childId]);
  useEffect(() => { loadDoubts(); const t = setInterval(loadDoubts, 10_000); return () => clearInterval(t); }, [loadDoubts]);
  useRealtime(["hubDoubts"], loadDoubts);
  const onDoubtUpdate = useCallback((next: Doubt) => setDoubts((ds) => ds.map((d) => (d.id === next.id ? next : d))), []);

  useEffect(() => {
    let alive = true;
    get<Note>(`/api/learning-hub/notes/${session.noteId}${qs}`).then((n) => { if (alive) setNote(n); })
      .catch((e) => { if (alive) setNoteErr(errMsg(e, "Couldn't open this lesson")); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.noteId, qs]);

  const refresh = useCallback(() => {
    activeRemoteSync(qs).then((a) => { if (a && a.id === sessionId.current) setLive(a); else setTutorLeft(true); }).catch(() => undefined);
  }, [qs]);
  useRealtime(["hubLessons"], refresh);
  useEffect(() => { if (!tutorLeft) { const t = setInterval(refresh, POLL_MS); return () => clearInterval(t); } }, [refresh, tutorLeft]);

  // "I'm still here": lets the tutor's "X of Y connected" count mean something.
  useEffect(() => {
    const beat = () => void heartbeat(qs, sessionId.current, childId).catch(() => undefined);
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [qs, childId]);

  const [toolsOpen, setToolsOpen] = useState(true);
  // Tool windows spawn from this card's top-right corner; the minimised tray docks at its bottom-left.
  const lessonCardRef = useRef<HTMLDivElement>(null);

  // "own_pace": a debounced, best-effort "here's where I am / what I've got so far" for the tutor's mini-screens —
  // fired on every step/slide change AND every warm-up/quiz answer change (see LessonPlayer's `onLiveAnswer`). Never
  // awaited, never blocks anything — a dropped send just means a stale tile until the next change.
  // Also mirrored into `myPos` (regardless of pace) purely for THIS screen's own "My progress" card — no network
  // effect beyond the existing own_pace debounce below.
  const onLiveAnswer = useCallback((p: LiveAnswerReport) => {
    setMyPos({ step: p.step, slide: p.slide, questionId: p.questionId, questionPrompt: p.questionPrompt, response: p.response, verdict: p.verdict ?? null, updatedAt: new Date().toISOString() });
    if (live.pace !== "own_pace") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void patchLiveAnswer(qs, sessionId.current, childId, p).catch(() => undefined); }, LIVE_ANSWER_DEBOUNCE_MS);
  }, [qs, childId, live.pace]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const onProgress = useCallback((p: { step: string; slide: number }) => {
    setInLesson(p.step !== "start");
    setMyPos((m) => (m.step === p.step && m.slide === p.slide ? m : { step: p.step, slide: p.slide, verdict: null, updatedAt: new Date().toISOString() }));
  }, []);

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-[var(--bg)] text-[var(--ink)]" role="dialog" aria-modal="true" aria-label={`Live lesson: ${session.title}`} data-testid="remote-sync-student">
        <LessonStyles />
        {tutorLeft && (
          <div className="fixed inset-0 z-[310] flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] p-6">
            <div role="alertdialog" aria-modal="true" data-testid="remote-sync-tutor-left" className="w-full max-w-[380px] rounded-2xl bg-[var(--surface)] p-5 text-center shadow-[var(--shadow-pop)]">
              <p className="m-0 text-[15px] font-extrabold text-[var(--ink)]">Your tutor has finished the lesson.</p>
              <button type="button" onClick={onLeft} data-testid="remote-sync-tutor-left-ok"
                className="mt-4 min-h-[44px] w-full rounded-full border border-[var(--brand)] bg-[var(--brand)] px-4 text-[13.5px] font-extrabold text-white hover:brightness-110">OK</button>
            </div>
          </div>
        )}
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px", paddingTop: 96, paddingBottom: 40 }}>
          <div className="grid grid-cols-1 gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0" ref={lessonCardRef}>
              {noteErr ? (
                <p role="alert" className="rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{noteErr}</p>
              ) : !note || !config ? (
                <div className="h-48 animate-pulse rounded-xl bg-[var(--panel)]" />
              ) : (
                <LessonCard key={note.id} note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={childId} config={config}
                  onExit={onLeft}
                  follow={live.pace === "own_pace" ? null : { step: live.step, slide: live.slide }}
                  pace={live.pace}
                  onProgress={onProgress}
                  onLiveAnswer={live.pace === "own_pace" ? onLiveAnswer : undefined}
                  hideAskTeacher />
              )}
            </div>

            <div className="min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:self-start">
              <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">My questions</h3>
              <div className="mb-6">
                <MessagesCard mode="student" qs={qs} doubts={doubts} onUpdate={onDoubtUpdate} collapsible
                  context={{ noteId: session.noteId, lessonTitle: note?.title, step: myPos.step, slide: myPos.slide, questionId: myPos.questionId ?? null, questionPrompt: myPos.questionPrompt ?? null }} />
              </div>

              <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">My progress</h3>
              <div className="mb-6">
                <MiniScreenCard childName="You" connected live={{ childId, childName: "You", ...myPos }} />
              </div>

              {note && (
                <>
                  <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">My homework &amp; flashcards</h3>
                  <div className="mb-6 grid gap-3">
                    <MyHomeworkCard qs={qs} childId={childId} noteId={note.id} />
                    <MyFlashcardsCard qs={qs} childId={childId} topicId={note.topicId} />
                  </div>
                </>
              )}

              {live.tools.length > 0 && inLesson && (
                <div>
                  <button type="button" onClick={() => setToolsOpen((o) => !o)} className="mb-2 flex w-full items-center gap-1.5 text-left" data-testid="remote-sync-tools-collapse">
                    <h3 className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Tools</h3>
                    <Icon name="chevronDown" size={14} className={`text-[var(--ink-3)] transition-transform ${toolsOpen ? "" : "-rotate-90"}`} />
                  </button>
                  <HelpToolsPanel tools={live.tools} suggested={suggestDrawerTools({ subject: "", year: null, title: live.title, unit: "", objective: "" }, live.tools)} lessonCardRef={lessonCardRef} hideList={!toolsOpen} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FullscreenPortal>
  );
}

/** Read-only — the same homework list StudentHome/the Homework tab already show, narrowed to whatever's set
 *  against THIS lesson's note. Submitting stays over on the Homework tab; this is just "is there something for
 *  this lesson" while it's on screen. */
function MyHomeworkCard({ qs, childId, noteId }: { qs: string; childId: string; noteId: string }) {
  const [rows, setRows] = useState<StudentHomework[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    get<StudentHomework[]>(`/api/learning-hub/homework${withQs(qs, {})}`)
      .then((r) => { if (alive) setRows(Array.isArray(r) ? r.filter((h) => h.childId === childId && h.notes.some((n) => n.id === noteId)) : []); })
      .catch((e) => { if (alive) setErr(errMsg(e, "Couldn't load homework")); });
    return () => { alive = false; };
  }, [qs, childId, noteId]);

  return (
    <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: "1px solid #E4E4EE" }} data-testid="my-homework-card">
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #E4E4EE" }}>
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--gold-soft)] text-[color-mix(in_srgb,var(--gold)_55%,#000)]"><Icon name="homework" size={16} /></span>
        <div className="text-[13.5px] font-extrabold text-[var(--ink)]">My homework</div>
      </div>
      <div className="p-4">
        {err ? <p role="alert" className="m-0 text-[12.5px] font-semibold text-[var(--red)]">{err}</p>
          : rows === null ? <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--panel)]" />
          : rows.length === 0 ? <p className="m-0 text-[13px] text-[var(--ink-3)]">Nothing set for this lesson yet.</p>
          : (
            <ul className="m-0 grid list-none gap-2 p-0">
              {rows.map((h) => {
                const st = dueState(h.dueAt, h.submission.status, Date.now());
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)]">{h.title}</span>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-extrabold ${st.tone === "red" ? "bg-[var(--red-soft)] text-[var(--red)]" : st.tone === "green" ? "bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : st.tone === "brand" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--panel)] text-[var(--ink-2)]"}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </div>
  );
}

/** Same due/new counts the Flashcards tab shows, narrowed to this lesson's topic — "Review now" opens the exact
 *  same review session (ReviewSession), floating over the lesson like a tool card so nothing about the lesson
 *  itself is disturbed. */
function MyFlashcardsCard({ qs, childId, topicId }: { qs: string; childId: string; topicId: string | null }) {
  const [data, setData] = useState<DueResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<QueueCard[] | null>(null);

  const load = useCallback(() => {
    if (!topicId) { setData({ due: [], dueCount: 0, newCount: 0, upcoming: 0 }); return; }
    get<DueResponse>(`/api/learning-hub/flashcards/due${withQs(qs, { childId, topicId })}`)
      .then(setData)
      .catch((e) => setErr(errMsg(e, "Couldn't load flashcards")));
  }, [qs, childId, topicId]);
  useEffect(() => { load(); }, [load]);

  const count = (data?.dueCount ?? 0) + (data?.newCount ?? 0);
  const total = (data?.dueCount ?? 0) + (data?.newCount ?? 0) + (data?.upcoming ?? 0);
  const pct = (n: number) => (total ? Math.max(n > 0 ? 4 : 0, (n / total) * 100) : 0);

  return (
    <>
      <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: "1px solid #E4E4EE" }} data-testid="my-flashcards-card">
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid #E4E4EE" }}>
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--violet-soft)] text-[var(--violet)]"><Icon name="cards" size={16} /></span>
          <div className="text-[13.5px] font-extrabold text-[var(--ink)]">My flashcards</div>
        </div>
        <div className="p-4">
          {err ? <p role="alert" className="m-0 text-[12.5px] font-semibold text-[var(--red)]">{err}</p>
            : !data ? <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--panel)]" />
            : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-[13px] text-[var(--ink-2)]">
                    {count === 0 ? "No cards ready for this lesson yet." : `${count} card${count === 1 ? "" : "s"} ready for this lesson.`}
                  </p>
                  {!!data.due.length && (
                    <button type="button" onClick={() => setReviewing(data.due)} data-testid="my-flashcards-review"
                      className="flex-none min-h-[36px] rounded-full border border-[var(--brand)] px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)]">Review now</button>
                  )}
                </div>
                {total > 0 && (
                  <>
                    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--panel)]">
                      <span style={{ width: `${pct(data.dueCount)}%`, background: "#F59E0B" }} title={`${data.dueCount} due`} />
                      <span style={{ width: `${pct(data.newCount)}%`, background: "var(--violet)" }} title={`${data.newCount} new`} />
                      <span style={{ width: `${pct(data.upcoming)}%`, background: "var(--hub-green-ink)" }} title={`${data.upcoming} mastered / scheduled later`} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold text-[var(--ink-3)]">
                      <span><span aria-hidden style={{ color: "#F59E0B" }}>●</span> {data.dueCount} due</span>
                      <span><span aria-hidden className="text-[var(--violet)]">●</span> {data.newCount} new</span>
                      <span><span aria-hidden className="text-[var(--hub-green-ink)]">●</span> {data.upcoming} learned</span>
                    </div>
                  </>
                )}
              </>
            )}
        </div>
      </div>
      {reviewing && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] p-4">
          <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-[var(--bg)] p-4 sm:p-6">
            <ReviewSession cards={reviewing} qs={qs} childId={childId}
              onFinished={() => { setReviewing(null); load(); }}
              onError={setErr} />
          </div>
        </div>
      )}
    </>
  );
}

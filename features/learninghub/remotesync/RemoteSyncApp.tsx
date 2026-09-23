"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { useRealtime } from "@/lib/realtime";
import { Icon } from "../kit";
import type { WarmupQuestion } from "../lesson/api";
import { LessonPlayer } from "../lesson/LessonPlayer";
import { LessonStyles } from "../lesson/lessonUi";
import { FOCUS, FullscreenPortal, StudentPicker } from "../teachKit";
import { errMsg, type Note, type Student } from "../types";
import { RemoteDrivenQuizGrid } from "./RemoteDrivenQuiz";
import { RemoteDrivenWarmupExtra } from "./RemoteDrivenWarmup";
import { endRemoteSync, getRemoteSync, patchProgress, startRemoteSync, type RsPace, type RsSession } from "./api";

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
  const [childIds, setChildIds] = useState<string[]>([]);
  const [pace, setPace] = useState<RsPace>("own_pace");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey());

  useEffect(() => {
    let alive = true;
    get<Student[]>(`/api/learning-hub/students${qs}`).then((r) => { if (alive) setStudents(Array.isArray(r) ? r.filter((s) => s.active !== false) : []); })
      .catch((e) => { if (alive) { setStudents([]); setErr(errMsg(e, "Couldn't load your students")); } });
    return () => { alive = false; };
  }, [qs]);

  const start = async () => {
    if (!childIds.length) { setErr("Choose at least one student"); return; }
    setBusy(true); setErr(null);
    try {
      const s = await startRemoteSync(qs, { noteId, childIds, title, key: key.current, pace });
      key.current = newKey();
      setSession(s);
    } catch (e) { setErr(errMsg(e, "Couldn't start the lesson")); }
    finally { setBusy(false); }
  };

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-[var(--bg)] text-[var(--ink)]" role="dialog" aria-modal="true" aria-label="Start lesson now (remote)" data-testid="remote-sync-app">
        <LessonStyles />
        {session ? (
          <TutorRunner key={session.id} qs={qs} config={config} initial={session} onClose={onClose} />
        ) : (
          <div className="mx-auto w-full max-w-[680px] p-3 sm:p-6">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-[18px] font-extrabold text-[var(--ink)]">Start lesson now (remote)</h2>
                  <p className="m-0 mt-1 text-[13px] text-[var(--ink-2)]">“{title}” — no video call. Each student opens it on their own device.</p>
                </div>
                <button type="button" onClick={onClose} className={`min-h-[44px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--ink)] hover:border-[var(--ink-3)] ${FOCUS}`}>Cancel</button>
              </div>
              {err && <p role="alert" className="mt-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
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
              <button type="button" onClick={() => void start()} disabled={busy || !students || !childIds.length} data-testid="remote-sync-start"
                className={`mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--brand)] bg-[var(--brand)] px-6 text-[15px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-50 ${FOCUS}`}>
                {busy ? "Starting…" : "Start now"}
              </button>
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
  const [ending, setEnding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const onProgress = useCallback((p: { step: string; slide: number }) => {
    // The tutor already knows their own step — update locally right away rather than waiting on the network
    // round-trip (SSE / the 10s poll) to reflect it back, so mini-screens etc. don't lag behind what's on screen.
    setSess((s) => (s.step === p.step && s.slide === p.slide ? s : { ...s, step: p.step, slide: p.slide }));
    void patchProgress(qs, initial.id, p.step, p.slide).catch(() => undefined);
  }, [qs, initial.id]);

  const end = async () => {
    setEnding(true); setErr(null);
    try { await endRemoteSync(qs, initial.id); onClose(); }
    catch (e) { setErr(errMsg(e, "Couldn't end the lesson")); setEnding(false); }
  };

  const connectedLabel = `${sess.connectedCount} of ${sess.totalCount} connected`;
  const pace = sess.pace;
  const connectedRoster = useMemo(() => sess.students.filter((s) => s.connected).map((s) => ({ childId: s.childId, childName: s.childName })), [sess.students]);
  const fullRoster = useMemo(() => sess.students.map((s) => ({ childId: s.childId, childName: s.childName, connected: s.connected })), [sess.students]);
  const showMiniScreens = pace === "own_pace" && (sess.step === "warm" || sess.step === "quiz");

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

  return (
    <div className="mx-auto w-full max-w-[820px] p-3 sm:p-6">
      <div role="status" data-testid="remote-sync-status" className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--brand-strong)]">
        <Icon name="users" size={15} />
        <span className="flex-1">{banner}</span>
        <span data-testid="remote-sync-connected" className="rounded-full bg-white/60 px-2.5 py-1 text-[12px] font-extrabold text-[var(--brand-strong)]">{connectedLabel}</span>
        <button type="button" onClick={() => void end()} disabled={ending} data-testid="remote-sync-end"
          className={`min-h-[36px] rounded-lg border border-[var(--red)] bg-[var(--surface)] px-3 text-[12.5px] font-extrabold text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}>{ending ? "Ending…" : "End lesson"}</button>
      </div>
      {err && <p role="alert" className="mb-3 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
      {sess.students.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-1.5" aria-label="Students in this lesson">
          {sess.students.map((s) => (
            <li key={s.childId} data-ui="card" data-connected={s.connected ? "1" : "0"}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${s.connected ? "border-[var(--green-line)] bg-[var(--green-soft)] text-[var(--green)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-3)]"}`}>
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.connected ? "bg-current" : "bg-[var(--ink-3)]"}`} />
              {s.childName}
            </li>
          ))}
        </ul>
      )}
      {showMiniScreens && <MiniScreens roster={fullRoster} liveAnswers={sess.liveAnswers} />}
      {noteErr ? (
        <p role="alert" className="rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{noteErr}</p>
      ) : !note ? (
        <div className="h-48 animate-pulse rounded-xl bg-[var(--panel)]" />
      ) : pace === "driven" ? (
        <LessonPlayer key={note.id} note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={null} config={config}
          readOnly onExit={() => void end()} onProgress={onProgress}
          driven={{
            banner: drivenBanner,
            warmupExtra: (q: WarmupQuestion) => <RemoteDrivenWarmupExtra q={q} noteId={note.id} qs={qs} roster={connectedRoster} config={config} />,
            quiz: (p) => <RemoteDrivenQuizGrid qs={qs} roster={connectedRoster} quiz={p.quiz} config={config} onBack={p.onBack} onFinish={p.onFinish} />,
          }} />
      ) : (
        <LessonPlayer key={note.id} note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={null} config={config}
          readOnly onExit={() => void end()} onProgress={onProgress} />
      )}
    </div>
  );
}

/** "own_pace": a small live tile per connected child, while the class is on warm-up/quiz — what they currently have
 *  selected/typed for the question they're on. Not marked, not recorded; purely a live read (GET session → liveAnswers). */
function MiniScreens({ roster, liveAnswers }: { roster: { childId: string; childName: string; connected: boolean }[]; liveAnswers: RsSession["liveAnswers"] }) {
  if (!roster.length) return null;
  const byChild = new Map(liveAnswers.map((a) => [a.childId, a]));
  return (
    <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" data-testid="remote-sync-mini-screens">
      <h3 className="m-0 mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Live — what each student has so far</h3>
      <div className="flex flex-wrap gap-2">
        {roster.map((c) => {
          const a = byChild.get(c.childId);
          const text = a ? previewOf(a.response) : null;
          return (
            <div key={c.childId} data-ui="card" className={`min-w-[140px] max-w-[220px] flex-1 rounded-lg border px-3 py-2 ${c.connected ? "border-[var(--line)] bg-[var(--surface)]" : "border-dashed border-[var(--line)] bg-[var(--panel)] opacity-70"}`}>
              <div className="truncate text-[12px] font-extrabold text-[var(--ink)]">{c.childName}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-[var(--ink-2)]">{!c.connected ? "Not joined yet…" : text ?? "Nothing yet…"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const previewOf = (r: unknown): string => {
  if (typeof r === "string") return r || "…";
  if (typeof r === "number") return String(r);
  if (Array.isArray(r)) return r.length ? `${r.length} selected` : "…";
  return "…";
};

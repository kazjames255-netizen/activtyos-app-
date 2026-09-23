"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { useRealtime } from "@/lib/realtime";
import { FullscreenPortal } from "../teachKit";
import { LessonPlayer } from "../lesson/LessonPlayer";
import { LessonStyles } from "../lesson/lessonUi";
import { errMsg, type Note } from "../types";
import { activeRemoteSync, heartbeat, patchLiveAnswer, type RsActive } from "./api";

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
    return (
      <div role="status" data-testid="remote-sync-offer" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-4 py-3 text-[13.5px] font-bold text-[var(--brand-strong)]">
        <span className="min-w-0 flex-1">Your tutor has started “{active.title}” — join now to follow along live.</span>
        <button type="button" onClick={() => setJoined(true)} data-testid="remote-sync-join"
          className="min-h-[40px] rounded-full border border-[var(--brand)] bg-[var(--brand)] px-4 text-[13px] font-extrabold text-white hover:brightness-110">Join</button>
      </div>
    );
  }
  return <JoinedRemoteSync qs={qs} childId={childId} session={active} config={config} onLeft={() => setJoined(false)} />;
}

function JoinedRemoteSync({ qs, childId, session, config, onLeft }: { qs: string; childId: string; session: RsActive; config?: HubSettings; onLeft: () => void }) {
  const [note, setNote] = useState<Note | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [live, setLive] = useState<RsActive>(session);
  const sessionId = useRef(session.id);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    get<Note>(`/api/learning-hub/notes/${session.noteId}${qs}`).then((n) => { if (alive) setNote(n); })
      .catch((e) => { if (alive) setNoteErr(errMsg(e, "Couldn't open this lesson")); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.noteId, qs]);

  const refresh = useCallback(() => {
    activeRemoteSync(qs).then((a) => { if (a && a.id === sessionId.current) setLive(a); else onLeft(); }).catch(() => undefined);
  }, [qs, onLeft]);
  useRealtime(["hubLessons"], refresh);
  useEffect(() => { const t = setInterval(refresh, POLL_MS); return () => clearInterval(t); }, [refresh]);

  // "I'm still here": lets the tutor's "X of Y connected" count mean something.
  useEffect(() => {
    const beat = () => void heartbeat(qs, sessionId.current, childId).catch(() => undefined);
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [qs, childId]);

  // "own_pace": a debounced, best-effort "here's what I've got so far" for the tutor's mini-screens. Never awaited,
  // never blocks anything — a dropped send just means a stale tile until the next change.
  const onLiveAnswer = useCallback((p: { step: "warm" | "quiz"; questionId: string; response: unknown }) => {
    if (live.pace !== "own_pace") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void patchLiveAnswer(qs, sessionId.current, childId, p.questionId, p.response).catch(() => undefined); }, LIVE_ANSWER_DEBOUNCE_MS);
  }, [qs, childId, live.pace]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <FullscreenPortal>
      <div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain bg-[var(--bg)] text-[var(--ink)]" role="dialog" aria-modal="true" aria-label={`Live lesson: ${session.title}`} data-testid="remote-sync-student">
        <LessonStyles />
        <div className="mx-auto w-full max-w-[820px] p-3 sm:p-6">
          {noteErr ? (
            <p role="alert" className="rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{noteErr}</p>
          ) : !note || !config ? (
            <div className="h-48 animate-pulse rounded-xl bg-[var(--panel)]" />
          ) : (
            <LessonPlayer key={note.id} note={{ id: note.id, title: note.title, lesson: note.lesson }} qs={qs} childQs={qs} childId={childId} config={config}
              onExit={onLeft}
              follow={live.pace === "own_pace" ? null : { step: live.step, slide: live.slide }}
              pace={live.pace}
              onLiveAnswer={live.pace === "own_pace" ? onLiveAnswer : undefined} />
          )}
        </div>
      </div>
    </FullscreenPortal>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtime } from "@/lib/realtime";
import { requestOpenLesson } from "../hubIntent";
import { FOCUS } from "../kit";
import { endRemoteSync, listLiveRemoteSync, type RsSession } from "./api";

const POLL_MS = 15_000;
/** How long "Undo" stays available before the End call is actually sent (no confirm dialog; see P-01). */
const UNDO_MS = 6_000;

/** Tutor side of "Start lesson now (remote)": a persistent "you're broadcasting — rejoin" strip so leaving the
 *  Live lessons tab (or refreshing) doesn't lose the class — mirrors the family's JoinRemoteSyncBanner. Drop this
 *  wherever a tutor might land while a session of theirs is still live (the Lessons tab, Home). Clicking Rejoin
 *  opens that lesson in the Lessons tab, where "Go live" already offers "Resume broadcasting" for a session
 *  still marked live (RemoteSyncApp's own `listLiveRemoteSync` check). */
export function TutorLiveBanner({ qs, goTo }: { qs: string; goTo?: (tab: "notes") => void }) {
  const [live, setLive] = useState<RsSession[]>([]);
  // Session id currently in its "Undo" window, the pending timer, and any error from the End call.
  const [ending, setEnding] = useState<{ id: string; title: string } | null>(null);
  const [endErr, setEndErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingId = useRef<string | null>(null);
  // Leaving the tab (unmount) inside the Undo window must still END the lesson, never silently cancel it (safeguarding).
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pendingId.current) { const id = pendingId.current; pendingId.current = null; endRemoteSync(qs, id).catch(() => undefined); }
  }, [qs]);

  const poll = useCallback(() => { listLiveRemoteSync(qs).then((r) => setLive(Array.isArray(r) ? r : [])).catch(() => undefined); }, [qs]);
  useEffect(() => { poll(); const t = setInterval(poll, POLL_MS); return () => clearInterval(t); }, [poll]);
  useRealtime(["hubLessons"], poll);

  const endNow = (id: string) => {
    timer.current = null; pendingId.current = null;
    endRemoteSync(qs, id).then(() => { setEnding(null); poll(); }).catch(() => { setEnding(null); setEndErr("Couldn't end the lesson. Please try again."); });
  };
  const endLesson = (id: string, title: string) => {
    setEndErr(null); setEnding({ id, title }); pendingId.current = id;
    timer.current = setTimeout(() => endNow(id), UNDO_MS);
  };
  const undo = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; pendingId.current = null; setEnding(null); };

  if (ending) {
    return (
      <div role="status" data-testid="tutor-live-ended" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[13.5px] font-bold text-[var(--ink)]">
        <span className="min-w-0 flex-1">Ending “{ending.title}” for everyone…</span>
        <button type="button" onClick={undo} data-testid="tutor-live-undo"
          className={`min-h-[44px] rounded-full border border-[var(--ink-2)] px-4 text-[13px] font-extrabold ${FOCUS}`}>Undo</button>
      </div>
    );
  }
  if (!live.length) return null;
  const s = live[0]!;

  const rejoin = () => { goTo?.("notes"); requestOpenLesson(s.noteId, "live"); };

  return (
    <div role="status" data-testid="tutor-live-banner" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--green-line)] bg-[var(--green-soft)] px-4 py-3 text-[13.5px] font-bold text-[var(--hub-green-ink)]">
      <span className="min-w-0 flex-1">You're broadcasting “{s.title}” — {s.connectedCount} of {s.totalCount} connected{live.length > 1 ? ` (+${live.length - 1} more live)` : ""}.</span>
      <button type="button" onClick={rejoin} data-testid="tutor-live-rejoin"
        className="min-h-[40px] rounded-full border border-[#0a6b3d] bg-[#0a6b3d] px-4 text-[13px] font-extrabold text-white hover:brightness-110">Rejoin</button>
      <button type="button" onClick={() => endLesson(s.id, s.title)} data-testid="tutor-live-end"
        className={`min-h-[44px] rounded-full border border-[#0a6b3d] bg-transparent px-4 text-[13px] font-extrabold text-[var(--hub-green-ink)] ${FOCUS}`}>End lesson</button>
      {endErr && <span role="alert" className="basis-full text-[12.5px] font-semibold text-[var(--red)]">{endErr}</span>}
    </div>
  );
}

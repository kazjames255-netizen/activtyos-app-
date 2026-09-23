"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/realtime";
import { requestOpenLesson } from "../hubIntent";
import { listLiveRemoteSync, type RsSession } from "./api";

const POLL_MS = 15_000;

/** Tutor side of "Start lesson now (remote)": a persistent "you're broadcasting — rejoin" strip so leaving the
 *  Live lessons tab (or refreshing) doesn't lose the class — mirrors the family's JoinRemoteSyncBanner. Drop this
 *  wherever a tutor might land while a session of theirs is still live (the Lessons tab, Home). Clicking Rejoin
 *  opens that lesson in the Lessons tab, where "Go live" already offers "Resume broadcasting" for a session
 *  still marked live (RemoteSyncApp's own `listLiveRemoteSync` check). */
export function TutorLiveBanner({ qs, goTo }: { qs: string; goTo?: (tab: "notes") => void }) {
  const [live, setLive] = useState<RsSession[]>([]);

  const poll = useCallback(() => { listLiveRemoteSync(qs).then((r) => setLive(Array.isArray(r) ? r : [])).catch(() => undefined); }, [qs]);
  useEffect(() => { poll(); const t = setInterval(poll, POLL_MS); return () => clearInterval(t); }, [poll]);
  useRealtime(["hubLessons"], poll);

  if (!live.length) return null;
  const s = live[0]!;

  const rejoin = () => { goTo?.("notes"); requestOpenLesson(s.noteId, "live"); };

  return (
    <div role="status" data-testid="tutor-live-banner" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--green-line)] bg-[var(--green-soft)] px-4 py-3 text-[13.5px] font-bold text-[var(--hub-green-ink)]">
      <span className="min-w-0 flex-1">You're broadcasting “{s.title}” — {s.connectedCount} of {s.totalCount} connected{live.length > 1 ? ` (+${live.length - 1} more live)` : ""}.</span>
      <button type="button" onClick={rejoin} data-testid="tutor-live-rejoin"
        className="min-h-[40px] rounded-full border border-[#0a6b3d] bg-[#0a6b3d] px-4 text-[13px] font-extrabold text-white hover:brightness-110">Rejoin</button>
    </div>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../../panelTypes";
import { errMsg, topicLabel, type Note, type NoteLite } from "../../types";
import { FOCUS, Pill, Skeleton, withQs } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { LessonPlayer } from "../../lesson/LessonPlayer";
import { getCall, useCallObject, type CallLike } from "../board/callObject";
import type { Lesson } from "../lessonTypes";
import { PaneOverlay, WsButton, WsSection } from "./wsKit";
import { lessonCovered } from "./wsLib";

// Teaching an INTERACTIVE lesson (slides, key words, warm-up, exit quiz) inside the call.
//
// The tutor presses "Teach" on a lesson in the Lessons tab: the lesson player opens in the workspace pane beside the video, and
// every step / slide they move to is sent to the room, so each student's own player follows along. A student can also open any
// interactive lesson from the list ("Open") and work through it on their own, or step off the tutor's screen ("Go at my own pace").
//
// Transport: the SAME Daily app-message channel the whiteboard uses, through its public API only (callObject's getCall /
// useCallObject), under our own marker `ls: 1` so the board's messages and these never touch. Only the room OWNER (the tutor's
// token, as Daily itself reports it) can make a student's screen follow — a student cannot drive another student.
// Nothing here computes domain rules: the player, the questions and the marking are the hub's own, server-side.

interface LsMsg { ls: 1; on?: boolean; noteId?: string; title?: string; step?: string; slide?: number; req?: 1 }
interface Shared { noteId: string; title: string; step: string; slide: number }

type Session = { noteId: string; title: string; note: Note | null; error: string | null; drive: boolean; following: boolean; /** The student stepped off the tutor's screen. */ followPaused?: boolean };

interface Ctx { teach: (id: string, title: string) => void; open: (id: string, title: string) => void; activeId: string | null; isTutor: boolean; /** A student: the tutor is teaching a lesson (being followed, or offered) — the room uses it to open a collapsed workspace. */ tutorTeaching: boolean }
const LsCtx = createContext<Ctx>({ teach: () => {}, open: () => {}, activeId: null, isTutor: false, tutorTeaching: false });
export const useLessonShare = () => useContext(LsCtx);

const isOwnerId = (c: CallLike | null, id?: string) => { try { return !!id && !!c?.participants()?.[id]?.owner; } catch { return false; } };
const send = (c: CallLike | null, m: LsMsg, to?: string) => { try { c?.sendAppMessage(m, to ?? "*"); } catch { /* not connected yet: the next step re-sends */ } };

/** Wraps the whole workspace: owns the (single) lesson overlay and the room link for it. */
export function LessonShareProvider({ p, isTutor, children }: { p: PanelProps; isTutor: boolean; children: ReactNode }) {
  const call = useCallObject();
  const [session, setSession] = useState<Session | null>(null);
  const [offer, setOffer] = useState<Shared | null>(null);
  const [follow, setFollow] = useState<{ step: string; slide: number } | null>(null);
  const sharing = useRef<Shared | null>(null); // tutor: what the room is being shown right now
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const noteQs = isTutor ? p.qs : (p.childQs ?? p.qs);

  const load = useCallback(async (noteId: string, title: string, drive: boolean, following: boolean) => {
    const first: Session = { noteId, title, note: null, error: null, drive, following };
    sessionRef.current = first; // (two room messages can land before React re-renders: the second must see this one)
    setSession(first);
    try {
      const n = await get<Note>(`/api/learning-hub/notes/${noteId}${withQs(noteQs, {})}`);
      if (!n.lesson) throw new Error("This lesson has no interactive part.");
      setSession((s) => (s && s.noteId === noteId ? { ...s, note: n, title: n.title || title } : s));
    } catch (e) {
      setSession((s) => (s && s.noteId === noteId ? { ...s, error: errMsg(e, "Couldn't open this lesson") } : s));
    }
  }, [noteQs]);

  const teach = useCallback((id: string, title: string) => {
    if (!isTutor) return;
    sharing.current = { noteId: id, title, step: "start", slide: 0 };
    send(getCall(), { ls: 1, on: true, noteId: id, title, step: "start", slide: 0 });
    void load(id, title, true, false);
  }, [isTutor, load]);
  const open = useCallback((id: string, title: string) => { void load(id, title, false, false); }, [load]);

  const close = useCallback(() => {
    const s = sessionRef.current;
    if (s?.drive) { sharing.current = null; send(getCall(), { ls: 1, on: false }); }
    setSession(null); setFollow(null);
  }, []);

  // Room messages. Tutor: answer a late joiner's "what are we on?". Student: follow the tutor (owner-only).
  useEffect(() => {
    if (!call) return;
    const onMsg = (ev: { fromId?: string; data?: unknown }) => {
      const d = ev?.data as LsMsg | undefined;
      if (!d || d.ls !== 1 || !ev.fromId) return;
      if (isTutor) {
        if (d.req && sharing.current) send(call, { ls: 1, on: true, ...sharing.current }, ev.fromId);
        return;
      }
      if (!isOwnerId(call, ev.fromId)) return; // a classmate's device can't make anyone's screen jump
      if (d.on === false) { sharing.current = null; setOffer(null); setSession((s) => (s && s.following ? { ...s, following: false } : s)); setFollow(null); return; }
      if (d.on && d.noteId) {
        const shared: Shared = { noteId: d.noteId, title: d.title ?? "Lesson", step: d.step ?? "start", slide: d.slide ?? 0 };
        sharing.current = shared;
        const s = sessionRef.current;
        if (!s || s.noteId === shared.noteId) {
          setOffer(null);
          setFollow({ step: shared.step, slide: shared.slide });
          if (!s) void load(shared.noteId, shared.title, false, true);
          else if (!s.following && s.noteId === shared.noteId && s.followPaused !== true) setSession({ ...s, following: true });
        } else setOffer(shared); // they are busy with a different lesson: offer, don't yank
      }
    };
    // Tutor: someone new walked in — tell them what's on screen. Student: ask once we're really in the room (joined late? what is the tutor showing?).
    const onJoined = (ev: { participant?: { session_id?: string; local?: boolean } }) => {
      if (isTutor && sharing.current && ev?.participant?.session_id && !ev.participant.local) send(call, { ls: 1, on: true, ...sharing.current }, ev.participant.session_id);
    };
    const askNow = () => send(call, { ls: 1, req: 1 });
    call.on("app-message", onMsg as never);
    call.on("participant-joined", onJoined as never);
    if (!isTutor) {
      call.on("joined-meeting", askNow);
      try { if (call.meetingState?.() === "joined-meeting") askNow(); } catch { /* not ready */ }
    }
    return () => { try { call.off("app-message", onMsg as never); call.off("participant-joined", onJoined as never); call.off("joined-meeting", askNow); } catch { /* gone */ } };
  }, [call, isTutor, load]);

  // Tutor: every step / slide the teaching player reports goes to the room.
  const onProgress = useCallback((pr: { step: string; slide: number }) => {
    const s = sessionRef.current;
    if (!s?.drive || !sharing.current) return;
    sharing.current = { ...sharing.current, step: pr.step, slide: pr.slide };
    send(getCall(), { ls: 1, on: true, ...sharing.current });
  }, []);

  const tutorTeaching = !isTutor && (!!offer || !!session?.following);
  const api = useMemo<Ctx>(() => ({ teach, open, activeId: session?.noteId ?? null, isTutor, tutorTeaching }), [teach, open, session?.noteId, isTutor, tutorTeaching]);
  const s = session;

  return (
    <LsCtx.Provider value={api}>
      {children}
      {offer && !isTutor && (
        <PaneOverlay>
          <div role="status" data-testid="ls-offer" className="absolute inset-x-3 top-3 z-30 flex items-center gap-2 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--brand-strong)] shadow-[var(--shadow-sm)]">
            <span className="min-w-0 flex-1 truncate">Your tutor is teaching “{offer.title}”</span>
            <WsButton variant="solid" onClick={() => { const o = offer; setOffer(null); setFollow({ step: o.step, slide: o.slide }); void load(o.noteId, o.title, false, true); }}>Join</WsButton>
          </div>
        </PaneOverlay>
      )}
      {s && (
        <PaneOverlay>
          <div role="dialog" aria-label={`${s.drive ? "Teaching" : "Lesson"}: ${s.title}`} data-testid="ws-lesson-player" data-drive={s.drive ? "1" : "0"} data-following={s.following ? "1" : "0"}
            className="absolute inset-0 z-20 flex flex-col overflow-y-auto overscroll-contain px-3 pb-6 pt-3" style={{ background: "var(--hub-warm)" }}>
            {s.drive && <div role="status" className="mx-auto mb-2 flex w-full max-w-[820px] flex-none items-center gap-2 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--brand-strong)]"><Ico name="monitor" size={14} />Teaching — your students&apos; screens follow this lesson as you move through it.</div>}
            {s.following && <div role="status" data-testid="ls-following" className="mx-auto mb-2 flex w-full max-w-[820px] flex-none items-center gap-2 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--brand-strong)]"><Ico name="monitor" size={14} /><span className="min-w-0 flex-1">Following your tutor</span><button type="button" onClick={() => { setFollow(null); setSession((x) => (x ? { ...x, following: false, followPaused: true } : x)); }} className={`min-h-[36px] rounded-lg px-2.5 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--surface)] ${FOCUS}`}>Go at my own pace</button></div>}
            {s.error ? (
              <div role="alert" className="mx-auto grid max-w-[420px] gap-3 py-10 text-center"><div className="text-[14px] font-bold text-[var(--red)]">{s.error}</div><div><WsButton variant="ghost" onClick={close}>Close</WsButton></div></div>
            ) : !s.note ? (
              <div className="mx-auto grid w-full max-w-[820px] gap-3" role="status" aria-label="Opening the lesson"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>
            ) : (
              <LessonPlayer key={s.note.id} note={{ id: s.note.id, title: s.note.title, lesson: s.note.lesson }} qs={noteQs} childQs={noteQs} childId={isTutor ? null : p.childId} config={p.config}
                readOnly={isTutor} onExit={close} onProgress={s.drive ? onProgress : undefined} follow={s.following ? follow : null} />
            )}
          </div>
        </PaneOverlay>
      )}
    </LsCtx.Provider>
  );
}

/** "Interactive lessons" — the lessons attached to this live lesson (and its topic's) that have slides / warm-up / a quiz. */
export function TeachableLessons({ p, lesson }: { p: PanelProps; lesson: Lesson }) {
  const { teach, open, activeId, isTutor } = useLessonShare();
  const [rows, setRows] = useState<NoteLite[] | null>(null);
  const qs = isTutor ? p.qs : (p.childQs ?? p.qs);
  const idsKey = (lesson.noteIds ?? []).join(",");
  const covered = lessonCovered(p.topics, lesson);
  const topic = p.topics.find((t) => t.id === lesson.topicId) ?? null;

  const load = useCallback(() => {
    const attached = idsKey ? get<NoteLite[]>(`/api/learning-hub/notes${withQs(qs, { ids: idsKey })}`).catch(() => [] as NoteLite[]) : Promise.resolve([] as NoteLite[]);
    const inTopic = lesson.topicId ? get<NoteLite[]>(`/api/learning-hub/notes${withQs(qs, { topicId: lesson.topicId })}`).catch(() => [] as NoteLite[]) : Promise.resolve([] as NoteLite[]);
    void Promise.all([attached, inTopic]).then(([a, t]) => {
      const seen = new Set<string>();
      const all = [...(Array.isArray(a) ? a : []), ...(Array.isArray(t) ? t : [])].filter((n) => n.isLesson && !seen.has(n.id) && (seen.add(n.id), true));
      setRows(all);
    });
  }, [qs, idsKey, lesson.topicId]);
  useEffect(load, [load]);
  useRealtime(["hubNotes"], load);

  const attachedIds = useMemo(() => new Set(idsKey ? idsKey.split(",") : []), [idsKey]);
  const shown = useMemo(() => {
    const list = (rows ?? []).filter((n) => attachedIds.has(n.id) || !covered || covered.has(n.topicId));
    return [...list.filter((n) => attachedIds.has(n.id)), ...list.filter((n) => !attachedIds.has(n.id)).slice(0, 8)];
  }, [rows, attachedIds, covered]);

  if (rows === null) return isTutor || idsKey ? <div className="grid gap-2"><Skeleton className="h-11" /></div> : null;
  if (!shown.length) return null;
  return (
    <WsSection title={isTutor ? "Teach an interactive lesson" : "Interactive lessons"} icon="notes" aside={topic ? <Pill tone="brand">{topicLabel(topic)}</Pill> : null}>
      <div className="grid gap-2" data-testid="ws-interactive-lessons">
        {isTutor && <p className="m-0 text-[12px] leading-relaxed text-[var(--ink-3)]">Opens beside the video. Students&apos; screens follow you slide by slide.</p>}
        {shown.map((n) => (
          <div key={n.id} data-note={n.id} className="flex items-center gap-2 rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-extrabold text-[var(--ink)]">{n.title}</span>
              {attachedIds.has(n.id) && <span className="block text-[11px] text-[var(--ink-3)]">{isTutor ? "Attached to this live lesson" : "Attached by your tutor"}</span>}
            </span>
            {!n.published && <Pill tone="gold">Draft</Pill>}
            {isTutor
              ? <WsButton variant="solid" icon="monitor" onClick={() => teach(n.id, n.title)} ariaLabel={`Teach ${n.title}`} disabled={activeId === n.id}>Teach</WsButton>
              : <WsButton variant="soft" icon="monitor" onClick={() => open(n.id, n.title)} ariaLabel={`Open ${n.title}`} disabled={activeId === n.id || !p.childId}>Open</WsButton>}
          </div>
        ))}
      </div>
    </WsSection>
  );
}

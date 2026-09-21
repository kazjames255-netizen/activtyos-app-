"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, get, post } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { FullscreenPortal, withQs } from "../teachKit";
import { CallRoom, type CallPlacement, type StageState } from "./LessonStage";
import type { JoinPrefs } from "./Lobby";
import { classifyJoinError, type JoinInfo, type Lesson } from "./lessonTypes";
import { Workspace } from "./workspace/Workspace";
import { TabBoundary } from "./workspace/TabBoundary";
import { useCallObject } from "./board/callObject";
import { useFamily } from "../family/FamilyContext";

// The call lives ABOVE the tab panels (the hub shell renders <CallProvider>
// around them), so it survives navigating between hub tabs: the video frame is
// never re-parented. One layer element, one CallRoom; only the layer's CSS box
// changes —
//   inline  → sized to a placeholder ("slot") the Live lessons tab renders in the page
//   full    → the whole screen (the presentation view)
//   mini    → a small floating window bottom-right ("Return to call")
// The user's inline/full choice is remembered (localStorage, per viewer).

const PREFS_KEY = "hub-join-prefs";
const PLACE_KEY = "hub-call-placement";
export function loadPrefs(): JoinPrefs {
  try { const r = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<JoinPrefs> | null; if (r) return { camOn: r.camOn !== false, micOn: r.micOn !== false }; } catch { /* storage blocked */ }
  return { camOn: true, micOn: true };
}
const loadPlacement = (): "inline" | "full" => { try { return localStorage.getItem(PLACE_KEY) === "full" ? "full" : "inline"; } catch { return "inline"; } };
const asList = (r: unknown): Lesson[] => (Array.isArray(r) ? (r as Lesson[]) : Array.isArray((r as { lessons?: Lesson[] } | null)?.lessons) ? (r as { lessons: Lesson[] }).lessons : []);

interface Session { lessonId: string; snapshot: Lesson; stage: StageState }

export interface CallApi {
  /** The lesson the user is in a call for (null = no call). */
  activeId: string | null;
  activeTitle: string | null;
  /** Connecting to the lesson right now (disables its Join buttons). */
  joiningId: string | null;
  /** Where the call is showing: in the page, full screen, or the small floating window. */
  mode: CallPlacement | null;
  minimized: boolean;
  /** A call is open and the user wants it in the page (not full screen, not minimised). */
  inline: boolean;
  prefs: JoinPrefs;
  /** Join `lesson`. A family with several children in it may name which one is joining (the lobby's picker); the hub then follows that child. */
  start: (lesson: Lesson, prefs?: JoinPrefs, asChildId?: string) => void;
  restore: () => void;
  /** The live lessons tab is mounted → an inline call can sit in its slot. Returns the cleanup. */
  attachHost: () => () => void;
  slotRef: (el: HTMLElement | null) => void;
}
const Ctx = createContext<CallApi | null>(null);
export const useCall = () => useContext(Ctx);

export function CallProvider({ p, children }: { p: PanelProps; children: ReactNode }) {
  const { qs, canEdit, childId, students } = p;
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefsState] = useState<JoinPrefs>({ camOn: true, micOn: true });
  const [placement, setPlacement] = useState<"inline" | "full">("inline");
  const [minimized, setMinimized] = useState(false);
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const [hosts, setHosts] = useState(0);
  const [ending, setEnding] = useState(false);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; setPrefsState(loadPrefs()); setPlacement(loadPlacement()); return () => { mounted.current = false; }; }, []);

  // ── join ──
  const family = useFamily();
  const pickRef = useRef(family.pick);
  useEffect(() => { pickRef.current = family.pick; });
  const join = useCallback(async (lesson: Lesson, asChildId?: string) => {
    setSession({ lessonId: lesson.id, snapshot: lesson, stage: { kind: "connecting" } });
    const who = canEdit ? null : (asChildId ?? childId);
    // Joining as a different child than the header shows: the whole hub follows (attendance, whiteboard identity, homework and progress tabs).
    if (!canEdit && asChildId && asChildId !== childId) pickRef.current(asChildId);
    try {
      const info = await post<JoinInfo>(`/api/learning-hub/lessons/${lesson.id}/join${withQs(qs, canEdit ? {} : { childId: who })}`, canEdit ? {} : { childId: who });
      if (!mounted.current) return;
      setSession((s) => (s && s.lessonId === lesson.id ? { ...s, stage: { kind: "in-call", join: info } } : s));
    } catch (e) {
      if (!mounted.current) return;
      const msg = errMsg(e, "Couldn't join the lesson");
      const body = e instanceof ApiError ? (e.body as { code?: string; children?: { childId: string; childName: string }[] } | undefined) : undefined;
      setSession((s) => (s && s.lessonId === lesson.id ? { ...s, stage: { kind: "failed", reason: classifyJoinError(e instanceof ApiError ? e.status : undefined, msg, body?.code), message: msg, ...(Array.isArray(body?.children) ? { children: body.children } : {}) } } : s));
    }
  }, [qs, canEdit, childId]);

  const start = useCallback((lesson: Lesson, next?: JoinPrefs, asChildId?: string) => {
    if (next) { setPrefsState(next); try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* not remembered — fine */ } }
    setMinimized(false);
    void join(lesson, asChildId);
  }, [join]);

  // ── the lesson, kept fresh while a call is open (the Live lessons tab may not be mounted) ──
  const active = session?.lessonId ?? null;
  const listPath = `/api/learning-hub/lessons${withQs(qs, canEdit ? {} : { childId })}`;
  const load = useCallback(() => { get<unknown>(listPath).then((r) => { if (mounted.current) setLessons(asList(r)); }).catch(() => undefined); }, [listPath]);
  useEffect(() => { if (active) load(); }, [active, load]);
  useRealtime(active ? ["hubLessons"] : [], load);
  const lesson = active ? (lessons ?? []).find((l) => l.id === active) ?? session!.snapshot : null;

  // Attendance is confirmed by the family's CLIENT once Daily says it really joined (not when the token is minted).
  const callObj = useCallObject();
  useEffect(() => {
    if (canEdit || !callObj || !active) return;
    let sent = false;
    const mark = () => {
      if (sent) return;
      sent = true;
      post(`/api/learning-hub/lessons/${active}/attended${withQs(qs, { childId })}`, { childId }).catch(() => { sent = false; }); // tried again on the next (re)join
    };
    try { if (callObj.meetingState?.() === "joined-meeting") mark(); } catch { /* not ready */ }
    callObj.on("joined-meeting", mark);
    return () => { try { callObj.off("joined-meeting", mark); } catch { /* call gone */ } };
  }, [callObj, active, canEdit, qs, childId]);

  // A lesson that was cancelled closes the room; a deleted one can't be a call.
  useEffect(() => {
    if (!active || !lessons) return;
    const row = lessons.find((l) => l.id === active);
    if (!row) setSession(null);
    else if (row.status === "cancelled") setSession((s) => (s && s.stage.kind === "in-call" ? { ...s, stage: { kind: "left", join: null } } : s));
  }, [active, lessons]);

  const close = useCallback(() => { setSession(null); setMinimized(false); }, []);
  const endLesson = async () => {
    if (!session) return;
    setEnding(true);
    try {
      await post(`/api/learning-hub/lessons/${session.lessonId}/end${withQs(qs, {})}`, {});
      setSession((s) => (s ? { ...s, stage: { kind: "left", join: null } } : s));
      load();
    } catch (e) { p.onError(errMsg(e, "Couldn't end the lesson")); }
    finally { setEnding(false); }
  };
  const extend = useCallback(async () => {
    if (!session) throw new Error("No call");
    const body = canEdit ? {} : { childId };
    return post<{ roomExpiresAt: string; closesAt: string; promptSeconds: number }>(`/api/learning-hub/lessons/${session.lessonId}/extend${withQs(qs, canEdit ? {} : { childId })}`, body);
  }, [session, qs, canEdit, childId]);

  const togglePlacement = () => setPlacement((v) => { const n = v === "full" ? "inline" : "full"; try { localStorage.setItem(PLACE_KEY, n); } catch { /* fine */ } return n; });

  const attachHost = useCallback(() => { setHosts((n) => n + 1); return () => setHosts((n) => Math.max(0, n - 1)); }, []);
  const slotRef = useCallback((el: HTMLElement | null) => setSlotEl(el), []);
  // "Return to call": un-minimise, and if the user is on another hub tab, take them back to Live lessons.
  const hostsRef = useRef(0);
  useEffect(() => { hostsRef.current = hosts; }, [hosts]);
  const goToRef = useRef(p.goTo);
  useEffect(() => { goToRef.current = p.goTo; });
  const restore = useCallback(() => { setMinimized(false); if (hostsRef.current === 0) goToRef.current?.("live"); }, []);

  // Effective placement. Inline needs the Live lessons tab's slot; with the tab mounted but the slot not yet
  // measured we keep the layer hidden (no flash of the small window); with the tab gone, it becomes the small window.
  const mode: CallPlacement | null = !session ? null : minimized ? "mini" : placement === "full" ? "full" : hosts > 0 ? "inline" : "mini";
  const pending = mode === "inline" && !slotEl;

  const api: CallApi = useMemo(() => ({
    activeId: active, activeTitle: lesson?.title ?? null, joiningId: session?.stage.kind === "connecting" ? active : null,
    mode, minimized, inline: !!session && !minimized && placement === "inline", prefs, start, restore, attachHost, slotRef,
  }), [active, lesson?.title, session?.stage.kind, mode, minimized, placement, session, prefs, start, restore, attachHost, slotRef]);

  const tutorLabel = canEdit ? "You" : lesson?.tutorName || students.find((s) => s.tutorName)?.tutorName || "Your tutor";

  return (
    <Ctx.Provider value={api}>
      {children}
      {session && lesson && mode && (
        <FullscreenPortal>
          <CallLayer mode={mode} slot={slotEl} hidden={pending}>
            <CallRoom
              lesson={lesson} state={session.stage} isTutor={canEdit} tutorLabel={tutorLabel}
              placement={mode}
              onMinimize={() => setMinimized(true)} onRestore={restore} onTogglePlacement={togglePlacement}
              onLeavePage={close}
              onRejoin={(asChildId) => void join(lesson, asChildId)} onEnd={() => void endLesson()} onExtend={extend} ending={ending}
              camOn={prefs.camOn} micOn={prefs.micOn}
              renderWorkspace={(o) => <TabBoundary label="workspace"><Workspace p={p} lesson={lesson} isTutor={canEdit} view={o.view} active={o.active} now={o.now} tab={o.tab} onTab={o.onTab} /></TabBoundary>}
            />
          </CallLayer>
        </FullscreenPortal>
      )}
    </Ctx.Provider>
  );
}

/** The one persistent box the room lives in. Its CSS changes with the placement; its children never remount. */
function CallLayer({ mode, slot, hidden, children }: { mode: CallPlacement; slot: HTMLElement | null; hidden: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Inline: follow the placeholder's rectangle (imperatively — no re-render per scroll frame).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (mode !== "inline" || !slot) { for (const k of ["top", "left", "width", "height"] as const) el.style[k] = ""; return; }
    let raf = 0, last = "";
    const tick = () => {
      const b = slot.getBoundingClientRect();
      const key = `${Math.round(b.top)}|${Math.round(b.left)}|${Math.round(b.width)}|${Math.round(b.height)}`;
      if (key !== last) { last = key; el.style.top = `${b.top}px`; el.style.left = `${b.left}px`; el.style.width = `${b.width}px`; el.style.height = `${b.height}px`; }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [mode, slot]);
  const cls = mode === "full" ? "inset-0 z-[350]" : mode === "mini" ? "bottom-4 right-4 z-[60] h-[204px] w-[min(360px,calc(100vw-24px))]" : "z-[20]";
  return <div ref={ref} data-call-layer={mode} className={`fixed ${cls} ${hidden ? "invisible" : ""}`}>{children}</div>;
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useIsDesktop } from "../kit";
import { DISPLAY, FOCUS, Notice, Skeleton, fmtClock, humanSpan, useNow } from "../teachKit";
import { Ico, type IcoName } from "../teachIcons";
import { lessonTiming, type JoinFailure, type JoinInfo, type Lesson } from "./lessonTypes";
import { StayPrompt } from "./StayPrompt";
import { RoomRoster } from "./RoomRoster";
import { useFloatingTile } from "./FloatingVideo";
import type { WsView } from "./workspace/wsKit";
import { WS_TABS, type WsTabKey } from "./workspace/tabs";
import { onBoardBus, publishCall, useUnseenBoardOps, wantsBoardFirst } from "./board/callObject";

// The embedded video stage. Daily's prebuilt UI is created with daily-js
// createFrame (themed from the portal's own brand variables) inside an effect,
// via a DYNAMIC import: a top-level import of @daily-co/daily-js breaks server
// rendering ("require is not defined"). The frame is destroyed on leave/unmount.

export type StageState =
  | { kind: "connecting" }
  | { kind: "in-call"; join: JoinInfo }
  | { kind: "left"; join: JoinInfo | null }
  | { kind: "failed"; reason: JoinFailure; message: string; /** reason "child": the parent's children who are in this lesson (from the API), to choose from. */ children?: { childId: string; childName: string }[] };

/** Daily's `theme` wants concrete colours, so resolve the portal's brand tokens
 *  at runtime (a tenant's rebrand carries into the call). Fallbacks = portal blues. */
function readDailyTheme(host: HTMLElement) {
  const cs = getComputedStyle(host);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    colors: {
      accent: v("--brand-2", "#2f6bd8"),
      accentText: "#ffffff",
      background: v("--brand-strong", "#16306e"),
      backgroundAccent: v("--brand", "#1d3a8f"),
      baseText: "#ffffff",
      border: v("--brand-2", "#3a5bb0"),
      mainAreaBg: v("--brand-ink", "#0f2354"),
      mainAreaBgAccent: v("--brand", "#1d3a8f"),
      mainAreaText: "#ffffff",
      supportiveText: v("--brand-line", "#b9c8ee"),
    },
  };
}

const CAMERA_HELP: Record<string, string> = {
  permissions: "Your browser is blocking the camera or microphone. Click the camera icon in the address bar, choose Allow, then rejoin.",
  "cam-in-use": "Your camera is being used by another app or tab. Close it and try again.",
  "mic-in-use": "Your microphone is being used by another app or tab. Close it and try again.",
  "cam-mic-in-use": "Your camera and microphone are being used by another app or tab. Close it and try again.",
  "not-found": "We couldn't find a camera or microphone. Plug one in, or join without video.",
  "undefined-mediadevices": "This browser can't reach a camera. Try Chrome, Edge, Safari or Firefox over a secure (https) page.",
};

/** Why the video connection failed — Daily's own fatal-error type, put into words a parent understands (not just "the connection dropped"). */
export type FrameFailKind = "full" | "expired" | "removed" | "drop";
export interface FrameFail { kind: FrameFailKind; message: string }
const FRAME_FAIL: Record<FrameFailKind, { title: string; text: string }> = {
  full: { title: "This lesson's room is full", text: "The video room has reached its limit, so it can't take another device. Close any other tab or device that is already in this lesson, then try again — or message your tutor to make room." },
  expired: { title: "The link for this lesson has expired", text: "Your joining time for this lesson has passed. If the lesson is still going, go back to Live lessons and join again." },
  removed: { title: "You were removed from the call", text: "Your tutor took you out of the call. Message them if that wasn't expected." },
  drop: { title: "The connection dropped", text: "" },
};
/** Map a Daily fatal error (daily-js `error` event, or a rejected `join()`) to a failure kind. */
export function frameFailOf(type: string | undefined, message: string | undefined): FrameFail {
  const t = type ?? "";
  const m = message ?? "";
  const kind: FrameFailKind = t === "meeting-full" || /\b(meeting|room)\b.*\bfull\b|max(imum)?[_ ]participants/i.test(m) ? "full"
    : t === "exp-room" || t === "exp-token" || t === "nbf-room" || t === "nbf-token" || t === "no-room" ? "expired"
    : t === "ejected" ? "removed" : "drop";
  return { kind, message: kind === "drop" ? (m || "The video connection dropped.") : FRAME_FAIL[kind].text };
}

/** The Daily frame. Mount it only once there's a join token. */
export function DailyFrame({ join, onLeft, onFail, onCameraIssue, camOn = true, micOn = true }: { join: JoinInfo; onLeft: () => void; onFail: (f: FrameFail) => void; onCameraIssue: (msg: string) => void; camOn?: boolean; micOn?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onLeft, onFail, onCameraIssue });
  useEffect(() => { cb.current = { onLeft, onFail, onCameraIssue }; });

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    let frame: { destroy: () => Promise<void> } | null = null;
    void (async () => {
      const { default: Daily } = await import("@daily-co/daily-js");
      if (cancelled) return;
      // One Daily instance per page: clear any survivor from a fast remount.
      const stale = Daily.getCallInstance();
      if (stale) await stale.destroy().catch(() => undefined);
      if (cancelled) return;
      const f = Daily.createFrame(node, { theme: readDailyTheme(node), showLeaveButton: true, startVideoOff: !camOn, startAudioOff: !micOn, iframeStyle: { width: "100%", height: "100%", border: "0" } });
      frame = f;
      publishCall(f as never, { userName: join.userName, isOwner: join.isOwner }); // the whiteboard syncs over this call object
      f.on("left-meeting", () => { if (!cancelled) cb.current.onLeft(); });
      f.on("camera-error", (ev) => {
        const type = (ev as { error?: { type?: string }; errorMsg?: { errorMsg?: string } } | undefined)?.error?.type ?? "";
        if (!cancelled) cb.current.onCameraIssue(CAMERA_HELP[type] ?? "We couldn't start your camera or microphone. Check your browser's permissions, then rejoin.");
      });
      f.on("error", (ev) => {
        const m = (ev as { errorMsg?: string; error?: { type?: string; msg?: string } } | undefined);
        if (!cancelled) cb.current.onFail(frameFailOf(m?.error?.type, m?.errorMsg || m?.error?.msg));
      });
      try {
        await f.join({ url: join.url, token: join.token, userName: join.userName });
      } catch (e) {
        if (!cancelled) cb.current.onFail(frameFailOf((e as { error?: { type?: string } } | undefined)?.error?.type, e instanceof Error && e.message ? e.message : "Couldn't connect to the lesson."));
      }
    })();
    return () => {
      cancelled = true;
      const f = frame;
      frame = null;
      publishCall(null);
      if (f) void f.destroy().catch(() => undefined);
    };
    // camOn/micOn only seed the call's starting state — changing them later must not rebuild the frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join.url, join.token, join.userName]);

  return <div ref={host} className="h-full w-full" data-testid="hub-daily-frame" />;
}

/** Shared frame for every non-video state on the stage. */
function StageMessage({ icon, title, children, actions }: { icon: IcoName; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center text-white">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/12 backdrop-blur-sm" aria-hidden><Ico name={icon} size={30} /></div>
      <div className="text-[19px] font-extrabold" style={DISPLAY}>{title}</div>
      <div className="max-w-[440px] text-[13px] leading-relaxed text-white/80">{children}</div>
      {actions && <div className="mt-1 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

const ghostOnDark = `min-h-[44px] !border-white/30 !bg-white/10 !text-white hover:!bg-white/20 ${FOCUS}`;
const solidOnDark = `min-h-[44px] !border-transparent !bg-white !text-[var(--brand-strong)] hover:!brightness-95 ${FOCUS}`;


// ── the room ────────────────────────────────────────────────────────────────
type LayoutMode = "video" | "split" | "work";
interface RoomLayout { mode: LayoutMode; /** The workspace's share of the room, 0.2–0.75 (split only). */ frac: number }
const LAYOUT_KEY = "hub-ws-layout";
const clampFrac = (f: number) => Math.min(0.75, Math.max(0.2, f));
function loadLayout(desktop: boolean, isTutor: boolean): RoomLayout {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null") as Partial<RoomLayout> | null;
    // A remembered "video only" is not carried onto a phone / tablet: there the workspace is collapsed behind a bottom nav, so a family would
    // join and see nothing but video (no board, no lessons) until they found it. (Desktop keeps whatever the person last chose.)
    if (raw && (raw.mode === "video" || raw.mode === "split" || raw.mode === "work") && typeof raw.frac === "number" && (desktop || raw.mode !== "video")) return { mode: raw.mode, frac: clampFrac(raw.frac) };
  } catch { /* storage blocked — fall through to the default */ }
  // Everyone starts split, so the board / lessons the tutor is using are on screen without hunting for the bottom nav. On a phone or a tablet
  // held upright the room is stacked (video on top), and a 35 % workspace is unusable (~215 px on a phone): the workspace gets 64 % (the header + "in the room" strip already take ~240 px of a phone, so 60 % left the workspace under 330 px),
  // the video a wide strip above it — swap with the layout buttons (Video only · 65/35 · 50/50 · Workspace only) or by dragging the handle.
  void isTutor;
  return { mode: "split", frac: desktop ? 0.35 : 0.64 };
}

export interface WorkspaceRender { view: WsView; active: boolean; now: number; tab: WsTabKey; onTab: (t: WsTabKey) => void }

const bigBtn = `!min-h-[56px] !px-8 !text-[16px] !font-extrabold ${solidOnDark}`;

export type CallPlacement = "inline" | "full" | "mini";

export function CallRoom({ lesson, state, isTutor, tutorLabel, placement, onMinimize, onRestore, onTogglePlacement, onLeavePage, onRejoin, onEnd, onExtend, ending, renderWorkspace, camOn = true, micOn = true }: {
  lesson: Lesson;
  state: StageState;
  isTutor: boolean;
  tutorLabel: string;
  /** inline = in the hub page · full = full screen · mini = a small floating window while the user is elsewhere. */
  placement: CallPlacement;
  /** "Back to live lessons": the call keeps running in the small window. */
  onMinimize: () => void;
  onRestore: () => void;
  onTogglePlacement: () => void;
  /** Really leave: close the room. */
  onLeavePage: () => void;
  /** Try the join again — `childId` names which of the parent's children is joining (from the "Which child?" picker). */
  onRejoin: (childId?: string) => void;
  onEnd: () => void;
  /** POST /extend — returns the room's new expiry. */
  onExtend: () => Promise<{ roomExpiresAt: string }>;
  ending: boolean;
  renderWorkspace: (o: WorkspaceRender) => ReactNode;
  camOn?: boolean;
  micOn?: boolean;
}) {
  const now = useNow(1000);
  const boardLive = useUnseenBoardOps();
  const t = lessonTiming(lesson, now);
  const desktop = useIsDesktop();
  const roomRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [camIssue, setCamIssue] = useState<string | null>(null);
  const [frameFail, setFrameFail] = useState<FrameFail | null>(null);
  const [leftLocal, setLeftLocal] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [layout, setLayoutState] = useState<RoomLayout>(() => loadLayout(desktop, isTutor));
  const [dragging, setDragging] = useState(false);
  const [everOpen, setEverOpen] = useState(layout.mode !== "video");
  const [tab, setTab] = useState<WsTabKey>(isTutor ? (wantsBoardFirst() ? "board" : "students") : "notes");
  const [present, setPresent] = useState(false);
  const [hideNames, setHideNames] = useState(false);
  const [bigPref, setBigPref] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // "Stay on the call" state
  const [extra, setExtra] = useState<number | null>(null);
  const [staying, setStaying] = useState(false);
  const [stayErr, setStayErr] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);

  const setLayout = useCallback((l: RoomLayout | ((c: RoomLayout) => RoomLayout)) => {
    setLayoutState((c) => {
      const n = typeof l === "function" ? l(c) : l;
      if (n.mode !== "video") setEverOpen(true);
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(n)); } catch { /* not persisted — fine */ }
      return n;
    });
  }, []);

  const mini = placement === "mini";
  const full = placement === "full";
  useEffect(() => {
    if (!full) return;
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = o; };
  }, [full]);
  useEffect(() => { roomRef.current?.focus({ preventScroll: true }); if (isTutor && wantsBoardFirst()) setLayout({ mode: "split", frac: 0.6 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The stay prompt can't be answered from a thumbnail — bring the call back to the front.
  const restoreRef = useRef(onRestore);
  useEffect(() => { restoreRef.current = onRestore; });
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 4200); return () => clearTimeout(id); }, [toast]);
  // "Present the board" (tutor's button, or heard from the tutor): the board becomes the main stage, the video a small tile.
  // Something in the workspace needs to be seen (the tutor started teaching a lesson): open it if it is collapsed.
  useEffect(() => onBoardBus("workspace", () => setLayout((c) => (c.mode === "video" ? { mode: "split", frac: desktop ? 0.4 : 0.6 } : c))), [setLayout, desktop]);
  useEffect(() => onBoardBus("present", (on) => { setLayout((c) => (on ? { mode: "work", frac: c.frac } : { mode: "split", frac: 0.4 })); if (on) setTab("board"); }), [setLayout]);

  // A rejoin gets a fresh join token → reset the transient stage flags.
  const joinToken = state.kind === "in-call" ? state.join.token : null;
  useEffect(() => { setCamIssue(null); setFrameFail(null); setLeftLocal(false); setTimeUp(false); setExtra(null); setLimit(false); setStayErr(null); }, [joinToken]);

  // ── when does the room disconnect everyone? ──
  const joinInfo = state.kind === "in-call" ? state.join : null;
  const joinExp = joinInfo?.roomExpiresAt ? Date.parse(joinInfo.roomExpiresAt) : NaN;
  // Someone else's "Stay" shows up on the lesson row (its closesAt carries the extension): pick that up too.
  const peerClose = lesson.closesAt ? Date.parse(lesson.closesAt) : NaN;
  const peerExp = Number.isFinite(peerClose) && peerClose > t.endMs + 30 * 60_000 + 1000 ? peerClose - 30 * 60_000 : NaN;
  const candidates = [joinExp, extra ?? NaN, peerExp].filter((n) => Number.isFinite(n));
  const expiresAt = candidates.length ? Math.max(...candidates) : null;
  const expRef = useRef<number | null>(null);
  useEffect(() => { expRef.current = expiresAt; }, [expiresAt]);
  const promptMs = (joinInfo?.promptSeconds ?? 120) * 1000;
  const inCall = state.kind === "in-call" && !leftLocal && !frameFail;
  const untilEnd = expiresAt != null ? expiresAt - now : Infinity;
  const showPrompt = inCall && untilEnd <= promptMs && untilEnd > -8000;
  useEffect(() => { setLimit(false); setStayErr(null); }, [expiresAt]);
  useEffect(() => { if (showPrompt && mini) restoreRef.current(); }, [showPrompt, mini]);

  // Daily normally disconnects everyone at expiry (left-meeting fires). If it doesn't, don't leave a dead frame.
  useEffect(() => { if (inCall && untilEnd < -8000) { setTimeUp(true); setLeftLocal(true); } }, [inCall, untilEnd]);
  const onDailyLeft = useCallback(() => { setLeftLocal(true); setTimeUp(expRef.current != null && Date.now() >= expRef.current - 6000); }, []);

  const stay = async () => {
    if (staying) return;
    setStaying(true); setStayErr(null);
    try {
      const r = await onExtend();
      setExtra(Date.parse(r.roomExpiresAt));
      setToast("15 more minutes");
    } catch (e) {
      const code = e instanceof ApiError && e.body && typeof e.body === "object" ? (e.body as { code?: string }).code : undefined;
      if (code === "extension_limit") setLimit(true);
      else setStayErr(e instanceof Error && e.message ? e.message : "Couldn't extend the call — try again.");
    } finally { setStaying(false); }
  };

  const closed = lesson.status === "cancelled" || t.phase === "ended" || t.phase === "cancelled";
  const closesLabel = fmtClock(new Date(t.closesMs).toISOString());
  const remaining = t.endMs - now;
  const attendeeCount = lesson.childIds?.length ?? 0;
  const view: WsView = { present, hideNames: isTutor && hideNames, big: present || bigPref, isTutor };
  const wsOpen = layout.mode !== "video";

  // ── shortcuts (W workspace · P present · ? help) ──
  useEffect(() => {
    if (mini) return;
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || (el.closest('[role="dialog"]') && !el.closest('[role="alertdialog"]')))) return;
      const k = e.key.toLowerCase();
      if (k === "w") { e.preventDefault(); setLayout((c) => (c.mode === "video" ? { mode: "split", frac: c.frac } : { mode: "video", frac: c.frac })); }
      else if (k === "p" && isTutor) { e.preventDefault(); togglePresent(); }
      else if (k === "?" || (k === "/" && e.shiftKey)) { e.preventDefault(); setHelp((v) => !v); }
      else if (e.key === "Escape") { setHelp(false); setConfirmEnd(false); }
      else if (e.key === "Tab" && full) {
        const room = roomRef.current;
        if (!room || !room.contains(document.activeElement)) return;
        const els = [...room.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null && !n.closest('[role="dialog"][data-pane-overlay]'));
        if (!els.length) return;
        const first = els[0]!, last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTutor, attendeeCount, mini, full]);

  function togglePresent() {
    setPresent((on) => {
      if (!on && attendeeCount > 1) setHideNames(true); // a group is about to be on a shared screen
      if (!on) setLayout((c) => (c.mode === "video" ? { mode: "split", frac: 0.4 } : c));
      return !on;
    });
  }

  // ── drag to resize ──
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragging || !mainRef.current) return;
    const r = mainRef.current.getBoundingClientRect();
    const f = desktop ? (r.right - e.clientX) / r.width : (r.bottom - e.clientY) / r.height;
    setLayout({ mode: "split", frac: clampFrac(f) });
  };
  const onHandleKey = (e: React.KeyboardEvent) => {
    const grow = desktop ? "ArrowLeft" : "ArrowUp", shrink = desktop ? "ArrowRight" : "ArrowDown";
    if (e.key !== grow && e.key !== shrink) return;
    e.preventDefault();
    setLayout((c) => ({ mode: "split", frac: clampFrac(c.frac + (e.key === grow ? 0.05 : -0.05)) }));
  };

  const preset = (m: LayoutMode, frac?: number) => setLayout((c) => ({ mode: m, frac: frac ?? c.frac }));
  const presetOn = (m: LayoutMode, frac?: number) => layout.mode === m && (frac === undefined || Math.abs(layout.frac - frac) < 0.03);

  // ── what the video pane shows ──
  let stage: ReactNode;
  if (state.kind === "connecting") {
    stage = <div className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 text-white"><div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/25 border-t-white motion-reduce:animate-none" /><div className="text-[13px] font-semibold text-white/85">Connecting you to the lesson…</div></div>;
  } else if (state.kind === "failed") {
    const f = state.reason;
    const map: Record<JoinFailure, { icon: IcoName; title: string }> = {
      not_open: { icon: "hourglass", title: "The lesson isn't open yet" },
      ended: { icon: "flag", title: "This lesson has finished" },
      unavailable: { icon: "camOff", title: "Video isn't available right now" },
      forbidden: { icon: "lock", title: "You can't join this lesson" },
      waiting: { icon: "hourglass", title: "Waiting for your tutor" },
      child: { icon: "lock", title: "Which child is joining?" },
      other: { icon: "warning", title: "We couldn't connect you" },
    };
    stage = (
      <StageMessage icon={map[f].icon} title={map[f].title}
        actions={<>
          {f === "child" && (state.children ?? []).map((c) => <Button key={c.childId} variant="solid" className={solidOnDark} onClick={() => onRejoin(c.childId)} data-action="join-as" data-child-id={c.childId}>Join as {c.childName.trim().split(/\s+/)[0] || c.childName}</Button>)}
          {(f === "other" || f === "unavailable" || f === "not_open" || f === "waiting") && <Button variant="solid" className={solidOnDark} onClick={() => onRejoin()}>Try again</Button>}
          <Button variant="ghost" className={ghostOnDark} onClick={onLeavePage}>Back to live lessons</Button>
        </>}>
        {state.message}
        {f === "unavailable" && <> Your tutor may need to switch video calling on — try again in a minute, or message them.</>}
      </StageMessage>
    );
  } else if (frameFail) {
    stage = (
      <StageMessage icon={frameFail.kind === "full" ? "users" : "warning"} title={FRAME_FAIL[frameFail.kind].title} actions={<><Button variant="solid" className={bigBtn} onClick={() => onRejoin()} data-action="rejoin-call">{frameFail.kind === "full" ? "Try again" : "Rejoin call"}</Button><Button variant="ghost" className={ghostOnDark} onClick={onLeavePage}>Leave page</Button></>}>
        <span data-testid="hub-frame-fail" data-kind={frameFail.kind}>{frameFail.message}</span>
      </StageMessage>
    );
  } else if (state.kind === "left" || leftLocal) {
    stage = (
      <StageMessage icon={closed ? "flag" : timeUp ? "hourglass" : "hand"}
        title={closed ? "This lesson has finished" : timeUp ? "The call has ended (time's up)" : lesson.status === "ended" ? "The call was ended" : "You've left the call"}
        actions={<>
          {!closed && <Button variant="solid" className={bigBtn} onClick={() => onRejoin()} data-action="rejoin-call">Rejoin call</Button>}
          <Button variant={closed ? "solid" : "ghost"} className={closed ? solidOnDark : `${ghostOnDark} !min-h-[56px]`} onClick={onLeavePage}>Leave page</Button>
        </>}>
        {closed
          ? (lesson.status === "cancelled" ? "This lesson was cancelled." : "The joining window has closed. Your lessons are still in the Lessons tab whenever you need them.")
          : <>You can hop straight back in{isTutor ? " — your students can too" : ""} until <b>{closesLabel}</b>.{timeUp && <> Time ran out because nobody pressed &ldquo;Stay on the call&rdquo;.</>}</>}
      </StageMessage>
    );
  } else {
    stage = <DailyFrame join={state.join} camOn={camOn} micOn={micOn} onLeft={onDailyLeft} onFail={setFrameFail} onCameraIssue={setCamIssue} />;
  }

  const work = layout.mode === "work" && !mini;
  const split = layout.mode === "split" && !mini;
  const tile = useFloatingTile({ active: work, boundsRef: mainRef, onExpand: () => preset("split", 0.35), dockSide: desktop ? "right" : "top" });
  const wsStyle = split ? { flex: `0 0 ${layout.frac * 100}%` } : work ? { flex: "1 1 0" } : undefined;

  const seg = (on: boolean) => `inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-extrabold ${FOCUS} ${on ? "bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-2)] hover:bg-[var(--surface)]/60"}`;
  const tog = (on: boolean) => `inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`;

  return (
    <section ref={roomRef} tabIndex={-1} aria-label={`Lesson: ${lesson.title}`} id="hub-call-room" data-layout={layout.mode} data-present={present ? "1" : "0"}
      className={`flex h-full w-full flex-col overflow-hidden outline-none ${placement === "inline" ? "rounded-3xl border border-[var(--hub-warm-line)] shadow-[var(--shadow)]" : mini ? "rounded-2xl border border-[var(--hub-warm-line)] shadow-[0_18px_44px_rgba(0,0,0,0.35)]" : ""}`} style={{ background: "color-mix(in srgb, var(--gold) 6%, var(--bg))", color: "var(--ink)" }}>
      <header hidden={mini} className="@container relative flex flex-none flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--hub-warm-line)] px-2.5 py-2 sm:px-4" style={{ background: "var(--hub-warm)" }}>
        <button type="button" onClick={onMinimize} data-action="back-to-lessons" title="Back to live lessons — your call keeps running in a small window" className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-[12.5px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)] ${FOCUS}`}><Ico name="arrowLeft" size={15} /><span className="hidden sm:inline">Live lessons</span></button>
        <div className="min-w-[200px] flex-1 basis-[240px]">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 truncate text-[16px] font-extrabold text-[var(--ink)] sm:text-[18px]" style={DISPLAY}>{lesson.title}</h2>
            {inCall && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--red)] px-2.5 py-[3px] text-[11px] font-extrabold uppercase tracking-wide text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />Live</span>}
          </div>
          <div className="truncate text-[12px] text-[var(--ink-3)]">
            {tutorLabel} · {fmtClock(lesson.startsAt)}–{fmtClock(new Date(t.endMs).toISOString())}
            {inCall && (remaining > 0 ? ` · ${humanSpan(remaining)} left` : " · running over the scheduled time")}
          </div>
        </div>

        <div className="flex w-full flex-none items-center gap-1.5 overflow-x-auto pb-0.5 @[720px]:w-auto @[720px]:flex-wrap @[720px]:overflow-visible @[720px]:pb-0">
          <div role="group" aria-label="Layout" className="inline-flex items-center gap-0.5 rounded-2xl border border-[var(--hub-warm-line)] p-0.5" style={{ background: "var(--hub-warm-2)" }}>
            <button type="button" aria-pressed={presetOn("video")} onClick={() => preset("video")} title="Video only (W)" data-preset="video" className={seg(presetOn("video"))}><Ico name="video" size={16} /><span className="hidden @[1200px]:inline">Video only</span></button>
            <button type="button" aria-pressed={presetOn("split", 0.35)} onClick={() => preset("split", 0.35)} title="65% video · 35% workspace" data-preset="65-35" className={seg(presetOn("split", 0.35))}><Ico name="panelRight" size={16} /><span className="hidden @[1200px]:inline">65 / 35</span></button>
            <button type="button" aria-pressed={presetOn("split", 0.5)} onClick={() => preset("split", 0.5)} title="Half video · half workspace" data-preset="50-50" className={seg(presetOn("split", 0.5))}><Ico name="layers" size={16} /><span className="hidden @[1200px]:inline">50 / 50</span></button>
            <button type="button" aria-pressed={presetOn("work")} onClick={() => preset("work")} title="Workspace only — video becomes a small tile" data-preset="work" className={seg(presetOn("work"))}><Ico name="maximize" size={16} /><span className="hidden @[1200px]:inline">Workspace only</span></button>
          </div>
          {isTutor && <button type="button" aria-pressed={tab === "board" && wsOpen} onClick={() => { setTab("board"); setLayout((c) => ({ mode: "split", frac: Math.max(c.frac, 0.55) })); }} title="Open the whiteboard" data-action="open-board" className={tog(tab === "board" && wsOpen)}><Ico name="edit" size={16} /><span className="hidden @[1000px]:inline">Board</span></button>}
          {isTutor && <button type="button" aria-pressed={present} onClick={togglePresent} title="Present mode (P) — big type, tutor-only controls hidden" data-action="present" className={tog(present)}><Ico name="monitor" size={16} /><span className="hidden @[1100px]:inline">Present</span></button>}
          {isTutor && attendeeCount > 1 && <button type="button" aria-pressed={hideNames} onClick={() => setHideNames((v) => !v)} title="Privacy — hide students' names and scores on a shared screen" data-action="privacy" className={tog(hideNames)}><Ico name="eyeOff" size={16} /><span className="hidden @[1250px]:inline">Privacy: hide names</span></button>}
          <button type="button" aria-pressed={bigPref} onClick={() => setBigPref((v) => !v)} title="Large type" data-action="large-type" className={tog(bigPref)}><Ico name="type" size={16} /><span className="sr-only">Large type</span></button>
          <button type="button" onClick={onTogglePlacement} aria-pressed={full} title={full ? "Exit full screen" : "Full screen (presentation view)"} data-action="fullscreen" className={tog(full)}><Ico name="maximize" size={16} /><span className="hidden @[1000px]:inline">{full ? "Exit full screen" : "Full screen"}</span></button>
          <button type="button" aria-expanded={help} onClick={() => setHelp((v) => !v)} title="Keyboard shortcuts (?)" className={tog(help)}><Ico name="keyboard" size={16} /><span className="sr-only">Keyboard shortcuts</span></button>
          {isTutor && inCall && !closed && (
            <button type="button" aria-expanded={confirmEnd} onClick={() => setConfirmEnd((v) => !v)} data-action="end-lesson" className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--red-line)] bg-[var(--red-soft)] px-3.5 text-[12.5px] font-extrabold text-[var(--hub-red-ink)] hover:brightness-95 ${FOCUS}`}>End lesson</button>
          )}
        </div>

        {help && (
          <div role="dialog" aria-label="Keyboard shortcuts" className="hub-pop absolute right-3 top-full z-[70] mt-1.5 w-[280px] rounded-2xl p-3.5 text-[12.5px]">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">Keyboard shortcuts</div>
            <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              {[["W", "Show / hide the workspace"], ...(isTutor ? [["P", "Present mode"]] : []), [`1–${WS_TABS(isTutor).length}`, "Switch workspace tab"], ["?", "This help"], ["Space ← →", "Flip / step flashcards"], ["Esc", "Close a view"]].map(([k, d]) => (
                <div key={k} className="contents"><dt><kbd className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-px font-mono text-[11px] font-bold">{k}</kbd></dt><dd className="m-0 text-[var(--ink-2)]">{d}</dd></div>
              ))}
            </dl>
          </div>
        )}
        {confirmEnd && (
          <div role="alertdialog" aria-label="End the lesson for everyone?" data-testid="hub-end-confirm" className="hub-pop absolute right-3 top-full z-[70] mt-1.5 w-[320px] max-w-[calc(100vw-24px)] rounded-2xl p-4">
            <div className="text-[15px] font-extrabold text-[var(--ink)]" style={DISPLAY}>End the lesson for everyone?</div>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">This disconnects everyone. You and your students can still rejoin until <b>{closesLabel}</b>.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={ending} onClick={() => { setConfirmEnd(false); onEnd(); }} data-action="confirm-end" className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--red)] px-3 text-[13px] font-extrabold text-white hover:brightness-110 disabled:opacity-60 ${FOCUS}`}>{ending ? "Ending…" : "End for everyone"}</button>
              <button type="button" onClick={() => setConfirmEnd(false)} className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-4 text-[13px] font-bold text-[var(--ink-2)] ${FOCUS}`}>Keep going</button>
            </div>
          </div>
        )}
      </header>

      {isTutor && inCall && !mini && (lesson.students?.length ?? 0) > 0 && <RoomRoster students={lesson.students!} hideNames={hideNames} />}

      {camIssue && !mini && <div className="flex-none px-3 pt-2"><Notice tone="gold" onClose={() => setCamIssue(null)}>{camIssue}</Notice></div>}

      <div ref={mainRef} className={`relative flex min-h-0 flex-1 ${mini ? "p-0" : "p-2 sm:p-3"} ${desktop ? "flex-row" : "flex-col"}`}>
        <div className={`${mini ? "relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--brand-ink)]" : work ? tile.tileClass : "relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--brand-ink)] shadow-[var(--shadow)]"} ${dragging ? "pointer-events-none" : ""}`} style={work ? tile.tileStyle : undefined} data-testid="hub-video-pane" data-tile-docked={work ? (tile.docked ? "1" : "0") : undefined}>
          {work && tile.chrome}
          <div key="stage" className={work ? tile.stageClass : "h-full w-full"}>{stage}</div>
          {mini && (
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent p-1.5">
              <button type="button" onClick={onRestore} data-action="return-to-call" className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-3 text-[12.5px] font-extrabold text-[var(--brand-strong)] shadow-[var(--shadow-sm)] ${FOCUS}`}><Ico name="video" size={15} />Return to call</button>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-white/90">{lesson.title}</span>
              <button type="button" onClick={onLeavePage} data-action="mini-leave" aria-label="Leave the call" title="Leave the call" className={`grid h-11 w-11 flex-none place-items-center rounded-xl bg-black/45 text-white hover:bg-[var(--red)] ${FOCUS}`}><Ico name="close" size={16} /></button>
            </div>
          )}
        </div>

        {split && !mini && (
          <div role="separator" tabIndex={0} aria-orientation={desktop ? "vertical" : "horizontal"} aria-label="Resize the workspace" aria-valuemin={20} aria-valuemax={75} aria-valuenow={Math.round(layout.frac * 100)} data-testid="ws-handle"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }} onPointerMove={onHandleMove} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)} onKeyDown={onHandleKey}
            className={`group flex flex-none touch-none items-center justify-center ${desktop ? "w-3.5 cursor-col-resize" : "h-6 cursor-row-resize"} ${FOCUS}`}>
            <span aria-hidden className={`rounded-full bg-[var(--hub-warm-line)] transition-colors group-hover:bg-[var(--brand)] group-focus-visible:bg-[var(--brand)] ${dragging ? "!bg-[var(--brand)]" : ""} ${desktop ? "h-12 w-1" : "h-1 w-12"}`} />
          </div>
        )}

        {(everOpen || inCall) && (
          <aside aria-label="Lesson workspace" hidden={!wsOpen || mini} style={wsStyle} data-testid="ws-pane"
            className={`min-h-0 min-w-0 overflow-hidden rounded-2xl border border-[var(--hub-warm-line)] shadow-[var(--shadow)] ${wsOpen && !mini ? "" : "hidden"}`}>
            {renderWorkspace({ view, active: wsOpen && !mini, now, tab, onTab: setTab })}
          </aside>
        )}

        {showPrompt && (
          <StayPrompt remainingMs={Math.max(0, untilEnd)} limit={limit} busy={staying} error={stayErr} closesAt={t.closesMs}
            onStay={() => void stay()} onLeave={() => { setLeftLocal(true); }} />
        )}
      </div>

      {!desktop && !wsOpen && !mini && (
        <nav aria-label="Open the workspace" className="flex flex-none gap-1 overflow-x-auto border-t border-[var(--hub-warm-line)] px-2 py-1.5" style={{ background: "var(--hub-warm)" }}>
          {WS_TABS(isTutor).map((tb) => (
            <button key={tb.key} type="button" data-open-tab={tb.key} onClick={() => { setTab(tb.key); setLayout({ mode: "split", frac: 0.6 }); }}
              className={`inline-flex min-h-[44px] flex-1 flex-none items-center justify-center gap-1.5 rounded-xl px-3 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--surface)] ${FOCUS}`}><Ico name={tb.icon} size={15} />{tb.label}{tb.key === "board" && !isTutor && boardLive > 0 && <span className="h-2 w-2 rounded-full bg-[var(--red)]" aria-label="Your tutor is using the board" data-testid="board-live-dot" />}</button>
          ))}
        </nav>
      )}

      {toast && !mini && <div role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-16 z-[80] -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-extrabold text-[var(--surface)] shadow-[var(--shadow)]" data-testid="hub-toast">{toast}</div>}
    </section>
  );
}

export function StageSkeleton() {
  return <div className="grid gap-3"><Skeleton className="h-[260px] rounded-3xl" /><Skeleton className="h-[120px]" /><Skeleton className="h-[84px]" /><Skeleton className="h-[84px]" /></div>;
}

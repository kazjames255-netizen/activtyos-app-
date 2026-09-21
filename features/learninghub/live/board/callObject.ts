"use client";

import { useSyncExternalStore } from "react";

// The bridge between the Daily call (created inside DailyFrame in LessonStage.tsx)
// and the whiteboard. The call object is PUBLISHED here when the frame is created;
// from that moment the store listens for whiteboard app-messages and buffers them,
// so a student who opens the Board tab a minute into the lesson still gets every
// op the tutor has sent since (the board replays the buffer when it mounts, and
// asks the tutor for a full sync besides). Nothing here imports daily-js.

/** `user_id` is set by OUR server in the meeting token (`c:<childId>` for a family, unset for a tutor): it is what a peer's identity is bound to. */
export interface CallParticipant { session_id: string; owner?: boolean; user_name?: string; user_id?: string; local?: boolean }
export interface CallLike {
  sendAppMessage(data: unknown, to?: string): void;
  on(ev: string, cb: (e: never) => void): unknown;
  off(ev: string, cb: (e: never) => void): unknown;
  participants(): Record<string, CallParticipant>;
  meetingState?(): string;
}
export interface CallMeta { userName: string; isOwner: boolean }
export interface InboxMsg { fromId: string; data: WbMessage }

/** One whiteboard message on the wire. `wb: 1` marks it as ours. */
export interface WbMessage {
  wb: 1;
  ops?: unknown[];
  ptr?: { page: string; x: number; y: number; laser: boolean; col: string };
  /** Introduces a peer. The `cid` field is legacy and IGNORED by receivers: a student's identity comes from the signed token (`user_id`). */
  hello?: { cid?: string; name: string };
  req?: 1;
  need?: { page: string; id: string; have: number };
  go?: string;
  present?: boolean;
  /** Tutor -> everyone, every ~10 s: a fingerprint of the board. A peer whose own differs (twice running) asks for a fresh copy. */
  dg?: { n: number; h: number };
  /** A student's private scratch pad — sent ONLY between that student and the tutor (targeted, never '*'). */
  pad?: PadMsg;
}
export interface PadMsg { ops?: unknown[]; done?: boolean; req?: 1 }

let call: CallLike | null = null;
let meta: CallMeta | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const BUFFER_MAX = 500;
let buffer: InboxMsg[] = [];
let consumer: ((m: InboxMsg) => void) | null = null;
/** Latest "the tutor is presenting the board" state seen on the wire (drives the student's layout). */
let presenting = false;
let unseen = 0;
/** Is the Board tab on screen right now? While it isn't, tutor updates raise the "live" dot instead. */
let boardShown = false;

function isOwner(id: string): boolean {
  try { return !!call?.participants()?.[id]?.owner; } catch { return false; }
}

function onAppMessage(ev: { fromId?: string; data?: unknown }) {
  const d = ev?.data as WbMessage | undefined;
  if (!d || d.wb !== 1 || !ev.fromId) return;
  // Only the tutor (the holder of the owner token, as Daily itself reports it) may switch everyone's layout.
  if (typeof d.present === "boolean" && isOwner(ev.fromId)) { presenting = d.present; busEmit("present", d.present, ev.fromId); emit(); }
  const m = { fromId: ev.fromId, data: d };
  if (d.ops && d.ops.length && !boardShown) { unseen++; emit(); }
  if (consumer) { consumer(m); return; }
  // Only persistent traffic is worth replaying; cursors and laser trails are not.
  if (d.ops || d.hello || d.req || d.go || d.need || d.pad) { buffer.push(m); if (buffer.length > BUFFER_MAX) buffer.shift(); }
}

export function publishCall(c: CallLike | null, m?: CallMeta) {
  if (call === c) { if (m) meta = m; return; }
  if (call) { try { call.off("app-message", onAppMessage as never); } catch { /* call already gone */ } }
  call = c; meta = c ? (m ?? null) : null; buffer = []; presenting = false; unseen = 0; consumer = null;
  if (c) { try { c.on("app-message", onAppMessage as never); } catch { /* not ready — the board can still work locally */ } }
  emit();
}

/** Attach the live consumer: replays what was buffered, then gets everything new. Returns the detach fn. */
export function attachInbox(fn: (m: InboxMsg) => void): () => void {
  consumer = fn;
  const pending = buffer; buffer = [];
  for (const m of pending) fn(m);
  emit();
  return () => { if (consumer === fn) consumer = null; };
}

/** "Open board" on a lesson card: the room that opens next starts on the Board tab (valid for a short while). */
let boardFirstAt = 0;
export const wantBoardFirst = () => { boardFirstAt = Date.now(); };
export const wantsBoardFirst = () => Date.now() - boardFirstAt < 20_000;

export const getCall = () => call;
/** The workspace tells us whether the Board tab is showing (clears the "live" dot when it is). */
export function setBoardShown(on: boolean) { if (boardShown === on) return; boardShown = on; if (on && unseen) unseen = 0; emit(); }
/** Record the tutor's own present/stop (their own broadcast never comes back to them), so a re-mounted board starts in the right state. */
export function setLocalPresenting(on: boolean) { if (presenting !== on) { presenting = on; emit(); } }
export const isPresenting = () => presenting;
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useCallObject = () => useSyncExternalStore(subscribe, () => call, () => null);
export const useCallMeta = () => useSyncExternalStore(subscribe, () => meta, () => null);
/** How many tutor board updates arrived while the Board tab wasn't open (drives its "live" dot). */
export const useUnseenBoardOps = () => useSyncExternalStore(subscribe, () => unseen, () => 0);
export const useTutorPresenting = () => useSyncExternalStore(subscribe, () => presenting, () => false);

// ── a tiny event bus between the board and the call room's layout ──
/** "present": the tutor put the board on the main stage · "workspace": something in the workspace needs to be seen (e.g. a lesson the tutor started teaching). */
type BusEvent = "present" | "workspace";
const bus = new Map<BusEvent, Set<(on: boolean, fromId?: string) => void>>();
export function onBoardBus(ev: BusEvent, fn: (on: boolean, fromId?: string) => void): () => void {
  if (!bus.has(ev)) bus.set(ev, new Set());
  bus.get(ev)!.add(fn);
  return () => { bus.get(ev)?.delete(fn); };
}
export function busEmit(ev: BusEvent, on: boolean, fromId?: string) { bus.get(ev)?.forEach((f) => f(on, fromId)); }

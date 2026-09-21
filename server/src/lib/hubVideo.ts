import { createHash } from "node:crypto";

// Learning Hub — live-lesson video (Daily.co REST).
//
// Lessons involve children, so unlike the sales-call rooms (lib/emails.ts
// ensureLeadVideoUrl, public + unguessable) these rooms are PRIVATE: nobody can
// enter with the room URL alone. Every join needs a meeting token that THIS
// server mints for an authenticated tutor / enrolled parent, inside the lesson's
// join window. Rooms also expire (`exp`), so a stale room can't be reused.
//
// Nothing here talks to Firestore or decides access — routes/hub/lessonsApi.ts
// does both; this file is the Daily wrapper plus the pure join-window maths.

const DAILY = "https://api.daily.co/v1";
const MIN = 60_000;

/** Join window: 10 minutes before the start → 30 minutes after the end. */
export const JOIN_EARLY_MS = 10 * MIN;
export const JOIN_LATE_MS = 30 * MIN;

/** After the scheduled end the call asks "stay on the call?" — this long before the room closes. */
export const STAY_PROMPT_MS = 2 * MIN;
/** Each "Stay" adds this much time to the room, for everyone in it. */
export const STAY_EXTENSION_MS = 15 * MIN;
/** …but never more than this long after the scheduled end (a room left open forever is a safeguarding + cost risk). */
export const MAX_OVERRUN_MS = 4 * 60 * MIN;

export interface JoinWindow { opensAt: Date; closesAt: Date; endsAt: Date }
/** `roomUntil` = how far a "Stay on the call" (or a tutor's reopen) has pushed the room (ISO), if at all. */
export function joinWindow(startsAt: string, durationMins: number, roomUntil?: string | null): JoinWindow {
  const start = new Date(startsAt).getTime();
  const end = start + durationMins * MIN;
  const ext = roomUntil ? new Date(roomUntil).getTime() : 0;
  return { opensAt: new Date(start - JOIN_EARLY_MS), closesAt: new Date(Math.max(end + JOIN_LATE_MS, ext + JOIN_LATE_MS)), endsAt: new Date(end) };
}

/** When the room closes (everyone in it is disconnected): the scheduled end plus a short prompt window, or
 *  wherever "Stay on the call" / a tutor's reopen has pushed it. The 4-hour ceiling counts from the later of the
 *  scheduled end and the reopen, so an OLD lesson a tutor reopens gets a full new session, not an instant close. */
export function roomExpiry(endsAt: Date, roomUntil?: string | null, reopenedAt?: string | null): Date {
  const base = endsAt.getTime() + STAY_PROMPT_MS;
  const ext = roomUntil ? new Date(roomUntil).getTime() : 0;
  const from = Math.max(endsAt.getTime(), reopenedAt ? new Date(reopenedAt).getTime() : 0);
  return new Date(Math.min(Math.max(base, ext), from + MAX_OVERRUN_MS));
}

export type WindowState = "early" | "open" | "closed";
export function windowState(now: Date, w: JoinWindow): WindowState {
  const t = now.getTime();
  return t < w.opensAt.getTime() ? "early" : t > w.closesAt.getTime() ? "closed" : "open";
}

export class VideoError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const videoConfigured = () => !!process.env.DAILY_API_KEY?.trim();
const key = () => {
  const k = process.env.DAILY_API_KEY?.trim();
  if (!k) throw new VideoError(503, "video_unavailable", "Video lessons aren't available right now.");
  return k;
};

async function daily(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${DAILY}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    if (e instanceof VideoError) throw e;
    console.error("[hub-video] Daily unreachable:", (e as Error).message);
    throw new VideoError(503, "video_unavailable", "Video lessons aren't available right now — please try again in a moment.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

/** A stable, unguessable-enough room name per lesson. The room is private, so
 *  the name is not a secret — determinism is what makes ensureRoom idempotent
 *  (two people joining at once can't create two rooms). */
export const roomNameFor = (lessonId: string) => `hub-${createHash("sha1").update(`lesson:${lessonId}`).digest("hex").slice(0, 20)}`;

const unix = (d: Date | number) => Math.floor((typeof d === "number" ? d : d.getTime()) / 1000);

/** Daily's own ceiling for `max_participants` on this account's plan (a value above it is refused by the API — verified against
 *  POST /rooms: 200 is accepted, 201 answers "cannot be set to that value with your current plan"). Overridable with
 *  HUB_ROOM_MAX_PARTICIPANTS when the plan changes; never above 200 unless you know the plan allows it. */
const DAILY_PLAN_MAX = 200;
const roomCeiling = () => {
  const n = Number(process.env.HUB_ROOM_MAX_PARTICIPANTS);
  return Number.isFinite(n) && n >= 4 ? Math.min(Math.floor(n), DAILY_PLAN_MAX) : DAILY_PLAN_MAX;
};
/** How many devices a lesson's room admits: every student + one guardian device each + the tutor + a spare (a co-tutor / a second device),
 *  never fewer than 8, never more than the ceiling. A group of 30 → 64, a 1:1 → 8. The old flat 12 refused the 13th person of a group. */
export function roomCapacity(students: number): number {
  return Math.min(roomCeiling(), Math.max(8, Math.max(1, Math.floor(students)) * 2 + 4));
}

/** The lesson's room, created on first use (private, expiring 30 min after the lesson ends). */
export async function ensureRoom(lessonId: string, closesAt: Date, students = 1): Promise<{ name: string; url: string }> {
  const name = roomNameFor(lessonId);
  const exp = unix(closesAt);
  if (exp <= unix(Date.now())) throw new VideoError(409, "lesson_closed", "This lesson has finished.");
  const made = await daily("POST", "/rooms", {
    name,
    privacy: "private",
    properties: {
      exp,
      eject_at_room_exp: true,
      enable_screenshare: true, // the tutor may share; each family token turns it off (mintToken) — children can't take over the screen
      enable_chat: false,       // Daily's chat is unmoderated and can't be limited per token: children talk to the tutor, not to each other in a text box
      enable_knocking: false,
      enable_prejoin_ui: false,
      max_participants: roomCapacity(students),
      // (No redirect_on_meeting_exit: Daily rejects it on this account's plan — the
      // page handles daily-js's "left-meeting" event and shows its own end screen.)
    },
  });
  if (made.ok && typeof made.json.url === "string") return { name, url: made.json.url };
  // Someone else created it a moment ago (or a previous join did) — reuse it.
  const existing = await daily("GET", `/rooms/${name}`);
  if (existing.ok && typeof existing.json.url === "string") {
    // The lesson may have been rescheduled since: keep the expiry in step.
    // (rooms made before chat was switched off — or before the roster grew — get their settings here.)
    void daily("POST", `/rooms/${name}`, { properties: { exp, enable_chat: false, max_participants: roomCapacity(students) } }).catch(() => {});
    return { name, url: existing.json.url };
  }
  console.error("[hub-video] room creation failed:", made.status, JSON.stringify(made.json).slice(0, 300));
  throw new VideoError(503, "video_unavailable", "Video lessons aren't available right now — please try again in a moment.");
}

/** Mint a per-join meeting token. `is_owner` = the tutor (can mute/eject). The token only controls how long
 *  someone may still JOIN (until the join window closes); it does NOT eject — the room's own expiry does,
 *  and that is what a "Stay on the call" extends for everyone. */
export async function mintToken(opts: { roomName: string; userName: string; isOwner: boolean; endsAt: Date; closesAt: Date; now?: Date; userId?: string }): Promise<string> {
  const exp = unix(opts.closesAt);
  const r = await daily("POST", "/meeting-tokens", {
    // `user_id` is how the whiteboard knows WHICH child a participant is: it is signed into the token, and a client
    // cannot change it (unlike `user_name`), so per-student write permission and private pads can trust it.
    properties: { room_name: opts.roomName, is_owner: opts.isOwner, user_name: opts.userName.slice(0, 60), enable_screenshare: opts.isOwner, ...(opts.userId ? { user_id: opts.userId.slice(0, 200) } : {}), exp, eject_at_token_exp: false },
  });
  if (!r.ok || typeof r.json.token !== "string") {
    console.error("[hub-video] token mint failed:", r.status, JSON.stringify(r.json).slice(0, 300));
    throw new VideoError(503, "video_unavailable", "Video lessons aren't available right now — please try again in a moment.");
  }
  return r.json.token;
}

/** Best-effort: keep an existing room's expiry (and, when the roster changed, its capacity) in step with a rescheduled / edited lesson. */
export async function setRoomExpiry(roomName: string, closesAt: Date | null, students?: number): Promise<void> {
  if (!videoConfigured()) return;
  const properties: Record<string, unknown> = {};
  if (closesAt) properties.exp = unix(closesAt);
  if (students !== undefined) properties.max_participants = roomCapacity(students);
  if (!Object.keys(properties).length) return;
  await daily("POST", `/rooms/${roomName}`, { properties }).catch(() => {});
}

/** Best-effort: remove a room (lesson ended / cancelled / deleted) — also ejects anyone still in it. */
export async function deleteRoom(roomName: string | null | undefined): Promise<void> {
  if (!roomName || !videoConfigured()) return;
  await daily("DELETE", `/rooms/${roomName}`).catch(() => {});
}

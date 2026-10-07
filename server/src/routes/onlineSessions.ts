import { Router } from "express";
import { ownLinkVisible, bookingAwaitingPayOnline, joinState } from "../lib/onlineRules";
import { z } from "zod";
import { db } from "../firebase";
import { rateLimit } from "../lib/rateLimit";
import { ukToday, ukTodayPlus } from "../lib/ukDate";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { registerRows } from "../lib/registerRows";
import { deleteRoom, ensureRoom, joinWindow, mintToken, roomExpiry, roomNameFor, setRoomExpiry, MAX_OVERRUN_MS, STAY_EXTENSION_MS, STAY_PROMPT_MS, VideoError, videoConfigured } from "../lib/hubVideo";
import { bookingJoinable, bookingsFor, hubOn, onlineListing, sessionId, sessionsCol, sessionTimes, type ListingLite } from "../lib/onlineSessions";
import { hubEnrolments } from "../lib/hubCore";
import type { Booking } from "../../../features/bookings/types";

// Online sessions (see lib/onlineSessions.ts). Parents get a Join button on their booking; the host (provider / staff) starts the session.
//  · "platform" mode = the same private Daily room service the Teaching Hub uses; one room per listing + date; token only for the host or a
//    booked child's family; a family can enter only inside the join window AND once the host is in (safeguarding: no children in an empty room).
//  · "own" mode = the provider's own link, handed over only from 10 minutes before the start (or straight away when the listing says so).
// Nothing is recorded: the room has no recording and the platform stores no audio or video.

export const onlineSessions = Router();
const regsCol = db.collection("registers");
const lessonsCol = db.collection("hubLessons");

const HOST_ROLES = new Set(["company", "freelancer", "franchise", "staff"]);
const nowIso = () => new Date().toISOString();
const dayOk = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const lc = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

interface SessionDoc {
  tenantId: string; listingId: string; date: string; startsAt: string; durationMins: number;
  status: "scheduled" | "live" | "ended";
  roomName: string | null; roomUrl: string | null; roomUntil: string | null; reopenedAt?: string | null;
  hostSeenAt: string | null; needsHost: boolean; endedAt: string | null;
  joined: Record<string, string>;
  createdAt: string; updatedAt: string;
}

async function loadOrMake(listing: ListingLite, date: string, timing?: string | null): Promise<{ ref: FirebaseFirestore.DocumentReference; s: SessionDoc }> {
  const ref = sessionsCol.doc(sessionId(listing.id, date));
  const snap = await ref.get();
  if (snap.exists) return { ref, s: snap.data() as SessionDoc };
  const t = await sessionTimes(listing, date, timing);
  const s: SessionDoc = {
    tenantId: listing.tenantId, listingId: listing.id, date, startsAt: t.startsAt.toISOString(), durationMins: t.durationMins, status: "scheduled",
    roomName: null, roomUrl: null, roomUntil: null, hostSeenAt: null, needsHost: false, endedAt: null, joined: {}, createdAt: nowIso(), updatedAt: nowIso(),
  };
  await ref.set(s);
  return { ref, s };
}

const isHostFor = (auth: { role: string; tenantId?: string | null; franchiseId?: string | null }, l: ListingLite) =>
  HOST_ROLES.has(auth.role) && !!auth.tenantId && auth.tenantId === l.tenantId && (!(auth.role === "franchise" || auth.role === "staff") || !auth.franchiseId || (l.franchiseId ?? null) === auth.franchiseId);

const first = (n: string) => n.trim().split(/\s+/)[0] || "Child";

/** The parent's own bookings on this session (matched by sign-in email), and the child rows they are expected for. */
async function myRows(email: string, listingId: string, date: string): Promise<{ b: Booking; rows: ReturnType<typeof registerRows> }[]> {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  return snap.docs.map((d) => fromDoc(d.data() as BookingDoc))
    .filter((b) => b.listingId === listingId && bookingJoinable(b, date))
    .map((b) => ({ b, rows: registerRows(b, date).filter((r) => r.expected) }));
}

async function markRegister(items: { b: Booking; rows: ReturnType<typeof registerRows> }[], listingId: string, date: string, tenantId: string): Promise<void> {
  const at = nowIso();
  for (const { b, rows } of items) {
    if (!b.blockId) continue;
    const ref = regsCol.doc(`${b.blockId}_${date}`);
    const snap = await ref.get();
    const entries = ((snap.data() as { entries?: Record<string, { status?: string }> } | undefined)?.entries ?? {});
    const patch: Record<string, unknown> = {};
    for (const r of rows) if (!entries[r.key]?.status) patch[`entries.${r.key}`] = { status: "in", inAt: at, by: "online-session", at };
    if (!Object.keys(patch).length) continue;
    if (snap.exists) await ref.update(patch);
    else await ref.set({ tenantId, listingId, blockId: b.blockId, date, entries: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k.replace("entries.", ""), v])) });
  }
}

/** Best-effort: when the Teaching Hub is on, show the booked session in the Hub as a lesson (same id → same room) so notes and homework attach. Never throws. */
async function mirrorToHub(listing: ListingLite, date: string, s: SessionDoc, bookings: Booking[]): Promise<void> {
  try {
    if (!(await hubOn(listing.tenantId, listing.franchiseId ?? null))) return;
    const childIds = [...new Set(bookings.flatMap((b) => registerRows(b, date).filter((r) => r.expected && r.childId).map((r) => r.childId!)))];
    const enrolled: string[] = [];
    for (const id of childIds.slice(0, 30)) {
      const e = await hubEnrolments.doc(`${listing.tenantId}__${id}`).get();
      if (e.exists && e.get("active") !== false) enrolled.push(id);
    }
    if (!enrolled.length) return;
    const t = await db.collection("tenants").doc(listing.tenantId).get();
    const id = sessionId(listing.id, date);
    const cur = await lessonsCol.doc(id).get();
    const doc = {
      tenantId: listing.tenantId, franchiseId: listing.franchiseId ?? null,
      tutorUid: (t.get("ownerUid") as string | undefined) ?? "", tutorName: (t.get("name") as string | undefined) ?? "Your provider",
      title: listing.title || listing.name, topicId: null, startsAt: s.startsAt, durationMins: s.durationMins, childIds: enrolled,
      status: s.status === "ended" ? "ended" : s.status === "live" ? "live" : "scheduled", roomName: roomNameFor(id), roomUrl: s.roomUrl, notes: "",
      roomUntil: s.roomUntil, tutorJoinedAt: s.hostSeenAt, endedAt: s.endedAt, needsTutor: s.needsHost, fromOnlineListing: listing.id, updatedAt: nowIso(),
    };
    if (cur.exists) await lessonsCol.doc(id).set(doc, { merge: true });
    else await lessonsCol.doc(id).set({ ...doc, attendance: {}, createdBy: "online-session", createdAt: nowIso() });
  } catch (e) { console.warn("[online-sessions] hub mirror skipped:", (e as Error).message); }
}

async function syncHubAttendance(listing: ListingLite, date: string, rows: { childId?: string }[]): Promise<void> {
  try {
    const id = sessionId(listing.id, date);
    const cur = await lessonsCol.doc(id).get();
    if (!cur.exists) return;
    const have = (cur.get("attendance") as Record<string, string> | undefined) ?? {};
    const patch: Record<string, string> = {};
    for (const r of rows) if (r.childId && (cur.get("childIds") as string[]).includes(r.childId) && !have[r.childId]) patch[`attendance.${r.childId}`] = nowIso();
    if (Object.keys(patch).length) await lessonsCol.doc(id).update(patch);
  } catch { /* the Hub copy is a courtesy */ }
}

const bodySchema = z.object({ listingId: z.string().min(1).max(200), date: z.string() });

function windowOf(s: SessionDoc) { return joinWindow(s.startsAt, s.durationMins, s.roomUntil); }

// GET /api/online-sessions/status — is the platform video-room service switched on? (public-safe: a yes/no, never the key.)
onlineSessions.get("/status", (_req, res) => { res.json({ videoReady: videoConfigured() }); });

// GET /api/online-sessions/mine — the signed-in family's upcoming online sessions (today and the next 60 days, plus yesterday's still-open ones).
onlineSessions.get("/mine", async (req, res) => {
  const email = lc(req.user?.email);
  if (!email) { res.json([]); return; }
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const from = ukTodayPlus(-1), to = ukTodayPlus(60);
  const bookings = snap.docs.map((d) => fromDoc(d.data() as BookingDoc)).filter((b) => b.listingId && b.status === "Confirmed");
  const byListing = new Map<string, Booking[]>();
  for (const b of bookings) byListing.set(b.listingId!, [...(byListing.get(b.listingId!) ?? []), b]);
  const out: Record<string, unknown>[] = [];
  for (const [lid, bs] of byListing) {
    // cheap in-memory check first: a family with years of past bookings must not pay a listing + library read for every one of them
    // (paid bookings can join; unpaid ones are listed too, so the family is told the link unlocks when they pay)
    const dates = new Set<string>();
    for (const b of bs) for (const d of b.days ?? []) if (d >= from && d <= to && (bookingJoinable(b, d) || bookingAwaitingPayOnline(b, d))) dates.add(d);
    if (!dates.size) continue;
    const listing = await onlineListing(lid);
    if (!listing) continue;
    for (const date of [...dates].sort()) {
      const paidMine = bs.filter((b) => bookingJoinable(b, date));
      const unpaidMine = bs.filter((b) => bookingAwaitingPayOnline(b, date));
      const paid = paidMine.length > 0;
      const mine = paid ? paidMine : unpaidMine;
      const rows = mine.flatMap((b) => registerRows(b, date).filter((r) => r.expected));
      const sess = (await sessionsCol.doc(sessionId(lid, date)).get()).data() as SessionDoc | undefined;
      const t = sess ? { startsAt: new Date(sess.startsAt), durationMins: sess.durationMins } : await sessionTimes(listing, date, mine[0]?.timing);
      const w = joinWindow(t.startsAt.toISOString(), t.durationMins, sess?.roomUntil ?? null);
      const now = Date.now();
      if (now > w.closesAt.getTime()) continue;
      const own = listing.videoMode === "own";
      const open = now >= w.opensAt.getTime();
      const hostLive = !!sess && sess.status === "live" && !sess.needsHost;
      out.push({
        listingId: lid, listingName: listing.title || listing.name, date, ref: mine[0]?.ref, refs: mine.map((b) => b.ref), children: rows.map((r) => first(r.name)),
        startsAt: t.startsAt.toISOString(), endsAt: w.endsAt.toISOString(), opensAt: w.opensAt.toISOString(), closesAt: w.closesAt.toISOString(),
        mode: own ? "own" : "platform", state: open ? "open" : "early",
        // One decision for every screen (done page, My bookings, Home): the browser only draws it.
        joinState: joinState({ paid, mode: own ? "own" : "platform", now, opensAt: w.opensAt.getTime(), closesAt: w.closesAt.getTime(), hostLive, hasLink: !!listing.ownLink, showLinkNow: listing.showLinkNow }),
        providerName: (listing as { tenantName?: string }).tenantName ?? "",
        paid, amountDue: paid ? 0 : Math.round(mine.reduce((s, b) => s + (b.amount ?? 0), 0) * 100) / 100, method: mine[0]?.method ?? "",
        hostLive,
        ...(paid && ownLinkVisible(listing, open) ? { link: listing.ownLink } : {}),
        ...(own && !listing.ownLink ? { noLink: true } : {}),
      });
      if (sess && paid) void mirrorToHub(listing, date, sess, mine);
    }
  }
  out.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  res.json(out);
});

// POST /api/online-sessions/join {listingId, date} — host (start/enter) or a booked family.
onlineSessions.post("/join", rateLimit("online-join", 30), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !dayOk(parsed.data.date)) { res.status(400).json({ error: "Which session?" }); return; }
  const { listingId, date } = parsed.data;
  const auth = req.auth!;
  const listing = await onlineListing(listingId);
  if (!listing) { res.status(404).json({ error: "Session not found" }); return; }
  const host = isHostFor(auth, listing);
  let items: Awaited<ReturnType<typeof myRows>> = [];
  let timing: string | null = null;
  if (!host) {
    const email = lc(req.user?.email);
    if (auth.role !== "parent" || !email) { res.status(404).json({ error: "Session not found" }); return; }
    items = await myRows(email, listingId, date);
    if (!items.length || !items.some((i) => i.rows.length)) { res.status(404).json({ error: "This session isn't on your bookings, or the booking isn't confirmed and paid.", code: "not_your_session" }); return; }
    timing = items[0].b.timing ?? null;
  } else {
    const all = await bookingsFor(listingId, date);
    timing = all[0]?.timing ?? null;
  }
  const { ref, s } = await loadOrMake(listing, date, timing);
  const w = windowOf(s);
  const nowMs = Date.now();
  if (nowMs > w.closesAt.getTime()) { res.status(409).json({ error: "This session has finished.", code: "outside_join_window", closesAt: w.closesAt.toISOString() }); return; }

  // ── the provider's own link ──
  if (listing.videoMode === "own") {
    if (host) { res.json({ mode: "own", isOwner: true, link: listing.ownLink ?? null, startsAt: s.startsAt }); return; }
    const open = nowMs >= w.opensAt.getTime();
    if (!listing.ownLink) { res.status(409).json({ error: "Your provider hasn't added the session link yet. They will be in touch.", code: "no_link" }); return; }
    if (!open && !listing.showLinkNow) { res.status(409).json({ error: "The link opens 10 minutes before the session.", code: "early", opensAt: w.opensAt.toISOString() }); return; }
    res.json({ mode: "own", isOwner: false, link: listing.ownLink, startsAt: s.startsAt });
    return;
  }

  // ── our own video room ──
  if (!host) {
    if (nowMs < w.opensAt.getTime()) { res.status(409).json({ error: "The session opens 10 minutes before it starts.", code: "early", opensAt: w.opensAt.toISOString() }); return; }
    if (s.status !== "live" || s.needsHost) { res.status(409).json({ error: "Your host hasn't started the session yet. You can join as soon as they do.", code: "waiting_for_host" }); return; }
    const cap = Number(listing.maxJoiners);
    const keys = items.flatMap((i) => i.rows.map((r) => r.key));
    if (Number.isFinite(cap) && cap > 0 && Object.keys(s.joined).length >= cap && !keys.some((k) => s.joined[k])) { res.status(409).json({ error: "This session is full.", code: "session_full" }); return; }
  }
  if (!videoConfigured()) { res.status(503).json({ error: "Video isn't available right now.", code: "video_unavailable" }); return; }
  try {
    const sid = sessionId(listingId, date);
    let roomUntil = s.roomUntil;
    if (nowMs > w.endsAt.getTime() && roomExpiry(w.endsAt, roomUntil, s.reopenedAt).getTime() < nowMs + STAY_EXTENSION_MS) {
      roomUntil = new Date(Math.min(nowMs + STAY_EXTENSION_MS, Math.max(w.endsAt.getTime(), s.reopenedAt ? new Date(s.reopenedAt).getTime() : 0) + MAX_OVERRUN_MS)).toISOString();
    }
    let expires = roomExpiry(w.endsAt, roomUntil, s.reopenedAt);
    if (nowMs < w.opensAt.getTime() && expires.getTime() > nowMs + MAX_OVERRUN_MS) expires = new Date(nowMs + MAX_OVERRUN_MS);
    const win = joinWindow(s.startsAt, s.durationMins, roomUntil);
    win.closesAt = new Date(Math.min(win.closesAt.getTime(), expires.getTime() + 30 * 60_000));
    const roster = Math.max(1, Object.keys(s.joined).length + 1, (await bookingsFor(listingId, date)).length);
    const room = await ensureRoom(sid, expires, roster);
    void setRoomExpiry(room.name, expires);
    let userName = "";
    let userId: string | undefined;
    if (host) userName = req.user?.name || "Host";
    else {
      const rows = items.flatMap((i) => i.rows);
      userName = [...new Set(rows.map((r) => first(r.name)))].join(" and ").slice(0, 60);
      userId = rows[0]?.childId ? `c:${rows[0].childId}` : undefined;
    }
    const token = await mintToken({ roomName: room.name, userName, isOwner: host, endsAt: w.endsAt, closesAt: win.closesAt, userId });
    const patch: Record<string, unknown> = { updatedAt: nowIso() };
    if (s.roomName !== room.name) { patch.roomName = room.name; patch.roomUrl = room.url; }
    if (roomUntil !== s.roomUntil) patch.roomUntil = roomUntil;
    if (host) { patch.hostSeenAt = nowIso(); patch.needsHost = false; patch.status = "live"; if (s.status === "ended") patch.endedAt = null; }
    await ref.update(patch);
    const merged = { ...s, ...patch } as SessionDoc;
    if (host) void mirrorToHub(listing, date, merged, await bookingsFor(listingId, date));
    res.json({ mode: "platform", url: room.url, token, roomName: room.name, userName, isOwner: host, roomExpiresAt: expires.toISOString(), promptSeconds: Math.round(STAY_PROMPT_MS / 1000), endsAt: w.endsAt.toISOString(), title: listing.title || listing.name });
  } catch (e) {
    if (e instanceof VideoError) { res.status(e.status).json({ error: e.message, code: e.code }); return; }
    throw e;
  }
});

// POST /api/online-sessions/attended {listingId, date} — the family's client confirms it really joined (or opened the link): marks the children present
// on the register (and on the Hub lesson copy). Idempotent.
onlineSessions.post("/attended", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !dayOk(parsed.data.date)) { res.status(400).json({ error: "Which session?" }); return; }
  const { listingId, date } = parsed.data;
  const email = lc(req.user?.email);
  const listing = await onlineListing(listingId);
  if (!listing || req.auth!.role !== "parent" || !email) { res.status(404).json({ error: "Session not found" }); return; }
  const items = await myRows(email, listingId, date);
  const rows = items.flatMap((i) => i.rows);
  if (!rows.length) { res.status(404).json({ error: "Session not found" }); return; }
  const { ref, s } = await loadOrMake(listing, date, items[0].b.timing);
  const w = windowOf(s);
  const nowMs = Date.now();
  // Attendance only counts INSIDE the join window. "Show the link straight away" lets the family SEE the link early, but opening it days ahead must not tick the child present.
  if (nowMs > w.closesAt.getTime() || nowMs < w.opensAt.getTime()) { res.status(409).json({ error: "This session isn't open.", code: "outside_join_window" }); return; }
  if (listing.videoMode !== "own" && s.status !== "live") { res.status(409).json({ error: "This session hasn't started.", code: "waiting_for_host" }); return; }
  const at = nowIso();
  const patch: Record<string, string> = {};
  for (const r of rows) if (!s.joined[r.key]) patch[`joined.${r.key}`] = at;
  if (Object.keys(patch).length) await ref.update(patch);
  await markRegister(items, listingId, date, listing.tenantId);
  void syncHubAttendance(listing, date, rows);
  res.json({ ok: true, children: rows.length });
});

async function hostGuard(req: import("express").Request, res: import("express").Response): Promise<{ listing: ListingLite; date: string; ref: FirebaseFirestore.DocumentReference; s: SessionDoc } | null> {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !dayOk(parsed.data.date)) { res.status(400).json({ error: "Which session?" }); return null; }
  const listing = await onlineListing(parsed.data.listingId);
  if (!listing || !isHostFor(req.auth!, listing)) { res.status(404).json({ error: "Session not found" }); return null; }
  const { ref, s } = await loadOrMake(listing, parsed.data.date);
  return { listing, date: parsed.data.date, ref, s };
}

// POST /api/online-sessions/end — the host closes the session: the room is torn down and families can't rejoin until the host comes back.
onlineSessions.post("/end", async (req, res) => {
  const g = await hostGuard(req, res);
  if (!g) return;
  await g.ref.update({ status: "ended", endedAt: nowIso(), needsHost: true, updatedAt: nowIso() });
  if (g.s.roomName) void deleteRoom(g.s.roomName);
  void mirrorToHub(g.listing, g.date, { ...g.s, status: "ended", endedAt: nowIso(), needsHost: true }, await bookingsFor(g.listing.id, g.date));
  res.json({ ok: true });
});

// POST /api/online-sessions/extend — "Stay on the call": +15 minutes for everyone (host, or a family while the host is in).
onlineSessions.post("/extend", async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success || !dayOk(parsed.data.date)) { res.status(400).json({ error: "Which session?" }); return; }
  const listing = await onlineListing(parsed.data.listingId);
  if (!listing) { res.status(404).json({ error: "Session not found" }); return; }
  const host = isHostFor(req.auth!, listing);
  if (!host) {
    const items = await myRows(lc(req.user?.email), listing.id, parsed.data.date);
    if (!items.length) { res.status(404).json({ error: "Session not found" }); return; }
  }
  const { ref, s } = await loadOrMake(listing, parsed.data.date);
  if (!host && (s.status !== "live" || s.needsHost)) { res.status(409).json({ error: "Your host needs to be in the session to keep it going.", code: "waiting_for_host" }); return; }
  const w = windowOf(s);
  const nowMs = Date.now();
  if (nowMs > w.closesAt.getTime()) { res.status(409).json({ error: "This session has finished.", code: "outside_join_window" }); return; }
  const cap = Math.max(w.endsAt.getTime(), s.reopenedAt ? new Date(s.reopenedAt).getTime() : 0) + MAX_OVERRUN_MS;
  const current = roomExpiry(w.endsAt, s.roomUntil, s.reopenedAt).getTime();
  const next = Math.min(Math.max(current, nowMs) + STAY_EXTENSION_MS, cap);
  if (next <= current) { res.status(409).json({ error: "This session has reached the longest it can run today.", code: "extension_limit", roomExpiresAt: new Date(current).toISOString() }); return; }
  const roomUntil = new Date(next).toISOString();
  await ref.update({ roomUntil, updatedAt: nowIso() });
  if (s.roomName) void setRoomExpiry(s.roomName, new Date(next));
  res.json({ roomExpiresAt: roomUntil, closesAt: joinWindow(s.startsAt, s.durationMins, roomUntil).closesAt.toISOString(), promptSeconds: Math.round(STAY_PROMPT_MS / 1000) });
});

// GET /api/online-sessions/today?date= — the provider's online sessions that day with booked and joined counts.
onlineSessions.get("/today", async (req, res) => {
  const auth = req.auth!;
  if (!HOST_ROLES.has(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const date = typeof req.query.date === "string" && dayOk(req.query.date) ? req.query.date : ukToday();
  const lsnap = await db.collection("listings").where("tenantId", "==", auth.tenantId).get();
  const out: Record<string, unknown>[] = [];
  for (const d of lsnap.docs) {
    const raw = d.data() as { status?: string; archived?: boolean };
    if (raw.archived || raw.status === "draft") continue;
    const listing = await onlineListing(d.id);
    if (!listing || !isHostFor(auth, listing)) continue;
    const bookings = await bookingsFor(listing.id, date);
    if (!bookings.length) continue;
    const t = await sessionTimes(listing, date, bookings[0].timing);
    const sess = (await sessionsCol.doc(sessionId(listing.id, date)).get()).data() as SessionDoc | undefined;
    const w = joinWindow((sess?.startsAt ?? t.startsAt.toISOString()), sess?.durationMins ?? t.durationMins, sess?.roomUntil ?? null);
    const children = bookings.flatMap((b) => registerRows(b, date).filter((r) => r.expected));
    out.push({
      listingId: listing.id, name: listing.title || listing.name, date, startsAt: sess?.startsAt ?? t.startsAt.toISOString(),
      endsAt: w.endsAt.toISOString(), opensAt: w.opensAt.toISOString(), closesAt: w.closesAt.toISOString(),
      status: sess?.status ?? "scheduled", mode: listing.videoMode === "own" ? "own" : "platform",
      booked: children.length, joined: Object.keys(sess?.joined ?? {}).filter((k) => children.some((c) => c.key === k)).length,
      ...(listing.videoMode === "own" ? { link: listing.ownLink ?? null } : {}),
    });
  }
  out.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  res.json(out);
});

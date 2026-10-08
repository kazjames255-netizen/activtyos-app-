import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import type { BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { franchiseListingIds } from "../lib/franchiseScope";
import { staffSiteScope } from "../lib/siteScope";
import { ukToday } from "../lib/ukDate";
import { hasLiveAddonOrders, kitForDay, kitTally, type KitBooking } from "../../../features/bookings/addons";
import { capsFor } from "../middleware/access";
import { capLevel } from "../../../lib/accessMap";
import { kitKey } from "../../../features/bookings/addons";
import { libraryDocId } from "../lib/tenantLibrary";
import { loadSettings } from "../lib/tenantLibrary";

// ─────────────────────────────────────────────────────────────────────────
// ADD-ON ORDERS (was "Kit to prepare") — the provider's pick list of extras (T-shirts, bottles, lunches…) for ONE day.
//
// Built from the bookings that hold a place in that day's sessions (the same way the registers find them), grouped by item and choice, each
// child a line with a tick the team ticks when it is prepared / handed over. The ticks live in `kitTicks` (one doc per tenant + booking + child +
// item + day, so ticking twice is a no-op and a reload keeps them). NO money appears here: prices belong to Money and the Dashboard.
// ─────────────────────────────────────────────────────────────────────────
export const kit = Router();
const ticksCol = db.collection("kitTicks");

// Same people who can mark a register can tick the kit: the team on the ground. Parents and platform read-only accounts cannot.
const canTick = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function tenantOf(req: import("express").Request, res: import("express").Response): Promise<string | null> {
  const auth = req.auth!;
  if (auth.role === "parent") { res.status(403).json({ error: "Requires an operator or staff account" }); return null; }
  let tenantId = auth.tenantId;
  if (auth.role === "platform") {
    tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!tenantId) { res.status(400).json({ error: "Platform accounts must pass ?tenantId=" }); return null; }
  }
  if (!tenantId) { res.status(403).json({ error: "Your account has no tenant" }); return null; }
  // Staff follow their role matrix: the Add-on orders page is open to anyone who can view Bookings OR Registers (the add-on choices are on both).
  if (auth.role === "staff") {
    const caps = await capsFor(req);
    if (capLevel(caps, "bookings") === "none" && capLevel(caps, "registers") === "none") {
      res.status(403).json({ error: "Your role doesn't have access to Bookings or Registers, so it can't see add-on orders. A manager can change this in Setup → Roles & permissions.", code: "no_access", area: "bookings" });
      return null;
    }
  }
  return tenantId;
}

/** The blocks this account may see that have a session in [from, to] (franchise and site scoped, like the registers). */
async function scopedBlocks(auth: NonNullable<import("express").Request["auth"]>, tenantId: string, from: string, to: string) {
  let franchiseListings: Set<string> | null = null;
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) franchiseListings = await franchiseListingIds(tenantId, auth.franchiseId);
  const site = await staffSiteScope(auth);
  const blocksSnap = await db.collection("blocks").where("tenantId", "==", tenantId).get();
  return blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => !franchiseListings || franchiseListings.has(block.listingId))
    .filter(({ block }) => !site || site.listings.has(block.listingId))
    .filter(({ block }) => block.sessions.some((s) => s.date >= from && s.date <= to));
}

/** The optional ?listingId= filter. Applied INSIDE the role scoping above: an id the caller may not see simply matches no block,
 *  exactly like an id that does not exist, so nothing reveals that the listing is real. */
const NO_SUCH_LISTING = "\u0000no-such-listing";
const listingParam = (req: import("express").Request): string => {
  // With the simple query parser "listingId[]=x" arrives as a key literally named "listingId[]": any such lookalike key counts as an odd value.
  if (Object.keys(req.query).some((k) => k !== "listingId" && k.startsWith("listingId"))) return NO_SUCH_LISTING;
  const v = req.query.listingId;
  if (v === undefined) return "";
  // Absent or "" = no filter (the dropdown's "All listings"). A repeated parameter, listingId[]= or listingId[a]= is not a plain string:
  // it behaves exactly like a made-up id (matches nothing), never like "no filter".
  return typeof v === "string" ? v.trim().slice(0, 120) : NO_SUCH_LISTING;
};

/** The bookings of those blocks (every booking; the pure functions keep only the Confirmed ones). */
async function bookingsOfBlocks(blocks: { id: string }[]): Promise<KitBooking[]> {
  const snaps = await Promise.all(blocks.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get()));
  return snaps.flatMap((s) => s.docs.map((d) => fromDoc(d.data() as BookingDoc) as KitBooking));
}

// A minute of caching for the cheap summaries (sidebar, dashboard card, strip, month): they are read on every page load, and an order shows
// within the minute (the screens also refresh on the realtime "bookings" channel, which bypasses nothing: the day view itself is never cached).
const memo = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ttlMs: number, make: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await make();
  memo.set(key, { at: Date.now(), v });
  if (memo.size > 500) for (const k of memo.keys()) { memo.delete(k); if (memo.size < 400) break; }
  return v;
}
const scopeKey = (req: import("express").Request, tenantId: string) => `${tenantId}|${req.auth!.role}|${req.auth!.franchiseId ?? ""}|${req.user?.uid ?? ""}`;

/** Only roles that may message families see a booker's email (the same people who can tick). */
const stripPrivate = (groups: ReturnType<typeof kitForDay>, allowed: boolean) =>
  allowed ? groups : groups.map((g) => ({ ...g, children: g.children.map(({ email: _e, ...c }) => c) }));

const KIT_REMINDER_KEY = "kit-day-before";
async function reminderOn(tenantId: string, auth: NonNullable<import("express").Request["auth"]>): Promise<boolean> {
  const n = ((await loadSettings(tenantId, auth.franchiseId ?? null)).notifications ?? {}) as Record<string, boolean | "bell">;
  return n[KIT_REMINDER_KEY] !== false;
}

// GET /api/kit?date=YYYY-MM-DD&name=T-shirt&listingId=... — what to prepare that day (default today), optionally one add-on only and/or one listing only.
kit.get("/", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const auth = req.auth!;
  const date = typeof req.query.date === "string" && DAY.test(req.query.date) ? req.query.date : ukToday();
  const name = typeof req.query.name === "string" ? req.query.name.slice(0, 80) : "";
  const listingId = listingParam(req);
  const todays = (await scopedBlocks(auth, tenantId, date, date)).filter(({ block }) => !listingId || block.listingId === listingId);
  if (!todays.length) { res.json({ date, canTick: canTick(auth.role), groups: [], ticked: 0, total: 0 }); return; }
  const bookings = await bookingsOfBlocks(todays);
  const groups = stripPrivate(kitForDay(bookings, date, { name }), canTick(auth.role));
  const tickSnap = groups.length ? await ticksCol.where("tenantId", "==", tenantId).where("date", "==", date).get() : null;
  const ticks = new Map<string, { by?: string; at?: string }>();
  tickSnap?.docs.forEach((d) => ticks.set(String(d.get("key")), { by: d.get("by"), at: d.get("at") }));
  let ticked = 0;
  let total = 0;
  const out = groups.map((g) => ({
    ...g,
    children: g.children.map((c) => {
      const t = ticks.get(c.key);
      total += 1;
      if (t) ticked += 1;
      return { ...c, done: !!t, ...(t ? { by: t.by, at: t.at } : {}) };
    }),
  }));
  res.json({ date, canTick: canTick(auth.role), groups: out, ticked, total });
});

// GET /api/kit/days?from=&to=[&name=][&listingId=] — items per day (and per add-on) in a range of up to 93 days, plus the add-on names in it.
// `listings` = the listings the caller may filter by: those IN THEIR SCOPE that have add-on orders in the requested range (it does not shrink
// when a listing or add-on is picked, so the dropdown stays whole). The tally, names, totals and per-day counts follow the listing filter.
// Feeds the "days with orders" strip, the month tally and the Dashboard's next-7-days card.
kit.get("/days", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const auth = req.auth!;
  const from = typeof req.query.from === "string" && DAY.test(req.query.from) ? req.query.from : ukToday();
  let to = typeof req.query.to === "string" && DAY.test(req.query.to) ? req.query.to : from;
  const limit = new Date(`${from}T00:00:00Z`); limit.setUTCDate(limit.getUTCDate() + 92);
  if (to < from) to = from;
  if (to > limit.toISOString().slice(0, 10)) to = limit.toISOString().slice(0, 10);
  const name = typeof req.query.name === "string" ? req.query.name.slice(0, 80) : "";
  const listingId = listingParam(req);
  const out = await cached(`days|${scopeKey(req, tenantId)}|${from}|${to}|${name.toLowerCase()}|${listingId}`, 20_000, async () => {
    const blocks = await scopedBlocks(auth, tenantId, from, to);
    // Bookings per listing (a block belongs to one listing), so the dropdown and the filter come from the same scoped data.
    const byListing = new Map<string, KitBooking[]>();
    await Promise.all(blocks.map(async (b) => {
      const list = byListing.get(b.block.listingId) ?? [];
      byListing.set(b.block.listingId, list);
      list.push(...(await bookingsOfBlocks([b])));
    }));
    const withOrders = [...byListing].filter(([, bs]) => Object.keys(kitTally(bs, from, to).days).length > 0).map(([id]) => id);
    const titles = await Promise.all(withOrders.map((id) => db.collection("listings").doc(id).get()));
    const listings = titles
      .filter((d) => d.exists && d.get("tenantId") === tenantId)
      .map((d) => ({ id: d.id, name: String(d.get("title") ?? d.get("name") ?? d.id) }))
      .sort((a, c) => a.name.localeCompare(c.name));
    const bookings = (listingId ? byListing.get(listingId) : [...byListing.values()].flat()) ?? [];
    const t = kitTally(bookings, from, to, { name });
    const days = Object.entries(t.days).map(([date, v]) => ({ date, items: v.items, byName: v.byName })).sort((a, c) => a.date.localeCompare(c.date));
    const totals: Record<string, number> = {};
    let total = 0;
    for (const d of days) { total += d.items; for (const [n, c] of Object.entries(d.byName)) totals[n] = (totals[n] ?? 0) + c; }
    return { from, to, days, names: t.names, total, totals, listings };
  });
  res.json({ ...out, canTick: canTick(auth.role), canRemind: auth.role === "company" || auth.role === "freelancer" || auth.role === "franchise", reminder: await reminderOn(tenantId, auth) });
});

// GET /api/kit/live — does this provider have LIVE add-on orders (a Confirmed booking with an extra still to prepare today or later)?
// The sidebar shows "Add-on orders" only when this is true, and the Dashboard card likewise. Cached for a minute.
kit.get("/live", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const auth = req.auth!;
  const today = ukToday();
  const live = await cached(`live|${scopeKey(req, tenantId)}|${today}`, 60_000, async () => {
    const blocks = await scopedBlocks(auth, tenantId, today, "9999-12-31");
    if (!blocks.length) return false;
    return hasLiveAddonOrders(await bookingsOfBlocks(blocks), today);
  });
  res.json({ live });
});

// PUT /api/kit/reminder {on} — the "Remind me the day before" switch on the Add-on orders screen. It is the same Setup > Notifications switch
// ("kit-day-before"), so it can be changed in either place. Only accounts that can edit Setup may change it.
kit.put("/reminder", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const auth = req.auth!;
  if (!(auth.role === "company" || auth.role === "freelancer" || auth.role === "franchise")) { res.status(403).json({ error: "Only the account owner can change this" }); return; }
  const parsed = z.object({ on: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = db.collection("libraries").doc(libraryDocId(tenantId, auth.role === "franchise" ? auth.franchiseId : null));
  const snap = await ref.get();
  const lib = (snap.data() ?? {}) as Record<string, unknown>;
  const settings = (lib.settings ?? {}) as Record<string, unknown>;
  const notifications = { ...((settings.notifications ?? {}) as Record<string, boolean | "bell">) };
  // On keeps a "bell only" choice made in Setup; off is an explicit false (absent = on).
  if (parsed.data.on) { if (notifications[KIT_REMINDER_KEY] === false) delete notifications[KIT_REMINDER_KEY]; } else notifications[KIT_REMINDER_KEY] = false;
  await ref.set({ ...lib, tenantId, settings: { ...settings, notifications } });
  res.json({ ok: true, on: parsed.data.on });
});

const tickSchema = z.object({ key: z.string().min(3).max(300), ref: z.string().min(1).max(60), date: z.string().regex(DAY), done: z.boolean() });

// POST /api/kit/tick {key, ref, date, done} — tick (or untick) one child's one item for one day. Idempotent.
kit.post("/tick", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  if (!canTick(req.auth!.role)) { res.status(403).json({ error: "Your account can't tick items off" }); return; }
  const parsed = tickSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { key, ref, date, done } = parsed.data;
  // The booking must be in THIS tenant and inside the caller's franchise / site (the same scope the page shows), never a bare ref from the client.
  const owned = await db.collection("bookings").where("tenantId", "==", tenantId).where("ref", "==", ref).limit(1).get();
  if (owned.empty) { res.status(404).json({ error: "Booking not found" }); return; }
  const booking = fromDoc(owned.docs[0].data() as BookingDoc) as KitBooking & { blockId?: string };
  const mine = await scopedBlocks(req.auth!, tenantId, date, date);
  if (!booking.blockId || !mine.some((b) => b.id === booking.blockId)) { res.status(403).json({ error: "That order isn't at one of your sites" }); return; }
  // The key must be this booking's, for this date. Ticking ON needs a real item (a Confirmed booking's add-on that day); unticking only needs the key to belong to the booking and date.
  const slug = kitKey(ref, "", "", "", "").split("__")[0];
  const belongs = key.startsWith(`${slug}__`) && key.endsWith(`__${date}`);
  const real = kitForDay([booking], date).some((g) => g.children.some((c) => c.key === key && c.ref === ref));
  if (!belongs || (done && !real)) { res.status(400).json({ error: "That tick doesn't match this booking and day" }); return; }
  const id = `${tenantId}_${key}`.slice(0, 480);
  if (done) {
    const by = req.user?.name || req.user?.email || "staff";
    await ticksCol.doc(id).set({ tenantId, key, ref, date, by, at: new Date().toISOString() });
  } else {
    await ticksCol.doc(id).delete().catch(() => {});
  }
  res.json({ ok: true, done });
});

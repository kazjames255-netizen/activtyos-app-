import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import type { BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { franchiseListingIds } from "../lib/franchiseScope";
import { staffSiteScope } from "../lib/siteScope";
import { ukToday } from "../lib/ukDate";
import { kitForDay, type KitBooking } from "../../../features/bookings/addons";

// ─────────────────────────────────────────────────────────────────────────
// KIT TO PREPARE — the provider's pick list of extras (T-shirts, bottles, lunches…) for ONE day.
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
  return tenantId;
}

// GET /api/kit?date=YYYY-MM-DD — what to prepare that day (default today).
kit.get("/", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  const auth = req.auth!;
  const date = typeof req.query.date === "string" && DAY.test(req.query.date) ? req.query.date : ukToday();
  let franchiseListings: Set<string> | null = null;
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) franchiseListings = await franchiseListingIds(tenantId, auth.franchiseId);
  const site = await staffSiteScope(auth);
  const blocksSnap = await db.collection("blocks").where("tenantId", "==", tenantId).get();
  const todays = blocksSnap.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => !franchiseListings || franchiseListings.has(block.listingId))
    .filter(({ block }) => !site || site.listings.has(block.listingId))
    .filter(({ block }) => block.sessions.some((s) => s.date === date));
  if (!todays.length) { res.json({ date, canTick: canTick(auth.role), groups: [], ticked: 0, total: 0 }); return; }
  const snaps = await Promise.all(todays.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get()));
  const bookings: KitBooking[] = snaps.flatMap((s) => s.docs.map((d) => fromDoc(d.data() as BookingDoc) as KitBooking));
  const groups = kitForDay(bookings, date);
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

const tickSchema = z.object({ key: z.string().min(3).max(300), ref: z.string().min(1).max(60), date: z.string().regex(DAY), done: z.boolean() });

// POST /api/kit/tick {key, ref, date, done} — tick (or untick) one child's one item for one day. Idempotent.
kit.post("/tick", async (req, res) => {
  const tenantId = await tenantOf(req, res);
  if (!tenantId) return;
  if (!canTick(req.auth!.role)) { res.status(403).json({ error: "Your account can't tick items off" }); return; }
  const parsed = tickSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { key, ref, date, done } = parsed.data;
  // The key must belong to a booking of THIS tenant (never trust a ref from the client).
  const owned = await db.collection("bookings").where("tenantId", "==", tenantId).where("ref", "==", ref).limit(1).get();
  if (owned.empty) { res.status(404).json({ error: "Booking not found" }); return; }
  const id = `${tenantId}_${key}`.slice(0, 480);
  if (done) {
    const by = req.user?.name || req.user?.email || "staff";
    await ticksCol.doc(id).set({ tenantId, key, ref, date, by, at: new Date().toISOString() });
  } else {
    await ticksCol.doc(id).delete().catch(() => {});
  }
  res.json({ ok: true, done });
});

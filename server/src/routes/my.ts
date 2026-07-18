import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import type { Booking } from "../../../features/bookings/types";
import { applyParentCancel, buildBooking } from "../../../features/bookings/mutations";
import { applyDiscounts, type DiscountRule } from "../../../features/listings/discounts";
import {
  resolveBundlePricing,
  type BundleDoc,
  type PassDoc,
  type PeriodDoc,
  type ResolvedPricing,
} from "../lib/bundlePricing";
import {
  blockCountDelta,
  bookingSeats,
  sessionLabel,
  type BlockDoc,
} from "../lib/blockDomain";
import { emailBookingRequestReceived } from "../lib/emails";
import { upsertCustomerFromBooking } from "../lib/customerUpsert";
import { bookingDocId } from "./bookings";

// Parent ("my") endpoints. Identity comes exclusively from the verified
// Firebase token — the booker email is stamped server-side and every read
// and write is scoped to it, so one family can never touch another's
// bookings. Bookings land in the tenant that owns the chosen listing.
export const my = Router();

const bookingsCol = db.collection("bookings");

// One basket item = one child on one pass (optionally a specific timing and
// specific days). The legacy single-booking shape is accepted too and
// treated as a one-item basket.
const itemSchema = z.object({
  pass: z.string().min(1),
  periodId: z.string().max(60).optional(), // bundle timing
  dates: z.array(z.string().max(10)).min(1).max(60).optional(), // chosen session days
  child: z.string().min(1).max(80),
  age: z.number().int().nonnegative(),
  addons: z
    .array(z.object({ id: z.string().max(60), days: z.array(z.string().max(10)).max(60).optional() }))
    .max(20)
    .optional(),
});
const basketSchema = z.object({
  listingId: z.string().min(1),
  blockId: z.string().min(1),
  method: z.string().min(1),
  items: z.array(itemSchema).min(1).max(20),
});
const legacySchema = z.object({
  listingId: z.string().min(1),
  blockId: z.string().min(1),
  pass: z.string().min(1),
  child: z.string().min(1),
  age: z.number().int().nonnegative(),
  method: z.string().min(1),
});

const cancelSchema = z.object({
  msg: z.string().max(500).optional(),
});

const childSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.number().int().min(0).max(17).optional(),
  dob: z.string().trim().max(20).optional(),
  school: z.string().trim().max(120).optional(),
  allergies: z.string().trim().max(300).optional(),
  medical: z.string().trim().max(300).optional(),
  send: z.string().trim().max(300).optional(),
  // Photo consent — safeguarding: may this child appear in photos
  // (Moments/newsfeed)? Defaults to NO (privacy-safe).
  photoConsent: z.boolean().optional().default(false),
  // Small avatar as a data URL (client resizes to ~128px). Placeholder until
  // the real file-storage milestone.
  photo: z
    .string()
    .startsWith("data:image/")
    .max(150_000)
    .optional(),
});

const childrenCol = db.collection("children");

// "14 Mar 2018" → age in years (used when the parent gives a DOB but no age).
function ageFromDob(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a <= 25 ? a : undefined;
}

function tokenEmail(req: { user?: { email?: string } }): string | null {
  return req.user?.email ?? null;
}

// GET /api/my/bookings — the signed-in parent's bookings, any provider.
my.get("/bookings", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const snap = await bookingsCol.where("email", "==", email).get();
  const list = snap.docs.map((d) => fromDoc(d.data() as BookingDoc));
  list.sort((a, b) => (a.ref < b.ref ? 1 : -1));
  res.json(list);
});

const round2 = (n: number) => Math.round(n * 100) / 100;

// POST /api/my/bookings — parent checkout. Takes a BASKET (or the legacy
// single-booking shape) and creates one booking per item, atomically:
// either the whole basket gets places or the whole basket waitlists.
// EVERY price is computed here — pass/timing from the bundle's resolver,
// add-ons from the tenant library, automatic discounts across the basket —
// the client only ever sends choices, never amounts.
my.post("/bookings", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  // Legacy single-booking bodies become a one-item basket.
  const legacy = legacySchema.safeParse(req.body);
  const parsed = legacy.success
    ? {
        success: true as const,
        data: {
          listingId: legacy.data.listingId,
          blockId: legacy.data.blockId,
          method: legacy.data.method,
          items: [{ pass: legacy.data.pass, child: legacy.data.child, age: legacy.data.age }],
        },
      }
    : basketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const input = parsed.data;

  const listingSnap = await db.collection("listings").doc(input.listingId).get();
  if (!listingSnap.exists) {
    res.status(400).json({ error: "Unknown listing" });
    return;
  }
  const listing = listingSnap.data() as {
    name: string;
    tenantId: string;
    tenantName?: string;
    passes: { name: string; price: number; days?: number }[];
    blockId?: string | null; // block bundle (timings live there)
    status?: string;
    archived?: boolean;
    opensAt?: string;
    waitlist?: boolean;
    bookingType?: "auto" | "manual";
    discounts?: DiscountRule[];
  };
  // Lifecycle gates — the client-side lock is a courtesy, this is the control.
  if ((listing.status ?? "live") !== "live" || listing.archived) {
    res.status(409).json({ error: "This listing isn't open for booking" });
    return;
  }
  if (listing.opensAt && Date.now() < new Date(listing.opensAt).getTime()) {
    res.status(409).json({
      error: `Booking hasn't opened yet — it opens ${new Date(listing.opensAt).toLocaleString("en-GB")}`,
      opensAt: listing.opensAt,
    });
    return;
  }

  // Pricing context: the bundle's resolved passes/timings (server-priced),
  // the block's real session dates, and the library's add-ons.
  const blockPre = await db.collection("blocks").doc(input.blockId).get();
  if (!blockPre.exists || blockPre.data()!.listingId !== input.listingId) {
    res.status(400).json({ error: "Unknown block" });
    return;
  }
  const sessionDates = (blockPre.data() as BlockDoc).sessions.map((s) => s.date);

  let resolved: ResolvedPricing | null = null;
  let periodTitle = new Map<string, string>();
  if (listing.blockId) {
    const bSnap = await db.collection("blockBundles").doc(listing.blockId).get();
    if (bSnap.exists && bSnap.data()!.tenantId === listing.tenantId) {
      const bundle = bSnap.data() as BundleDoc;
      const [periodSnaps, passSnaps] = await Promise.all([
        Promise.all((bundle.periodIds ?? []).map((id) => db.collection("periods").doc(id).get())),
        Promise.all((bundle.passIds ?? []).map((id) => db.collection("passes").doc(id).get())),
      ]);
      const periodsById = new Map(
        periodSnaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...(s.data() as PeriodDoc) }]),
      );
      const passesById = new Map(
        passSnaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...(s.data() as PassDoc) }]),
      );
      resolved = resolveBundlePricing(bundle, passesById, periodsById);
      periodTitle = new Map([...periodsById.values()].map((p) => [p.id, p.title]));
    }
  }
  const needsAddons = input.items.some((i) => i.addons?.length);
  const libAddons = new Map<string, { name: string; type: string; price: number }>();
  if (needsAddons) {
    const lib = await db.collection("libraries").doc(listing.tenantId).get();
    for (const a of ((lib.data()?.addons ?? []) as { id: string; name: string; type: string; price: number }[]))
      libAddons.set(a.id, a);
  }

  // Price each item (base pass/timing + add-ons) and validate its days.
  let priced;
  try {
    priced = input.items.map((item) => {
      const listedPass = listing.passes.find((p) => p.name === item.pass);
      const resolvedPass = resolved?.passes.find((p) => p.name === item.pass);
      if (!listedPass && !resolvedPass) throw new HttpError(400, `Listing has no pass "${item.pass}"`);
      let base = resolvedPass?.price ?? listedPass!.price;
      let timing: string | undefined;
      if (item.periodId) {
        if (!resolved || !resolvedPass) throw new HttpError(400, "This listing has no timings");
        const t = resolved.timings[`${resolvedPass.id}_${item.periodId}`];
        if (t === undefined) throw new HttpError(400, "Unknown timing for this pass");
        base = t;
        timing = periodTitle.get(item.periodId);
      }
      const passDays = resolvedPass?.days ?? listedPass?.days;
      let days = item.dates ?? (passDays && passDays < sessionDates.length ? sessionDates.slice(0, passDays) : sessionDates);
      days = [...new Set(days)].sort();
      if (days.some((d) => !sessionDates.includes(d)))
        throw new HttpError(400, `This block doesn't run on ${days.find((d) => !sessionDates.includes(d))}`);
      if (passDays && days.length > passDays)
        throw new HttpError(400, `"${item.pass}" covers ${passDays} day${passDays === 1 ? "" : "s"} — ${days.length} picked`);
      const addons = (item.addons ?? []).map((a) => {
        const def = libAddons.get(a.id);
        if (!def) throw new HttpError(400, "Unknown add-on");
        const onDays = a.days ? [...new Set(a.days)] : days;
        if (onDays.some((d) => !days.includes(d)))
          throw new HttpError(400, `Add-on "${def.name}" is on a day the pass isn't`);
        const price = def.type === "perday" ? round2(def.price * onDays.length) : def.price;
        return { name: def.name, price, label: def.type === "perday" ? `${def.name} × ${onDays.length}` : def.name };
      });
      return { item, base, timing, days, addons, addonsTotal: round2(addons.reduce((s, a) => s + a.price, 0)) };
    });
  } catch (e) {
    if (e instanceof HttpError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    throw e;
  }

  // Automatic discounts across the basket, with the shared engine. The
  // engine prices "these pass lines × N attendees", so when every child has
  // the same lines we use it exactly (multi-person rules apply); a mixed
  // basket falls back to per-line pricing (attendees=1 — never overcharges).
  const attendees = new Set(input.items.map((i) => i.child.trim())).size;
  const lineKey = (p: (typeof priced)[0]) => `${p.item.pass}|${p.item.periodId ?? ""}|${p.base}|${p.days.length}`;
  const byChild = new Map<string, string>();
  for (const p of priced) {
    const c = p.item.child.trim();
    byChild.set(c, [...(byChild.get(c) ?? ""), lineKey(p)].sort().join("~"));
  }
  const uniform = new Set(byChild.values()).size === 1;
  const engineLines = uniform
    ? [...new Map(priced.map((p) => [lineKey(p), p])).values()]
    : priced;
  const { total: discounted } = applyDiscounts(
    listing.discounts ?? [],
    engineLines.map((p) => ({ name: p.item.pass, price: p.base, days: p.days.length })),
    uniform ? attendees : 1,
  );
  const passGross = round2(priced.reduce((s, p) => s + p.base, 0));
  const discountOff = Math.max(0, round2(passGross - discounted));
  // Spread the discount across items in proportion to their base price.
  const amounts = priced.map((p) =>
    round2(p.base - (passGross > 0 ? (p.base / passGross) * discountOff : 0) + p.addonsTotal),
  );
  // Rounding drift lands on the last item so the sum is exact.
  const target = round2(discounted + priced.reduce((s, p) => s + p.addonsTotal, 0));
  const drift = round2(target - amounts.reduce((s, a) => round2(s + a), 0));
  if (amounts.length) amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + drift);

  const bookerName = req.user?.name || email.split("@")[0];
  const tenantRef = db.collection("tenants").doc(listing.tenantId);
  const blockRef = db.collection("blocks").doc(input.blockId);
  // Auto-confirm listings seat parents immediately; manual ones hold the
  // place pending the operator's approval. Unpaid until payments land.
  const placedStatus = listing.bookingType === "auto" ? "Confirmed" : "Approval needed";

  try {
    const bookings = await db.runTransaction(async (tx) => {
      const [tenantSnap, blockSnap] = await Promise.all([tx.get(tenantRef), tx.get(blockRef)]);
      if (!tenantSnap.exists) throw new HttpError(400, "Listing's provider no longer exists");
      if (!blockSnap.exists) throw new HttpError(400, "Unknown block");
      const block = blockSnap.data() as BlockDoc;
      if (block.listingId !== input.listingId || block.tenantId !== listing.tenantId)
        throw new HttpError(400, "Block does not belong to this listing");

      const seatsWanted = priced.length;
      // All or nothing: either every child gets a place or the whole basket
      // joins the waitlist together — no splitting siblings.
      const hasSpace = block.open && block.bookedCount + seatsWanted <= block.capacity;
      if (!hasSpace && listing.waitlist === false)
        throw new HttpError(409, "This block is full and the waitlist is off");
      let waitPos = 0;
      if (!hasSpace) {
        const waiting = await tx.get(
          bookingsCol.where("blockId", "==", blockSnap.id).where("status", "==", "Waitlisted"),
        );
        waitPos = waiting.size;
      }

      const nextBid: number = tenantSnap.data()!.nextBid ?? 10312;
      const created: Booking[] = priced.map((p, i) => ({
        ...buildBooking(
          {
            booker: bookerName,
            email,
            child: p.item.child,
            age: p.item.age,
            listing: listing.name,
            pass: p.timing ? `${p.item.pass} · ${p.timing}` : p.item.pass,
            dates: block.name,
            amount: amounts[i],
            method: input.method,
          },
          nextBid + i,
        ),
        tenantId: listing.tenantId,
        blockId: blockSnap.id,
        seats: 1,
        days: p.days,
        ...(p.timing ? { timing: p.timing } : {}),
        addons: p.addons.map((a) => `${a.label} — £${a.price.toFixed(2)}`),
        sessions: block.sessions.filter((s) => p.days.includes(s.date)).map(sessionLabel),
        status: hasSpace ? placedStatus : "Waitlisted",
        pay: "Unpaid",
        note: hasSpace ? "" : `Waitlist position ${waitPos + i + 1}`,
      }));
      tx.update(tenantRef, { nextBid: nextBid + created.length });
      if (hasSpace) tx.update(blockRef, { bookedCount: block.bookedCount + seatsWanted });
      for (const b of created) tx.set(bookingsCol.doc(bookingDocId(listing.tenantId, b.ref)), toDoc(b));
      return created;
    });

    // One email for the basket, not one per child.
    emailBookingRequestReceived(bookings[0], listing.tenantName ?? listing.name);
    // Keep Customers & families current (one upsert per child, same family).
    for (const b of bookings) void upsertCustomerFromBooking(listing.tenantId, b);
    res.status(201).json(legacy.success ? bookings[0] : { bookings, total: target });
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// POST /api/my/bookings/:ref/cancel — cancellation request (refund pending,
// for the provider to approve/decline). Only the booking's own family can.
my.post("/bookings/:ref/cancel", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const parsed = cancelSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }

  // Find the parent's own booking with this ref (email-scoped query, so a
  // ref from another family is simply never found).
  const matches = await bookingsCol
    .where("email", "==", email)
    .where("ref", "==", req.params.ref)
    .limit(1)
    .get();
  if (matches.empty) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const ref = matches.docs[0].ref;

  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "Booking not found");
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.email !== email) throw new HttpError(403, "Not your booking");
      if (b.status === "Cancelled") throw new HttpError(400, "Already cancelled");
      const oldStatus = b.status;
      applyParentCancel(b, parsed.data.msg);
      // Free the block place the booking held (all reads before writes).
      const delta = b.blockId ? blockCountDelta(oldStatus, b.status, bookingSeats(b)) : 0;
      let blockUpdate: { ref: FirebaseFirestore.DocumentReference; count: number } | null = null;
      if (delta !== 0) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId!));
        if (blockSnap.exists) {
          const count = Math.max(0, (blockSnap.data()!.bookedCount ?? 0) + delta);
          blockUpdate = { ref: blockSnap.ref, count };
        }
      }
      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { bookedCount: blockUpdate.count });
      return b;
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// ——— Children (the parent's own child profiles — account-level, not
// tenant-scoped: a family exists across providers). Owned strictly by the
// signed-in account via parentUid.

my.get("/children", async (req, res) => {
  const snap = await childrenCol.where("parentUid", "==", req.user!.uid).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { name: string }) }));
  list.sort((a, b) => (a.name < b.name ? -1 : 1));
  res.json(list);
});

my.post("/children", async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const age = parsed.data.age ?? ageFromDob(parsed.data.dob);
  const doc = { ...parsed.data, ...(age !== undefined ? { age } : {}), parentUid: req.user!.uid };
  const ref = await childrenCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

my.put("/children/:id", async (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const snap = await childrenCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.parentUid !== req.user!.uid) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  const age = parsed.data.age ?? ageFromDob(parsed.data.dob);
  const doc = { ...parsed.data, ...(age !== undefined ? { age } : {}), parentUid: req.user!.uid };
  await snap.ref.set(doc);
  res.json({ id: snap.id, ...doc });
});

my.delete("/children/:id", async (req, res) => {
  const snap = await childrenCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.parentUid !== req.user!.uid) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  await snap.ref.delete();
  res.json({ ok: true });
});

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

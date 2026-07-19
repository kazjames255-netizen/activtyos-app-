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
  bookingDays,
  bookingSeats,
  countsUpdate,
  daysHaveSpace,
  sessionLabel,
  type BlockDoc,
} from "../lib/blockDomain";

const prettyDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
import {
  emailBookingConfirmed,
  emailBookingRequestReceived,
  emailFamilyBookingCreated,
} from "../lib/emails";
import { auth as fbAuth } from "../firebase";
import { canWrite } from "../middleware/role";
import { queuePositions, triggerWaitlist } from "../lib/waitlist";
import { upsertCustomerFromBooking } from "../lib/customerUpsert";
import { bookingDocId } from "./bookings";
import { grantPlanAccess } from "./childFiles";

// Parent ("my") endpoints. Identity comes exclusively from the verified
// Firebase token — the booker email is stamped server-side and every read
// and write is scoped to it, so one family can never touch another's
// bookings. Bookings land in the tenant that owns the chosen listing.
export const my = Router();

const bookingsCol = db.collection("bookings");

// One basket item = one child on one pass (optionally a specific timing and
// specific days). The legacy single-booking shape is accepted too and
// treated as a one-item basket.
/** The library's own view of an add-on, including anything it asks the parent. */
type LibAddon = {
  id: string; name: string; type: string; price: number;
  questions?: { id: string; label: string; type: "text" | "choice"; options?: string[]; required?: boolean }[];
};

const itemSchema = z.object({
  pass: z.string().min(1),
  periodId: z.string().max(60).optional(), // bundle timing, by id…
  timing: z.string().max(120).optional(), // …or by period title (checkout sends titles)
  dates: z.array(z.string().max(10)).min(1).max(60).optional(), // chosen session days
  child: z.string().min(1).max(80),
  // Optional: the checkout may only know the child's name — the server then
  // fills the age from the family's saved child profile (dob-derived).
  age: z.number().int().nonnegative().optional(),
  addons: z
    .array(
      z.object({
        id: z.string().max(60),
        days: z.array(z.string().max(10)).max(60).optional(),
        // Answers to that add-on's questions, keyed by question id — a size,
        // a meal choice. Checked against the library definition below.
        answers: z.record(z.string().max(60), z.string().trim().max(200)).optional(),
      }),
    )
    .max(20)
    .optional(),
});
const basketSchema = z.object({
  listingId: z.string().min(1),
  blockId: z.string().min(1),
  method: z.string().min(1),
  items: z.array(itemSchema).min(1).max(20),
  // Operators only (§G-3/§H): book FOR a family — same pricing/capacity
  // path, the booking lands on their account (found or created by email).
  onBehalfOf: z
    .object({
      customerId: z.string().max(60).optional(),
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().email().max(160).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .optional(),
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
  // Safeguarding: the word anyone other than the usual adult must give to
  // collect this child. Plain text on purpose — staff read it off the
  // register — so it must never be treated as, or reused as, a credential.
  collectionPassword: z.string().trim().max(60).optional(),
  // A SEND/EHCP plan, held by routes/childFiles.ts rather than inline: a real
  // EHCP is a multi-page scan and would blow Firestore's 1MB document cap.
  // Only the id and the filename live on the child.
  sendPlanId: z.string().trim().max(60).optional(),
  sendPlanName: z.string().trim().max(200).optional(),
  // What settles them and what doesn't — the things a parent tells you at the
  // door, kept so they don't have to say it twice.
  likes: z.string().trim().max(300).optional(),
  dislikes: z.string().trim().max(300).optional(),
  /** Colours the child's chip in the parent's list. Optional by design. */
  sex: z.enum(["boy", "girl"]).optional(),
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

  // "On behalf of": the operator authenticates, the FAMILY owns the booking.
  let familyEmail = email;
  let familyName = req.user?.name || email.split("@")[0];
  let accountCreated = false;
  let passwordLink: string | null = null;
  const onBehalf = "onBehalfOf" in input ? input.onBehalfOf : undefined;
  if (onBehalf) {
    const authCtx = req.auth!;
    if (!canWrite(authCtx.role) || !authCtx.tenantId) {
      res.status(403).json({ error: "Booking for a family requires an operator account" });
      return;
    }
    let target = { name: onBehalf.name ?? "", email: onBehalf.email ?? "", phone: onBehalf.phone ?? "" };
    if (onBehalf.customerId) {
      const cust = await db.collection("customers").doc(onBehalf.customerId).get();
      if (!cust.exists || cust.data()!.tenantId !== authCtx.tenantId) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      const c = cust.data() as { name?: string; email?: string; phone?: string };
      target = { name: target.name || c.name || "", email: target.email || c.email || "", phone: target.phone || c.phone || "" };
    }
    if (!target.email) {
      res.status(400).json({ error: "The family needs an email address" });
      return;
    }
    // Find-or-create is the server's guarantee against duplicate accounts:
    // an email that already has an ActivityOS account gets THIS booking on
    // that account, never a second one.
    try {
      await fbAuth.getUserByEmail(target.email);
    } catch {
      const created = await fbAuth.createUser({
        email: target.email,
        displayName: target.name || undefined,
        // No password — they set their own via the emailed link. A password
        // in an inbox lives forever.
      });
      await db.collection("users").doc(created.uid).set({ email: target.email, role: "parent", chosen: true });
      accountCreated = true;
      passwordLink = await fbAuth.generatePasswordResetLink(target.email).catch(() => null);
    }
    familyEmail = target.email;
    familyName = target.name || target.email.split("@")[0];
  }

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
    waitlistSize?: string;
    waitlistMode?: "manual" | "auto";
    bookingType?: "auto" | "manual";
    discounts?: DiscountRule[];
  };
  // Lifecycle gates — the client-side lock is a courtesy, this is the control.
  if ((listing.status ?? "live") !== "live" || listing.archived) {
    res.status(409).json({ error: "This listing isn't open for booking" });
    return;
  }
  if (onBehalf && listing.tenantId !== req.auth!.tenantId) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  if (!onBehalf && listing.opensAt && Date.now() < new Date(listing.opensAt).getTime()) {
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
  // Ages the checkout didn't send come from the family's saved child
  // profiles (matched by name; dob-derived when no stored age).
  const missingAge = input.items.some((i) => i.age === undefined);
  const ageOf = new Map<string, number>();
  if (missingAge) {
    const kids = await childrenCol.where("parentUid", "==", req.user!.uid).get();
    for (const d of kids.docs) {
      const k = d.data() as { name: string; age?: number; dob?: string };
      const age = k.age ?? ageFromDob(k.dob);
      if (age !== undefined) ageOf.set(k.name.trim().toLowerCase(), age);
    }
  }
  const itemAge = (i: { child: string; age?: number }) =>
    i.age ?? ageOf.get(i.child.trim().toLowerCase()) ?? 0;

  const needsAddons = input.items.some((i) => i.addons?.length);
  const libAddons = new Map<string, LibAddon>();
  if (needsAddons) {
    const lib = await db.collection("libraries").doc(listing.tenantId).get();
    for (const a of ((lib.data()?.addons ?? []) as LibAddon[]))
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
      // Timing by id, or by title (the checkout's basket knows titles).
      let periodId = item.periodId;
      if (!periodId && item.timing) {
        for (const [pid, title] of periodTitle) if (title === item.timing) periodId = pid;
        if (!periodId) throw new HttpError(400, `Unknown timing "${item.timing}"`);
      }
      if (periodId) {
        if (!resolved || !resolvedPass) throw new HttpError(400, "This listing has no timings");
        const t = resolved.timings[`${resolvedPass.id}_${periodId}`];
        if (t === undefined) throw new HttpError(400, "Unknown timing for this pass");
        base = t;
        timing = periodTitle.get(periodId);
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
        // Judge the answers against the library, not the client: a required
        // question left blank, or a size that isn't one of the offered ones,
        // is an order the provider can't fill.
        const answers: { label: string; value: string }[] = [];
        for (const q of def.questions ?? []) {
          const value = (a.answers ?? {})[q.id]?.trim() ?? "";
          if (!value) {
            if (q.required) throw new HttpError(400, `"${def.name}" needs an answer for ${q.label} (${item.child})`);
            continue;
          }
          if (q.type === "choice" && (q.options ?? []).length && !(q.options ?? []).includes(value))
            throw new HttpError(400, `"${value}" isn't one of the options for ${q.label}`);
          answers.push({ label: q.label, value });
        }
        const suffix = answers.length ? ` (${answers.map((x) => `${x.label}: ${x.value}`).join(", ")})` : "";
        return {
          name: def.name,
          price,
          label: (def.type === "perday" ? `${def.name} × ${onDays.length}` : def.name) + suffix,
          ...(answers.length ? { answers } : {}),
        };
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
  // Multi-person rules are decided per line now, so the basket no longer has to
  // be uniform for them to apply — two children on the same week earn the
  // sibling discount even if one of them skips another week entirely. Group the
  // priced lines and tell the engine how many children are on each.
  const grouped = new Map<string, { pass: string; base: number; days: number; heads: number }>();
  for (const p of priced) {
    const key = lineKey(p);
    const g = grouped.get(key);
    if (g) g.heads += 1;
    else grouped.set(key, { pass: p.item.pass, base: p.base, days: p.days.length, heads: 1 });
  }
  const { total: discounted } = applyDiscounts(
    listing.discounts ?? [],
    [...grouped.values()].map((g) => ({ name: g.pass, price: g.base, days: g.days, heads: g.heads })),
    attendees,
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

  const bookerName = familyName;
  const tenantRef = db.collection("tenants").doc(listing.tenantId);
  const blockRef = db.collection("blocks").doc(input.blockId);
  // Auto-confirm listings seat parents immediately; manual ones hold the
  // place pending the operator's approval. Operator-taken bookings are the
  // approval — Confirmed straight away, invoiced. Unpaid until paid.
  const placedStatus = onBehalf ? "Confirmed" : listing.bookingType === "auto" ? "Confirmed" : "Approval needed";

  try {
    const bookings = await db.runTransaction(async (tx) => {
      const [tenantSnap, blockSnap] = await Promise.all([tx.get(tenantRef), tx.get(blockRef)]);
      if (!tenantSnap.exists) throw new HttpError(400, "Listing's provider no longer exists");
      if (!blockSnap.exists) throw new HttpError(400, "Unknown block");
      const block = blockSnap.data() as BlockDoc;
      if (block.listingId !== input.listingId || block.tenantId !== listing.tenantId)
        throw new HttpError(400, "Block does not belong to this listing");

      // Split the basket by DATE-GROUP, never by child (§E): items sharing
      // the same days book or queue together (siblings stay together on a
      // date), but a full Tuesday doesn't stop Wednesday from booking.
      const groups = new Map<string, number[]>(); // daysKey → priced indexes
      priced.forEach((p, i) => {
        const key = p.days.join(",");
        groups.set(key, [...(groups.get(key) ?? []), i]);
      });

      // Existing queue depth per date (waitlist positions + the size cap).
      const waitingSnap = await tx.get(
        bookingsCol.where("blockId", "==", blockSnap.id).where("status", "==", "Waitlisted"),
      );
      const queueDepth: Record<string, number> = {};
      for (const d of waitingSnap.docs) {
        const wb = fromDoc(d.data() as BookingDoc);
        for (const day of wb.days ?? block.sessions.map((s) => s.date))
          queueDepth[day] = (queueDepth[day] ?? 0) + 1;
      }
      const queueCap = Math.floor(Number(listing.waitlistSize)) > 0 ? Math.floor(Number(listing.waitlistSize)) : null;

      const scope = block.capacityScope ?? "listing";
      // Working copy — earlier groups' seats count against later groups.
      let working = block;
      const booked = new Set<number>();
      for (const [, idxs] of groups) {
        const wanted: Record<string, number> = {};
        for (const i of idxs) for (const d of priced[i].days) wanted[d] = (wanted[d] ?? 0) + 1;
        const fits =
          working.open &&
          (scope === "day"
            ? daysHaveSpace(working, wanted).fits
            : working.bookedCount + idxs.length <= working.capacity);
        if (fits) {
          for (const i of idxs) booked.add(i);
          // Groups share identical days, so adding the group's seat count to
          // each of those days (and the total) is exact.
          working = { ...working, ...countsUpdate(working, idxs.length, Object.keys(wanted)) };
        } else {
          if (listing.waitlist === false) {
            const fullDay = scope === "day" ? ("fullDay" in daysHaveSpace(working, wanted) ? daysHaveSpace(working, wanted).fullDay : undefined) : undefined;
            throw new HttpError(409, fullDay ? `${prettyDay(fullDay)} is full and the waitlist is off` : "This block is full and the waitlist is off");
          }
          if (queueCap !== null) {
            for (const d of Object.keys(wanted)) {
              if ((queueDepth[d] ?? 0) + wanted[d] > queueCap)
                throw new HttpError(409, `The waiting list for ${prettyDay(d)} is full`);
            }
          }
        }
      }

      const nextBid: number = tenantSnap.data()!.nextBid ?? 10312;
      const queuePos: Record<string, number> = { ...queueDepth };
      const created: Booking[] = priced.map((p, i) => {
        const placed = booked.has(i);
        let note = "";
        if (!placed) {
          note =
            "Waiting list — " +
            p.days
              .map((d) => {
                queuePos[d] = (queuePos[d] ?? 0) + 1;
                return `position ${queuePos[d]} for ${prettyDay(d)}`;
              })
              .join(", ");
        }
        return {
          ...buildBooking(
            {
              booker: bookerName,
              email: familyEmail,
              child: p.item.child,
              age: itemAge(p.item),
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
          status: placed ? placedStatus : "Waitlisted",
          pay: onBehalf && placed ? "Invoice sent" : "Unpaid",
          note,
        };
      });
      tx.update(tenantRef, { nextBid: nextBid + created.length });
      if (booked.size)
        tx.update(blockRef, { bookedCount: working.bookedCount, dayCounts: working.dayCounts ?? {} });
      for (const b of created) tx.set(bookingsCol.doc(bookingDocId(listing.tenantId, b.ref)), toDoc(b));
      return created;
    });

    // One email for the basket, not one per child. On-behalf bookings get
    // the account+pay email instead (no child data in it — a mistyped
    // address must never leak a child's details).
    if (onBehalf) {
      if (bookings[0].email.includes("@"))
        emailFamilyBookingCreated(bookings, listing.tenantName ?? listing.name, {
          accountCreated,
          passwordLink,
        });
    } else {
      emailBookingRequestReceived(bookings[0], listing.tenantName ?? listing.name);
    }
    // Keep Customers & families current (one upsert per child, same family).
    for (const b of bookings) void upsertCustomerFromBooking(listing.tenantId, b);
    // The provider's staff can now read the SEND plans of the children they've
    // just been given. Granted here rather than by the client, so a parent
    // can't widen access to a file by asking; and only for the tenant they
    // actually booked with. Fire-and-forget: a booking is not worth failing
    // over a permission grant that can be retried on the next booking.
    void (async () => {
      const names = new Set(input.items.map((i) => i.child.trim().toLowerCase()));
      const kids = await childrenCol.where("parentUid", "==", req.user!.uid).get();
      const planIds = kids.docs
        .map((d) => d.data() as { name?: string; sendPlanId?: string })
        .filter((c) => c.sendPlanId && names.has((c.name ?? "").trim().toLowerCase()))
        .map((c) => c.sendPlanId!);
      if (planIds.length) await grantPlanAccess(planIds, listing.tenantId);
    })().catch(() => {});
    // "2nd in line for 12 Aug" — per-date queue positions for anything queued.
    const queuedRefs = bookings.filter((b) => b.status === "Waitlisted").map((b) => b.ref);
    const waitlist = queuedRefs.length ? await queuePositions(input.blockId, queuedRefs) : [];
    res
      .status(201)
      .json(legacy.success ? bookings[0] : { bookings, total: target, ...(waitlist.length ? { waitlist } : {}) });
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// ——— Waiting-list offers (§E): a place is held for 2 hours; the family
// accepts (→ Confirmed, then pays) or declines (→ back to the queue's next).

async function ownOfferedBooking(email: string, ref: string) {
  const matches = await bookingsCol
    .where("email", "==", email)
    .where("ref", "==", ref)
    .limit(1)
    .get();
  return matches.empty ? null : matches.docs[0].ref;
}

my.post("/bookings/:ref/accept-offer", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const ref = await ownOfferedBooking(email, req.params.ref);
  if (!ref) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.status !== "Offered") throw new HttpError(409, `No open offer on this booking (${b.status})`);
      if (b.offerExpiresAt && Date.now() > new Date(b.offerExpiresAt).getTime())
        throw new HttpError(409, "This offer has expired — you're back in the queue");
      // The seat was already held by the offer — no capacity movement.
      b.status = "Confirmed";
      b.note = "Offer accepted.";
      tx.set(ref, toDoc(b));
      return b;
    });
    const tenant = await db.collection("tenants").doc(updated.tenantId!).get();
    emailBookingConfirmed(updated, tenant.data()?.name ?? "Your activity provider");
    res.json(updated);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

my.post("/bookings/:ref/decline-offer", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const ref = await ownOfferedBooking(email, req.params.ref);
  if (!ref) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.status !== "Offered") throw new HttpError(409, `No open offer on this booking (${b.status})`);
      let blockUpdate: { ref: FirebaseFirestore.DocumentReference; counts: ReturnType<typeof countsUpdate> } | null = null;
      if (b.blockId) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
        if (blockSnap.exists) {
          const blockData = blockSnap.data() as BlockDoc;
          blockUpdate = { ref: blockSnap.ref, counts: countsUpdate(blockData, -(b.seats ?? 1), bookingDays(b, blockData)) };
        }
      }
      b.status = "Cancelled";
      b.note = "Offer declined.";
      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { ...blockUpdate.counts });
      return b;
    });
    // The freed place passes down the queue (auto mode).
    if (updated.blockId) void triggerWaitlist(updated.blockId);
    res.json(updated);
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
      // Free the block places the booking held — total AND its days
      // (all reads before writes).
      const delta = b.blockId ? blockCountDelta(oldStatus, b.status, bookingSeats(b)) : 0;
      let blockUpdate: {
        ref: FirebaseFirestore.DocumentReference;
        counts: ReturnType<typeof countsUpdate>;
      } | null = null;
      if (delta !== 0) {
        const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId!));
        if (blockSnap.exists) {
          const blockData = blockSnap.data() as BlockDoc;
          blockUpdate = { ref: blockSnap.ref, counts: countsUpdate(blockData, delta, bookingDays(b, blockData)) };
        }
      }
      tx.set(ref, toDoc(b));
      if (blockUpdate) tx.update(blockUpdate.ref, { ...blockUpdate.counts });
      return b;
    });
    // A cancellation frees seats — the queue gets first refusal (auto mode).
    if (updated.blockId) void triggerWaitlist(updated.blockId);
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

import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { checkCode, normaliseCode, reservedEmails, type DiscountCodeDoc } from "../lib/discountCodes";
import { consumeDiscountCodes, releaseDiscountCodes } from "../lib/discountRedemptions";
import { creditWallet, spendWalletInTx, walletRef, walletsForFamily } from "../lib/wallet";
import { notify } from "../lib/notify";
import { rewardReferrer } from "./referral";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { money } from "../../../features/bookings/helpers";
import type { Booking } from "../../../features/bookings/types";
import { applyParentCancel, applyPartialCancel, buildBooking } from "../../../features/bookings/mutations";
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
  countsTowardCapacity,
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
  emailVoucherInstructions,
} from "../lib/emails";
import { auth as fbAuth } from "../firebase";
import { canWrite } from "../middleware/role";
import { queuePositions, triggerWaitlist } from "../lib/waitlist";
import { upsertFamilyFromBasket } from "../lib/customerUpsert";
import { voucherWindow } from "../../../lib/vouchers";
import { DEFAULT_POLICY, policyById, refundFor, type NamedPolicy } from "../../../lib/cancellation";
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
  // The saved child's record id, when booked from a profile. Lets the server
  // stamp a real id on the booking so registers resolve the face/allergies/
  // SEND/collection-password rather than guessing from the name.
  childId: z.string().max(60).optional(),
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
  // Childcare voucher booking (§Q): the scheme id the family picked. The
  // server computes the pay-by dates from the tenant's voucher settings.
  voucherScheme: z.string().max(60).optional(),
  // Marketing discount code (optional). Applied server-side to the pass
  // subtotal; validated the same way the preview endpoint validates it.
  discountCode: z.string().trim().max(40).optional(), // legacy single code
  discountCodes: z.array(z.string().trim().max(40)).max(20).optional(), // stackable codes
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)");

const cancelSchema = z.object({
  msg: z.string().max(500).optional(),
  // A provider-defined cancellation reason (Illness / Weather / …) for
  // reporting, stored alongside the free-text message.
  reason: z.string().max(120).optional(),
  // Where the family wants any refund to land. Recorded on the request; the
  // money only moves when the provider approves it.
  refundPref: z.enum(["card", "wallet"]).optional(),
  // ── Partial (per-day) cancellation ──────────────────────────────────────
  // A strict subset of the booking's remaining days, released rather than the
  // whole booking. Single-child bookings send `days`, multi-child ones send
  // `kids` (each child on their own dates). `resolution` says what happens to
  // the released days' value; "changedate" is a MOVE and goes to /amend.
  resolution: z.enum(["refund", "wallet"]).optional(),
  days: z.array(isoDate).max(120).optional(),
  kids: z
    .array(
      z.object({
        name: z.string().trim().max(80),
        childId: z.string().max(60).optional(),
        days: z.array(isoDate).max(120),
      }),
    )
    .max(20)
    .optional(),
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
  /** Who to ring if the parent can't be reached. Either of them can fill it
   *  in — the provider usually takes it on the call. Split, because a
   *  register prints the name and dials the number. */
  emergencyName: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  // §K safeguarding record — entered once by the parent, surfaced to the
  // provider whose sessions the child attends.
  dietary: z.string().trim().max(300).optional(), // distinct from allergies
  swimming: z.enum(["none", "weak", "confident", "strong"]).optional(),
  careNotes: z.string().trim().max(500).optional(), // care & behaviour
  suncreamConsent: z.boolean().optional(),
  firstAidConsent: z.boolean().optional(),
  walkHomeConsent: z.boolean().optional(),
  // A SEND/EHCP plan, held by routes/childFiles.ts rather than inline: a real
  // EHCP is a multi-page scan and would blow Firestore's 1MB document cap.
  // Only the id and the filename live on the child.
  sendPlanId: z.string().trim().max(60).optional(),
  sendPlanName: z.string().trim().max(200).optional(),
  // What settles them and what doesn't — the things a parent tells you at the
  // door, kept so they don't have to say it twice.
  likes: z.string().trim().max(300).optional(),
  dislikes: z.string().trim().max(300).optional(),
  /** The child's chip colour keys on this. A free string, not an enum: the
   *  provider sets their own list (incl. "Prefer not to say"), so any fixed
   *  set is wrong for someone. */
  sex: z.string().trim().max(40).optional(),
  /** Provider-defined question answers (§N): question id → answer as a
   *  string. Strings survive a provider renaming an option; enums don't. */
  answers: z.record(z.string().max(60), z.string().max(2_000)).optional(),
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

// GET /api/my/providers — the distinct providers the parent has booked with
// (tenant id + name). Powers the newsfeed header and the "message a provider"
// picker, so a parent only ever contacts someone they have a booking with.
my.get("/providers", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const snap = await bookingsCol.where("email", "==", email).get();
  const ids = [...new Set(snap.docs.map((d) => (d.data() as { tenantId?: string }).tenantId).filter(Boolean) as string[])].slice(0, 30);
  if (!ids.length) { res.json([]); return; }
  const tenants = await db.getAll(...ids.map((id) => db.collection("tenants").doc(id)));
  res.json(tenants.filter((t) => t.exists).map((t) => ({ tenantId: t.id, name: (t.data()!.name as string) ?? "Your activity provider" })));
});

// GET /api/my/wallet — the family's store credit, per provider, with the
// ledger behind each balance. Read-only: credit is only ever created by a
// cancellation/credit-note settling to the wallet, and only ever spent by
// checkout, both server-side (it's money — the client isn't trusted for it).
my.get("/wallet", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  res.json({ balances: await walletsForFamily(email) });
});

// GET /api/my/coupons — discount codes a parent can actually use: the PUBLIC
// codes ("anyone can use it") of every provider they've booked with, plus any
// code reserved specifically for their email. Only usable ones (active, not
// expired, not fully used). Powers the custdash "Coupons & discount codes" area
// so a public code an operator creates is discoverable, not just knowable.
my.get("/coupons", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const el = email.toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  // Providers the parent has booked with.
  const bk = await bookingsCol.where("email", "==", email).get();
  const tenantIds = [...new Set(bk.docs.map((d) => (d.data() as { tenantId?: string }).tenantId).filter(Boolean) as string[])].slice(0, 30);

  // Public codes for those providers + any code reserved for this parent.
  const codeDocs = new Map<string, FirebaseFirestore.DocumentData & { id: string }>();
  const codesCol = db.collection("discountCodes");
  for (const tid of tenantIds) {
    const snap = await codesCol.where("tenantId", "==", tid).get();
    snap.docs.forEach((d) => codeDocs.set(d.id, { id: d.id, ...(d.data() as Record<string, unknown>) }));
  }
  const reserved = await codesCol.where("assignedTo", "==", el).get();
  reserved.docs.forEach((d) => codeDocs.set(d.id, { id: d.id, ...(d.data() as Record<string, unknown>) }));
  // Codes reserved for a GROUP this family belongs to (e.g. "NHS parents").
  const inGroup = await codesCol.where("assignedEmails", "array-contains", el).get();
  inGroup.docs.forEach((d) => codeDocs.set(d.id, { id: d.id, ...(d.data() as Record<string, unknown>) }));

  // Codes this family has already redeemed — so a one-per-customer code they've
  // used drops off (doesn't pile up in the banner they can't use again).
  const myRedemptions = await db.collection("discountRedemptions").where("email", "==", el).get();
  const redeemedIds = new Set(myRedemptions.docs.map((d) => d.data().codeId as string));

  const usable = [...codeDocs.values()]
    .map((c) => c as DiscountCodeDoc & { id: string })
    .filter((c) => c.active !== false)
    .filter((c) => !c.expiry || c.expiry >= today)
    .filter((c) => c.usageLimit == null || (c.usedCount ?? 0) < c.usageLimit)
    .filter((c) => !(c.perCustomerLimit && redeemedIds.has(c.id))) // already used their one go
    .filter((c) => { const r = reservedEmails(c); return r.length === 0 || r.includes(el); }) // public OR reserved for me/my group
    .filter((c) => !c.referral); // friend-facing referral codes live on the Refer-a-friend page, not here

  // Resolve provider + listing names in one batch each.
  const tIds = [...new Set(usable.map((c) => c.tenantId))];
  const lIds = [...new Set(usable.map((c) => c.listingId).filter(Boolean) as string[])];
  const [tenants, listings] = await Promise.all([
    tIds.length ? db.getAll(...tIds.map((id) => db.collection("tenants").doc(id))) : Promise.resolve([]),
    lIds.length ? db.getAll(...lIds.map((id) => db.collection("listings").doc(id))) : Promise.resolve([]),
  ]);
  const tName = new Map(tenants.filter((t) => t.exists).map((t) => [t.id, (t.data()!.name as string) ?? "Your provider"]));
  const lName = new Map(listings.filter((l) => l.exists).map((l) => [l.id, (l.data()!.title as string) ?? "a listing"]));

  const out = usable
    .map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      tenantId: c.tenantId,
      minSpend: c.minSpend ?? null,
      expiry: c.expiry ?? null,
      listingId: c.listingId ?? null,
      listingName: c.listingId ? (lName.get(c.listingId) ?? null) : null,
      provider: tName.get(c.tenantId) ?? "Your provider",
      reserved: reservedEmails(c).length > 0,
    }))
    .sort((a, b) => (a.provider === b.provider ? a.code.localeCompare(b.code) : a.provider.localeCompare(b.provider)));
  res.json(out);
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
  let familyUid: string | null = req.user?.uid ?? null;
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
      familyUid = (await fbAuth.getUserByEmail(target.email)).uid;
    } catch {
      const created = await fbAuth.createUser({
        email: target.email,
        displayName: target.name || undefined,
        // No password — they set their own via the emailed link. A password
        // in an inbox lives forever.
      });
      await db.collection("users").doc(created.uid).set({ email: target.email, role: "parent", chosen: true });
      familyUid = created.uid;
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
  // the listing's real session dates, and the library's add-ons. ALL of the
  // listing's blocks are loaded, not just the sent one — a basket line's
  // days may span blocks (a free-choice pass crossing a week boundary), so
  // each day resolves to its own block and the bookings written below stay
  // strictly per-block.
  const blocksSnap = await db.collection("blocks").where("listingId", "==", input.listingId).get();
  const blockPre = blocksSnap.docs.find((d) => d.id === input.blockId);
  if (!blockPre) {
    res.status(400).json({ error: "Unknown block" });
    return;
  }
  const sessionDates = (blockPre.data() as BlockDoc).sessions.map((s) => s.date);
  // date → owning block. The SENT block claims its dates first, so a date
  // two blocks both run stays on the block the client actually chose.
  const blockOfDate = new Map<string, string>();
  for (const d of sessionDates) blockOfDate.set(d, blockPre.id);
  for (const d of blocksSnap.docs)
    for (const s of (d.data() as BlockDoc).sessions)
      if (!blockOfDate.has(s.date)) blockOfDate.set(s.date, d.id);

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
  // Resolve each item's child against the ACCOUNT's saved profiles (the
  // caller for a parent booking, the family for an operator's onBehalfOf),
  // so the booking carries a real childId — not a name we later guess from.
  // childId (when the checkout sends one) is authoritative; name is the
  // fallback for typed-in children.
  const accountUid = familyUid; // parent = caller's uid, onBehalfOf = family's
  const childById = new Map<string, { id: string; name: string; age?: number; dob?: string }>();
  const childByName = new Map<string, { id: string; name: string; age?: number; dob?: string }>();
  if (accountUid) {
    const kids = await childrenCol.where("parentUid", "==", accountUid).get();
    for (const d of kids.docs) {
      const k = d.data() as { name: string; age?: number; dob?: string };
      const rec = { id: d.id, name: k.name, age: k.age, dob: k.dob };
      childById.set(d.id, rec);
      childByName.set((k.name ?? "").trim().toLowerCase(), rec);
    }
  }
  const resolveChild = (i: { child: string; childId?: string; age?: number }) => {
    // A childId must belong to this account — never trust a foreign id.
    const rec = (i.childId && childById.get(i.childId)) || childByName.get(i.child.trim().toLowerCase());
    return {
      childId: rec?.id,
      name: rec?.name ?? i.child,
      age: i.age ?? rec?.age ?? ageFromDob(rec?.dob) ?? 0,
    };
  };

  const needsAddons = input.items.some((i) => i.addons?.length);
  const wantsVoucher = "voucherScheme" in input ? input.voucherScheme : undefined;
  const libAddons = new Map<string, LibAddon>();
  let voucher: { name: string; details: { label: string; value: string }[] } | null = null;
  let voucherWin: ReturnType<typeof voucherWindow> | null = null;
  if (needsAddons || wantsVoucher) {
    const lib = (await db.collection("libraries").doc(listing.tenantId).get()).data() ?? {};
    for (const a of ((lib.addons ?? []) as LibAddon[])) libAddons.set(a.id, a);
    if (wantsVoucher) {
      const settings = (lib.settings ?? {}) as Record<string, unknown>;
      const providers = (settings.voucherProviders ?? []) as { id: string; name: string; details?: { label: string; value: string }[] }[];
      const scheme = providers.find((v) => v.id === wantsVoucher || v.name === wantsVoucher);
      if (scheme) {
        voucher = { name: scheme.name, details: (scheme.details ?? []).filter((d) => d.value?.trim()) };
        // Earliest session across the basket → the window's "first session".
        const first = input.items
          .flatMap((i) => i.dates ?? [])
          .concat(sessionDates)
          .sort()[0];
        voucherWin = voucherWindow(
          new Date().toISOString(),
          first,
          Number(settings.voucherHoldDays ?? 7),
          Number(settings.voucherClearDays ?? 3),
          Number(settings.voucherDueByDays ?? 0),
        );
      }
    }
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
      const missing = days.find((d) => !blockOfDate.has(d));
      if (missing) throw new HttpError(400, `This activity doesn't run on ${missing}`);
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
          // Kept for the per-block split below — a line spanning blocks
          // becomes one booking per block, and its add-ons ride along.
          perDay: def.type === "perday",
          unit: def.price,
          onDays,
          suffix,
          ...(answers.length ? { answers } : {}),
        };
      });
      // The days grouped by owning block. One booking doc per block keeps
      // capacity, registers, waitlists and cancellations — all keyed on a
      // single blockId — exact when a line spans blocks.
      const segMap = new Map<string, string[]>();
      for (const d of days) {
        const bid = blockOfDate.get(d)!;
        segMap.set(bid, [...(segMap.get(bid) ?? []), d]);
      }
      if (!segMap.size) segMap.set(blockPre.id, []); // dateless legacy body → the sent block
      const segments = [...segMap].map(([blockId, ds]) => ({ blockId, days: ds }));
      return { item, base, timing, days, segments, addons, addonsTotal: round2(addons.reduce((s, a) => s + a.price, 0)) };
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

  // Marketing discount code (optional): validate against the pass subtotal
  // (after automatic discounts, before add-ons) and re-spread the reduction
  // across the items' pass portions. Shares lib/discountCodes with the preview
  // endpoint so what the parent saw is exactly what they're charged.
  let discountCodes: string[] = [];
  // A referral code in the basket → reward the referrer AFTER the booking is
  // written (so we can link the booking). Captured here, fired after the tx.
  let referralHit: { referrerEmail: string; code: string; friendDiscount: number } | null = null;
  // Codes are only CONSUMED once the booking actually exists — a basket that
  // fails capacity must not burn a single-use code. Captured here, written
  // after the tx with the refs, so a later cancel can hand the code back.
  let codesToConsume: { codeId: string; code: string }[] = [];
  const rawCodes = [...(input.discountCode ? [input.discountCode] : []), ...(input.discountCodes ?? [])];
  const wantedCodes = [...new Set(rawCodes.map((c) => normaliseCode(c)).filter(Boolean))];
  if (wantedCodes.length) {
    const today = new Date().toISOString().slice(0, 10);
    // Load every requested code.
    const loaded: { doc: FirebaseFirestore.QueryDocumentSnapshot; data: DiscountCodeDoc; code: string }[] = [];
    for (const code of wantedCodes) {
      const snap = await db.collection("discountCodes").where("tenantId", "==", listing.tenantId).where("code", "==", code).limit(1).get();
      if (snap.empty) { res.status(400).json({ error: `Code ${code} isn’t recognised` }); return; }
      loaded.push({ doc: snap.docs[0], data: snap.docs[0].data() as DiscountCodeDoc, code });
    }
    // Codes stack by default — but a code flagged `exclusive` can't be combined.
    const excl = loaded.find((l) => l.data.exclusive);
    if (excl && loaded.length > 1) { res.status(400).json({ error: `Code ${excl.code} can’t be combined with other codes` }); return; }
    // Validate each (per-customer limit, validity, scope) and sum the reductions.
    let totalOff = 0;
    for (const l of loaded) {
      if (l.data.perCustomerLimit && familyEmail) {
        const prior = await db.collection("discountRedemptions").where("codeId", "==", l.doc.id).where("email", "==", familyEmail.toLowerCase()).limit(1).get();
        if (!prior.empty) { res.status(400).json({ error: `You’ve already used code ${l.code}` }); return; }
      }
      // Referral codes: new customers only, and never your own link.
      if (l.data.referral && l.data.referrerEmail && familyEmail && l.data.referrerEmail.toLowerCase() === familyEmail.toLowerCase()) {
        res.status(400).json({ error: "You can’t use your own referral link" }); return;
      }
      if (l.data.newCustomerOnly && familyEmail) {
        const prior = await bookingsCol.where("email", "==", familyEmail).where("tenantId", "==", listing.tenantId).limit(1).get();
        if (!prior.empty) { res.status(400).json({ error: `Code ${l.code} is for new customers only` }); return; }
      }
      const check = checkCode(l.data, discounted, today, { email: familyEmail, listingId: input.listingId, attendees: amounts.length });
      if (!check.ok) { res.status(400).json({ error: check.reason }); return; }
      totalOff = round2(totalOff + check.off);
      if (l.data.referral && l.data.referrerEmail && familyEmail) referralHit = { referrerEmail: l.data.referrerEmail, code: l.code, friendDiscount: check.off };
    }
    totalOff = Math.min(totalOff, discounted); // never below zero on the pass subtotal
    const ratio = discounted > 0 ? (discounted - totalOff) / discounted : 1;
    for (let i = 0; i < amounts.length; i++) {
      const passPortion = round2(amounts[i] - priced[i].addonsTotal);
      amounts[i] = round2(passPortion * ratio + priced[i].addonsTotal);
    }
    const codeTarget = round2(discounted - totalOff + priced.reduce((s, p) => s + p.addonsTotal, 0));
    const codeDrift = round2(codeTarget - amounts.reduce((s, a) => round2(s + a), 0));
    if (amounts.length) amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + codeDrift);
    discountCodes = loaded.map((l) => l.code);
    codesToConsume = loaded.map((l) => ({ codeId: l.doc.id, code: l.code }));
  }

  const bookerName = familyName;
  const tenantRef = db.collection("tenants").doc(listing.tenantId);
  // Every block the basket touches — a line spanning blocks needs each one
  // read, capacity-checked and updated inside the same transaction.
  const blockIds = [...new Set(priced.flatMap((p) => p.segments.map((s) => s.blockId)))];
  // Auto-confirm listings seat parents immediately; manual ones hold the
  // place pending the operator's approval. Operator-taken bookings are the
  // approval — Confirmed straight away, invoiced. Unpaid until paid.
  const placedStatus = onBehalf ? "Confirmed" : listing.bookingType === "auto" ? "Confirmed" : "Approval needed";

  // Store credit the family holds with this provider is spent automatically,
  // after every discount, and only on places actually taken (a waitlisted line
  // hasn't cost them anything yet). Read inside the transaction and written
  // with the bookings, so two baskets can't spend the same pound. An operator
  // booking on a family's behalf leaves their credit alone — it's the family's
  // to spend, and the checkout preview never offered it.
  const useWallet = !onBehalf && Boolean(familyEmail);

  try {
    const bookings = await db.runTransaction(async (tx) => {
      const [tenantSnap, ...blockSnaps] = await Promise.all([
        tx.get(tenantRef),
        ...blockIds.map((id) => tx.get(db.collection("blocks").doc(id))),
      ]);
      const walletSnap = useWallet ? await tx.get(walletRef(listing.tenantId, familyEmail)) : null;
      const walletHeld = walletSnap?.exists ? Number(walletSnap.get("balance") ?? 0) : 0;
      if (!tenantSnap.exists) throw new HttpError(400, "Listing's provider no longer exists");
      const blockById = new Map<string, BlockDoc>();
      for (const snap of blockSnaps) {
        if (!snap.exists) throw new HttpError(400, "Unknown block");
        const block = snap.data() as BlockDoc;
        if (block.listingId !== input.listingId || block.tenantId !== listing.tenantId)
          throw new HttpError(400, "Block does not belong to this listing");
        blockById.set(snap.id, block);
      }

      // Split the basket by DATE-GROUP, never by child (§E): items sharing
      // the same days book or queue together (siblings stay together on a
      // date), but a full Tuesday doesn't stop Wednesday from booking.
      const groups = new Map<string, number[]>(); // daysKey → priced indexes
      priced.forEach((p, i) => {
        const key = p.days.join(",");
        groups.set(key, [...(groups.get(key) ?? []), i]);
      });

      // Existing queue depth per block per date (waitlist positions + cap).
      const queueDepth = new Map<string, Record<string, number>>();
      for (const [id, block] of blockById) {
        const waitingSnap = await tx.get(
          bookingsCol.where("blockId", "==", id).where("status", "==", "Waitlisted"),
        );
        const depth: Record<string, number> = {};
        for (const d of waitingSnap.docs) {
          const wb = fromDoc(d.data() as BookingDoc);
          for (const day of wb.days ?? block.sessions.map((s) => s.date))
            depth[day] = (depth[day] ?? 0) + 1;
        }
        queueDepth.set(id, depth);
      }
      const queueCap = Math.floor(Number(listing.waitlistSize)) > 0 ? Math.floor(Number(listing.waitlistSize)) : null;

      // Working copies — earlier groups' seats count against later groups.
      const working = new Map(blockById);
      const changed = new Set<string>();
      // A group books or queues PER BLOCK: a line spanning two weeks can
      // seat week one and queue for a full week two — exactly what booking
      // the weeks separately always did.
      const bookedSeg = new Set<string>(); // "pricedIndex|blockId"
      for (const [, idxs] of groups) {
        // The group's wanted seats per block per date. Groups share days,
        // so every item in the group touches the same blocks.
        const wantedBy = new Map<string, Record<string, number>>();
        for (const i of idxs)
          for (const s of priced[i].segments) {
            const w = wantedBy.get(s.blockId) ?? {};
            for (const d of s.days) w[d] = (w[d] ?? 0) + 1;
            wantedBy.set(s.blockId, w);
          }
        for (const [blockId, wanted] of wantedBy) {
          const blk = working.get(blockId)!;
          const scope = blk.capacityScope ?? "listing";
          const fits =
            blk.open &&
            (scope === "day"
              ? daysHaveSpace(blk, wanted).fits
              : blk.bookedCount + idxs.length <= blk.capacity);
          if (fits) {
            for (const i of idxs) bookedSeg.add(`${i}|${blockId}`);
            // Groups share identical days, so adding the group's seat count to
            // each of those days (and the total) is exact.
            working.set(blockId, { ...blk, ...countsUpdate(blk, idxs.length, Object.keys(wanted)) });
            changed.add(blockId);
          } else {
            if (listing.waitlist === false) {
              const fullDay = scope === "day" ? ("fullDay" in daysHaveSpace(blk, wanted) ? daysHaveSpace(blk, wanted).fullDay : undefined) : undefined;
              throw new HttpError(409, fullDay ? `${prettyDay(fullDay)} is full and the waitlist is off` : "This block is full and the waitlist is off");
            }
            if (queueCap !== null) {
              const depth = queueDepth.get(blockId) ?? {};
              for (const d of Object.keys(wanted)) {
                if ((depth[d] ?? 0) + wanted[d] > queueCap)
                  throw new HttpError(409, `The waiting list for ${prettyDay(d)} is full`);
              }
            }
          }
        }
      }

      const nextBid: number = tenantSnap.data()!.nextBid ?? 10312;
      // Queue positions count per block per date.
      const queuePos = new Map<string, Record<string, number>>();
      for (const [id, depth] of queueDepth) queuePos.set(id, { ...depth });
      const created: Booking[] = [];
      // Credit is drawn down as the bookings are built, so it lands on the
      // earliest places taken and never on a waitlisted one.
      let walletLeft = walletHeld;
      const walletSpends: { ref: string; amount: number; reason: string }[] = [];
      priced.forEach((p, i) => {
        const rc = resolveChild(p.item);
        // The line's money, spread over its blocks by day count. The LAST
        // segment absorbs the remainder, so the family pays exactly the
        // previewed amount whatever the rounding.
        const passPortion = round2(amounts[i] - p.addonsTotal);
        let paidSoFar = 0;
        p.segments.forEach((seg, si) => {
          const block = blockById.get(seg.blockId)!;
          const placed = bookedSeg.has(`${i}|${seg.blockId}`);
          // This segment's add-ons: per-day ones ride with their days,
          // whole-line ones ride with the segment holding their first day.
          const segAddons = p.addons.flatMap((a) => {
            if (a.perDay) {
              const on = a.onDays.filter((d) => seg.days.includes(d));
              if (!on.length) return [];
              return [{ ...a, price: round2(a.unit * on.length), label: `${a.name} × ${on.length}${a.suffix}` }];
            }
            const home = p.segments.find((s2) => s2.days.includes(a.onDays[0]))?.blockId ?? p.segments[0].blockId;
            return home === seg.blockId ? [a] : [];
          });
          const segAddonsTotal = round2(segAddons.reduce((s, a) => s + a.price, 0));
          const amount =
            si === p.segments.length - 1
              ? round2(amounts[i] - paidSoFar)
              : round2((p.days.length ? passPortion * (seg.days.length / p.days.length) : 0) + segAddonsTotal);
          // The split maths above stays on gross figures; store credit comes
          // off afterwards so the segments still sum to the previewed total.
          paidSoFar = round2(paidSoFar + amount);
          const fromWallet = placed && walletLeft > 0 && amount > 0 ? Math.min(walletLeft, amount) : 0;
          walletLeft = round2(walletLeft - fromWallet);
          const due = round2(amount - fromWallet);
          let note = "";
          if (!placed) {
            const pos = queuePos.get(seg.blockId)!;
            note =
              "Waiting list — " +
              seg.days
                .map((d) => {
                  pos[d] = (pos[d] ?? 0) + 1;
                  return `position ${pos[d]} for ${prettyDay(d)}`;
                })
                .join(", ");
          }
          created.push({
            ...buildBooking(
              {
                booker: bookerName,
                email: familyEmail,
                child: rc.name,
                age: rc.age,
                listing: listing.name,
                pass: p.timing ? `${p.item.pass} · ${p.timing}` : p.item.pass,
                dates: block.name,
                amount: due,
                method: input.method,
              },
              nextBid + created.length,
            ),
            ...(rc.childId ? { childId: rc.childId } : {}),
            ...(fromWallet ? { walletApplied: fromWallet } : {}),
            ...(discountCodes.length ? { discountCode: discountCodes.join(", "), discountCodes } : {}),
            tenantId: listing.tenantId,
            blockId: seg.blockId,
            seats: 1,
            days: seg.days,
            ...(p.timing ? { timing: p.timing } : {}),
            addons: segAddons.map((a) => `${a.label} — £${a.price.toFixed(2)}`),
            sessions: block.sessions.filter((s) => seg.days.includes(s.date)).map(sessionLabel),
            status: placed ? placedStatus : "Waitlisted",
            // Judged on what's left to pay, not the method: a HAF/free £0 place
            // — or one fully covered by store credit — is Funded, never Unpaid.
            // A voucher booking waits on the scheme's money, not the parent — a
            // distinct state so the two chase lists don't mix.
            pay:
              due <= 0
                ? "Funded"
                : placed && voucher
                  ? "Awaiting voucher payment"
                  : placed && onBehalf
                    ? "Invoice sent"
                    : "Unpaid",
            ...(placed && voucher && due > 0
              ? {
                  voucherScheme: voucher.name,
                  ...(voucherWin?.sendBy ? { voucherSendBy: voucherWin.sendBy } : {}),
                  ...(voucherWin?.receiveBy ? { voucherReceiveBy: voucherWin.receiveBy } : {}),
                }
              : {}),
            note,
          });
          if (fromWallet)
            walletSpends.push({
              ref: created[created.length - 1].ref,
              amount: fromWallet,
              reason: `Spent on ${listing.name}`,
            });
        });
      });
      if (walletSpends.length) spendWalletInTx(tx, listing.tenantId, familyEmail, walletHeld, walletSpends);
      tx.update(tenantRef, { nextBid: nextBid + created.length });
      for (const id of changed) {
        const blk = working.get(id)!;
        tx.update(db.collection("blocks").doc(id), { bookedCount: blk.bookedCount, dayCounts: blk.dayCounts ?? {} });
      }
      for (const b of created) tx.set(bookingsCol.doc(bookingDocId(listing.tenantId, b.ref)), toDoc(b));
      return created;
    });

    // The booking exists, so the codes are genuinely spent.
    void consumeDiscountCodes(
      listing.tenantId,
      codesToConsume,
      bookings.map((b) => b.ref),
      familyEmail,
    );

    // Refer-a-friend: now the friend's booking exists, reward the referrer —
    // capped to what the friend paid — and link the booking for the dashboard.
    if (referralHit && familyEmail) {
      const placedBooking = bookings.find((b) => b.status !== "Waitlisted") ?? bookings[0];
      void rewardReferrer(listing.tenantId, referralHit.referrerEmail, familyEmail, referralHit.code, target, {
        friendDiscount: referralHit.friendDiscount,
        bookingRef: placedBooking?.ref,
      });
    }

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
    // Tell the PROVIDER a booking just came in — bell + email. This was never
    // wired: the create path only ever emailed the parent, so operators got no
    // heads-up on new bookings. Fires once per basket, not per child.
    if (listing.tenantId && bookings.length) {
      const total = bookings.reduce((s, b) => s + (b.amount ?? 0), 0);
      const kids = [...new Set(bookings.map((b) => b.child).filter(Boolean))].join(", ");
      const needsApproval = bookings.some((b) => b.status === "Approval needed");
      const waitlisted = bookings.every((b) => b.status === "Waitlisted");
      const primary = bookings.find((b) => b.status !== "Waitlisted") ?? bookings[0];
      void notify({
        tenantId: listing.tenantId,
        to: { kind: "tenant" },
        category: "booking",
        title: waitlisted
          ? `${bookerName} joined the waitlist · ${listing.name}`
          : needsApproval
            ? `${bookerName} requested to book · ${listing.name}`
            : `New booking · ${bookerName} · ${listing.name}`,
        body: `${kids || bookerName} · ${bookings.length} place${bookings.length === 1 ? "" : "s"} · ${money(total)}.${needsApproval ? " Review to approve or decline." : ""}`,
        subject: `${listing.name}: ${waitlisted ? "waitlist join" : needsApproval ? "booking request" : "new booking"} from ${bookerName}`,
        href: `/company/bookings?ref=${encodeURIComponent(primary.ref)}`,
        ref: primary.ref,
      });
    }
    // Keep Customers & families current (one upsert per child, same family).
    void upsertFamilyFromBasket(listing.tenantId, {
      booker: bookerName,
      email: familyEmail,
      phone: onBehalf?.phone,
      uid: familyUid,
      children: bookings.map((b) => ({ name: b.child, childId: b.childId, age: b.age })),
    });
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
    // Voucher instructions — the scheme, its references and the deadline, so
    // the family can go and pay. Re-sendable via the "resend" action.
    if (voucher) {
      const v = bookings.find((b) => b.pay === "Awaiting voucher payment");
      if (v && v.email.includes("@"))
        emailVoucherInstructions(v, listing.tenantName ?? listing.name, voucher);
    }
    // "2nd in line for 12 Aug" — per-date queue positions for anything queued,
    // asked block by block (a basket can now touch several).
    const queuedByBlock = new Map<string, string[]>();
    for (const b of bookings)
      if (b.status === "Waitlisted" && b.blockId)
        queuedByBlock.set(b.blockId, [...(queuedByBlock.get(b.blockId) ?? []), b.ref]);
    const waitlist = (
      await Promise.all([...queuedByBlock].map(([id, refs]) => queuePositions(id, refs)))
    ).flat();
    res
      .status(201)
      .json(legacy.success ? bookings[0] : { bookings, total: target, ...(waitlist.length ? { waitlist } : {}) });
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// POST /api/my/bookings/:ref/amend — a family requests a date change. We record
// it as a pending `dateChangeRequest` on the booking (booking stays Confirmed)
// so the operator sees it and can approve (applies the swap) or deny. Accepts
// two shapes of `moves`: an array of {from,to,child…} (release-a-day flow) or a
// map of oldISO→newISO (the amend modal); plus an optional preferredDate for an
// undated booking. Actual date-swapping happens on the operator's approve.
const amendSchema = z.object({
  moves: z.union([
    z.array(z.object({ childName: z.string().max(80).optional(), childId: z.string().max(60).optional(), from: z.string().max(10), to: z.string().max(10) })),
    z.record(z.string().max(10)),
  ]).optional(),
  preferredDate: z.string().max(10).optional(),
  // A timing change — the pass's period title (e.g. "Full Day"); the UI only
  // offers the block bundle's listed periods, never a free time.
  timing: z.string().max(80).optional(),
  // Scope a date/time change to one child ("" / absent = the whole booking).
  child: z.string().max(80).optional(),
  message: z.string().max(500).optional(),
  msg: z.string().max(500).optional(),
});
my.post("/bookings/:ref/amend", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const parsed = amendSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const matches = await bookingsCol.where("email", "==", email).where("ref", "==", req.params.ref).limit(1).get();
  if (matches.empty) { res.status(404).json({ error: "Booking not found" }); return; }
  const snap = matches.docs[0];
  const booking = fromDoc(snap.data() as BookingDoc);

  const m = parsed.data.moves;
  const moves: { childName?: string; childId?: string; from: string; to: string }[] =
    Array.isArray(m) ? m
      : m && typeof m === "object" ? Object.entries(m).map(([from, to]) => ({ from, to, childName: booking.child }))
        : [];
  if (parsed.data.preferredDate) moves.push({ from: "", to: parsed.data.preferredDate, childName: booking.child });
  if (moves.length === 0 && !parsed.data.timing) { res.status(400).json({ error: "No date or time change was specified" }); return; }

  // Validate before recording, so the operator is never shown a move they
  // couldn't approve. A `from` of "" is the undated "preferred date" shape —
  // there's nothing to move off, so only the target is checked.
  if (booking.status === "Cancelled") { res.status(400).json({ error: "This booking is cancelled" }); return; }
  const { block, settings } = await bookingContext(booking);
  if (!enabled(settings, "allowDateChanges")) {
    res.status(400).json({ error: "This provider doesn't offer date changes" });
    return;
  }
  const onBooking = new Set(booking.days ?? []);
  for (const k of booking.kids ?? []) for (const d of k.dates ?? []) onBooking.add(d);
  // Some bookings carry no ISO days/kids dates — only session display strings
  // ("Mon 27 Jul 2026 · 09:00 – 15:30"). Recover the ISO dates from those so a
  // move's "from" is recognised as being on the booking (mirrors the client).
  if (!onBooking.size) {
    for (const s of booking.sessions ?? []) {
      const mm = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
      if (!mm) continue;
      const d = new Date(`${mm[1]} ${mm[2]} ${mm[3]}`);
      if (!Number.isNaN(d.getTime())) onBooking.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  for (const mv of moves) {
    if (mv.from && !onBooking.has(mv.from)) {
      res.status(400).json({ error: `${prettyDay(mv.from)} isn't on this booking` });
      return;
    }
    if (mv.from === mv.to) { res.status(400).json({ error: "That's the same date" }); return; }
    // The target must be a session this block actually runs, with room left.
    // Re-checked on approval too — availability moves while a request waits.
    if (block) {
      const session = block.sessions.find((s) => s.date === mv.to);
      if (!session) { res.status(400).json({ error: `This activity doesn't run on ${prettyDay(mv.to)}` }); return; }
      if ((block.capacityScope ?? "listing") === "day" && !daysHaveSpace(block, { [mv.to]: 1 }).fits) {
        res.status(400).json({ error: `${prettyDay(mv.to)} is full` });
        return;
      }
    }
  }

  await snap.ref.set({
    dateChangeRequest: {
      moves,
      ...(parsed.data.timing ? { timing: parsed.data.timing } : {}),
      ...(parsed.data.child ? { child: parsed.data.child } : {}),
      status: "pending",
      requestedAt: new Date().toISOString(),
      ...(parsed.data.message || parsed.data.msg ? { note: (parsed.data.message || parsed.data.msg)!.trim() } : {}),
    },
  }, { merge: true });

  // Tell the provider a change is waiting for them — bell + email.
  if (booking.tenantId) {
    const parts: string[] = [];
    if (moves.length) parts.push(`${moves.length} date${moves.length === 1 ? "" : "s"}`);
    if (parsed.data.timing) parts.push("timing");
    const what = parts.join(" + ") || "date/time";
    const scope = parsed.data.child ? ` for ${parsed.data.child}` : "";
    void notify({
      tenantId: booking.tenantId,
      to: { kind: "tenant" },
      category: "booking",
      title: `${booking.booker} requested a ${what} change on ${booking.ref}`,
      body: `${booking.listing} · ${booking.child}${scope}${parsed.data.timing ? ` → ${parsed.data.timing}` : ""}. Review it to approve or decline.`,
      subject: `${booking.ref}: ${what} change requested by ${booking.booker}`,
      // Deep-link straight to this booking so it opens with the request showing.
      href: `/company/bookings?ref=${encodeURIComponent(booking.ref)}`,
      ref: booking.ref,
    });
  }

  const after = await snap.ref.get();
  res.status(201).json(fromDoc(after.data() as BookingDoc));
});

// POST /api/my/bookings/:ref/amend/withdraw — the family withdraws their own
// pending date-change request (before the provider has actioned it).
my.post("/bookings/:ref/amend/withdraw", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const matches = await bookingsCol.where("email", "==", email).where("ref", "==", req.params.ref).limit(1).get();
  if (matches.empty) { res.status(404).json({ error: "Booking not found" }); return; }
  await matches.docs[0].ref.set({ dateChangeRequest: null }, { merge: true });
  const after = await matches.docs[0].ref.get();
  res.json(fromDoc(after.data() as BookingDoc));
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

/** Everything the cancel and amend flows need to judge a family's request: the
 *  block it sits on (real session dates + capacity), the listing's cancellation
 *  policy, and the provider's Setup toggles. One read path, so the two flows
 *  can never disagree about what a provider allows. */
async function bookingContext(b: Booking): Promise<{
  tenantId: string | undefined;
  block: BlockDoc | null;
  settings: Record<string, unknown>;
  policy: NamedPolicy | typeof DEFAULT_POLICY;
}> {
  let tenantId: string | undefined = b.tenantId;
  let block: BlockDoc | null = null;
  let policyId: string | undefined;
  if (b.blockId) {
    const blk = await db.collection("blocks").doc(b.blockId).get();
    if (blk.exists) {
      block = blk.data() as BlockDoc;
      const lst = await db.collection("listings").doc(block.listingId).get();
      if (lst.exists) {
        policyId = lst.data()?.cancellationPolicyId as string | undefined;
        tenantId = (lst.data()?.tenantId as string | undefined) ?? tenantId;
      }
    }
  }
  const settings = tenantId
    ? ((await db.collection("libraries").doc(tenantId).get()).data()?.settings as Record<string, unknown>) ?? {}
    : {};
  const policies = (settings.cancellationPolicies ?? []) as NamedPolicy[];
  return { tenantId, block, settings, policy: policyById(policies, policyId) ?? DEFAULT_POLICY };
}

/** Setup toggles default to ON unless the provider turned them off — the same
 *  reading the parent UI applies, so what it offers is what we accept. */
const enabled = (settings: Record<string, unknown>, key: string, dflt = true) =>
  settings[key] === undefined ? dflt : settings[key] !== false;

/** A single-child booking has no `kids[]`, and the array `bookingKids` makes up
 *  on the fly dates itself from the SESSION LABELS ("Mon 27 Jul 2026"). Partial
 *  cancellation works in ISO throughout, so materialise the child properly —
 *  from `days` — before touching anything. */
function materialiseKids(b: Booking): NonNullable<Booking["kids"]> {
  if (b.kids?.length) return b.kids;
  b.kids = [
    {
      name: b.child,
      ...(b.childId ? { childId: b.childId } : {}),
      ...(b.age != null ? { age: b.age } : {}),
      dates: [...(b.days ?? [])].sort(),
    },
  ];
  return b.kids;
}

/** Release individual days of a multi-day pass. The booking stays Confirmed for
 *  whatever remains; the released days' pro-rata value is either refunded (cash,
 *  per the cancellation policy, pending the provider's approval) or credited to
 *  the family's wallet (full value, no policy cut, instantly). */
async function partialCancel(
  ref: FirebaseFirestore.DocumentReference,
  existing: Booking,
  email: string,
  input: z.infer<typeof cancelSchema>,
): Promise<Booking> {
  if (existing.status === "Cancelled") throw new HttpError(400, "This booking is already cancelled");

  const { tenantId, settings, policy } = await bookingContext(existing);
  if (!enabled(settings, "allowPartialCancel"))
    throw new HttpError(400, "This provider doesn't offer cancelling individual days");

  const resolution = input.resolution ?? "refund";
  const allowed = { refund: enabled(settings, "partialAllowRefund"), wallet: enabled(settings, "partialAllowWallet") };
  if (!allowed[resolution])
    throw new HttpError(400, `This provider doesn't offer ${resolution === "wallet" ? "wallet credit" : "a refund"} for released days`);

  // Which child gives up which days. The parent groups by childId when it has
  // one and by name otherwise — match the same way round.
  const kids = materialiseKids(existing);
  const wanted: { childKey: string; days: string[] }[] = input.kids?.length
    ? input.kids.map((k) => ({ childKey: k.childId ?? k.name, days: k.days }))
    : [{ childKey: kids[0].childId ?? kids[0].name, days: input.days ?? [] }];

  // Validate every released day BEFORE anything moves: on that child, still
  // standing, and not already gone or in the past.
  const today = new Date().toISOString().slice(0, 10);
  let releasedCount = 0;
  for (const w of wanted) {
    const kid = kids.find((k) => (k.childId ?? k.name) === w.childKey);
    if (!kid) throw new HttpError(400, `${w.childKey} isn't on this booking`);
    if (kid.cancelled) throw new HttpError(400, `${kid.name}'s place is already cancelled`);
    const booked = new Set(kid.dates ?? []);
    const gone = new Set(kid.cancelledDays ?? []);
    for (const d of w.days) {
      if (!booked.has(d)) throw new HttpError(400, `${kid.name} isn't booked on ${prettyDay(d)}`);
      if (gone.has(d)) throw new HttpError(400, `${kid.name}'s place on ${prettyDay(d)} is already cancelled`);
      if (d < today) throw new HttpError(400, `${prettyDay(d)} has already passed`);
      releasedCount += 1;
    }
  }
  if (!releasedCount) throw new HttpError(400, "No days were selected");

  // Releasing everything that's left is just a cancellation — say so rather
  // than leaving a booking with no days on it.
  const activeTotal = kids.reduce((n, k) => n + (k.cancelled ? 0 : (k.dates ?? []).filter((d) => !(k.cancelledDays ?? []).includes(d)).length), 0);
  if (releasedCount >= activeTotal)
    throw new HttpError(400, "That's every day left — cancel the whole booking instead");

  // Pro-rata over every child-day BOOKED (the same denominator the parent's
  // preview uses), against money actually received.
  const bookedChildDays = kids.reduce((n, k) => n + (k.dates ?? []).length, 0) || 1;
  const paid = existing.amountPaid ?? (existing.pay === "Paid" ? existing.amount : 0);
  const perSlotPaid = round2(paid / bookedChildDays);

  // Refund runs each released day through the policy on ITS OWN date, so a day
  // three weeks out can refund while tomorrow's can't. Wallet takes the full
  // pro-rata value — that's the trade for keeping it in the business.
  const now = new Date().toISOString();
  const releasedDays = wanted.flatMap((w) => w.days);
  const value =
    resolution === "wallet"
      ? round2(releasedCount * perSlotPaid)
      : round2(releasedDays.reduce((sum, d) => sum + (refundFor(policy, d, perSlotPaid, now, "parent")?.amount ?? 0), 0));

  const updated = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Booking not found");
    const b = fromDoc(snap.data() as BookingDoc);
    if (b.email !== email) throw new HttpError(403, "Not your booking");
    if (b.status === "Cancelled") throw new HttpError(400, "This booking is already cancelled");
    materialiseKids(b);
    const before = new Set(b.days ?? []);
    applyPartialCancel(b, wanted);
    // Only days NO child is left on free a place, and only that day's count —
    // the seat itself stays until the whole booking goes.
    const freedDays = [...before].filter((d) => !(b.days ?? []).includes(d));
    let blockUpdate: { ref: FirebaseFirestore.DocumentReference; dayCounts: Record<string, number> } | null = null;
    if (b.blockId && freedDays.length && countsTowardCapacity(b.status)) {
      const blockSnap = await tx.get(db.collection("blocks").doc(b.blockId));
      if (blockSnap.exists) {
        const blk = blockSnap.data() as BlockDoc;
        blockUpdate = { ref: blockSnap.ref, dayCounts: countsUpdate(blk, -(b.seats ?? 1), freedDays).dayCounts };
      }
    }

    const label = releasedCount === 1 ? "1 day" : `${releasedCount} days`;
    if (resolution === "wallet") {
      // Instant and final — nothing for the provider to approve.
      (b.refundLog = b.refundLog ?? []).push({
        label: `${label} released — wallet credit`,
        amount: value,
        on: new Date().toISOString().slice(0, 10),
        by: "Booker",
        source: "Wallet",
      });
      if (value > 0) b.pay = "Partially refunded";
      b.note = `${label} released to wallet credit.`;
    } else {
      // A request: the money only moves when the provider approves it, exactly
      // like a whole-booking cancel.
      b.cancel = {
        on: new Date().toISOString().slice(0, 10),
        by: "Booker",
        refund: value > 0 ? "pending" : "none",
        amount: value,
        refundOnly: true, // days released, the booking itself stands
        msg: input.msg || `${label} released by the parent.`,
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.refundPref ? { refundTo: input.refundPref } : {}),
      };
      b.note = `${label} released — ${value > 0 ? `${money(value)} refund requested` : "no refund due"}.`;
    }

    tx.set(ref, toDoc(b));
    if (blockUpdate) tx.update(blockUpdate.ref, { dayCounts: blockUpdate.dayCounts });
    return b;
  });

  // Wallet credit is instant, so it lands after the release has committed.
  if (resolution === "wallet" && value > 0 && tenantId)
    await creditWallet(tenantId, email, value, `Days released from ${existing.listing}`, existing.ref);

  // The provider needs to know places came back and what it cost them —
  // a refund resolution is also sitting there waiting for their approval.
  if (tenantId) {
    const who = releasedDays.length === 1 ? "1 day" : `${releasedDays.length} days`;
    void notify({
      tenantId,
      to: { kind: "tenant" },
      category: "booking",
      title: `${existing.booker} released ${who} on ${existing.ref}`,
      body:
        resolution === "wallet"
          ? `${money(value)} credited to their wallet. Places are back on ${releasedDays.map(prettyDay).join(", ")}.`
          : `${money(value)} refund requested — needs your approval. Places are back on ${releasedDays.map(prettyDay).join(", ")}.`,
      subject: `${existing.ref}: ${who} released by ${existing.booker}`,
      href: `/company/bookings?ref=${encodeURIComponent(existing.ref)}`,
      ref: existing.ref,
    });
  }
  // Freed days go to whoever is queued for them.
  if (updated.blockId) void triggerWaitlist(updated.blockId);
  return updated;
}

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
  const existing = fromDoc(matches.docs[0].data() as BookingDoc);

  // ── Partial (per-day) cancellation ──────────────────────────────────────
  // Released days are valued pro-rata over every child-day the family BOOKED,
  // against what they actually PAID — never against `amount`, or an unpaid
  // booking would hand back money that never arrived.
  // Presence, not length, picks this path: an empty selection is a bad partial
  // request, and must never fall through to cancelling the whole booking.
  if (parsed.data.days !== undefined || parsed.data.kids !== undefined) {
    try {
      const out = await partialCancel(ref, existing, email, parsed.data);
      res.json(out);
    } catch (e) {
      if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
      else throw e;
    }
    return;
  }

  // §O — the refund is worked out by the SERVER from the listing's policy, not
  // in the browser (it's money; the client isn't trusted for it). Same pure
  // rules the operator's cancel panel shows. Reference reads, done up front.
  const paid = existing.pay === "Paid" ? existing.amount : 0;
  const firstSession = (existing.days ?? []).slice().sort()[0];
  let policyAmount: number | null = null;
  let policyReason: string | undefined;
  try {
    let policyId: string | undefined;
    let tenantId: string | undefined = existing.tenantId;
    if (existing.blockId) {
      const blk = await db.collection("blocks").doc(existing.blockId).get();
      const lid = blk.data()?.listingId as string | undefined;
      if (lid) {
        const lst = await db.collection("listings").doc(lid).get();
        policyId = lst.data()?.cancellationPolicyId as string | undefined;
        tenantId = (lst.data()?.tenantId as string | undefined) ?? tenantId;
      }
    }
    const settings = tenantId
      ? ((await db.collection("libraries").doc(tenantId).get()).data()?.settings as Record<string, unknown> | undefined)
      : undefined;
    const policies = (settings?.cancellationPolicies ?? []) as NamedPolicy[];
    const policy = policyById(policies, policyId) ?? DEFAULT_POLICY;
    const advice = refundFor(policy, firstSession, paid, new Date().toISOString(), "parent");
    if (advice) {
      policyAmount = advice.amount;
      policyReason = advice.reason;
    }
  } catch (e) {
    console.error("[cancel] policy refund calc failed:", (e as Error).message);
  }

  try {
    const updated = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "Booking not found");
      const b = fromDoc(snap.data() as BookingDoc);
      if (b.email !== email) throw new HttpError(403, "Not your booking");
      if (b.status === "Cancelled") throw new HttpError(400, "Already cancelled");
      const oldStatus = b.status;
      applyParentCancel(b, parsed.data.msg, parsed.data.reason);
      // The policy's recommended refund rides on the request (pending the
      // provider's approval; refund-approve refunds this figure via Stripe).
      if (policyAmount !== null && b.cancel) {
        b.cancel.amount = policyAmount;
        b.cancel.refund = policyAmount >= (paid || 0) && paid > 0 ? "full" : policyAmount > 0 ? "partial" : "none";
        if (policyReason) b.cancel.msg = `${b.cancel.msg} (${policyReason})`;
      }
      if (parsed.data.refundPref && b.cancel) b.cancel.refundTo = parsed.data.refundPref;
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
    // …and frees the discount code it was booked with.
    if (updated.tenantId) void releaseDiscountCodes(updated.tenantId, updated.ref);
    res.json(updated);
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

// ——— Children (the parent's own child profiles — account-level, not
// tenant-scoped: a family exists across providers). Owned strictly by the
// signed-in account via parentUid.

// ——— Trips: the family's view of off-site trips + the consent action. A
// trip stores `childIds` (resolved server-side in routes/trips.ts), so the
// family sees exactly the trips their children are on — nothing else.

const tripsCol = db.collection("trips");

my.get("/trips", async (req, res) => {
  const kids = await childrenCol.where("parentUid", "==", req.user!.uid).get();
  const mine = new Map(kids.docs.map((d) => [d.id, (d.data() as { name?: string }).name ?? ""]));
  if (!mine.size) { res.json([]); return; }
  // array-contains-any caps at 10 values — families are far smaller, but
  // chunk anyway so an edge case degrades to an extra query, not an error.
  const ids = [...mine.keys()];
  const snaps = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 10) }, (_, i) =>
      tripsCol.where("childIds", "array-contains-any", ids.slice(i * 10, i * 10 + 10)).get(),
    ),
  );
  const seen = new Set<string>();
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rows: Record<string, unknown>[] = [];
  const tenantIds = new Set<string>();
  for (const snap of snaps) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const t = d.data() as {
        tenantId?: string; destination?: string; date?: string; departTime?: string; returnTime?: string;
        transport?: string; cost?: string; payBy?: string; status?: string; askConsent?: boolean;
        attendees?: { n: string; childId?: string; consent?: string; consentAt?: string }[];
      };
      if (t.status === "cancelled" || (t.date ?? "") < cutoff) continue;
      if (t.tenantId) tenantIds.add(t.tenantId);
      rows.push({
        id: d.id, tenantId: t.tenantId, destination: t.destination, date: t.date,
        departTime: t.departTime ?? null, returnTime: t.returnTime ?? null,
        transport: t.transport ?? null, cost: t.cost ?? null, payBy: t.payBy ?? null,
        status: t.status ?? "planned", askConsent: t.askConsent !== false,
        children: (t.attendees ?? [])
          .filter((a) => a.childId && mine.has(a.childId))
          .map((a) => ({ childId: a.childId, name: mine.get(a.childId!) || a.n, consent: a.consent ?? "pending", consentAt: a.consentAt ?? null })),
      });
    }
  }
  const tenants = tenantIds.size ? await db.getAll(...[...tenantIds].map((id) => db.collection("tenants").doc(id))) : [];
  const providerName = new Map(tenants.filter((t) => t.exists).map((t) => [t.id, (t.data()!.name as string) ?? "Your provider"]));
  rows.forEach((r) => { r.provider = providerName.get(String(r.tenantId)) ?? "Your provider"; delete r.tenantId; });
  rows.sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
  res.json(rows);
});

const tripConsentSchema = z.object({
  childId: z.string().max(60),
  decision: z.enum(["granted", "declined"]),
});

// POST /my/trips/:id/consent — the timestamped give/decline (the trips
// handoff's #4, the accidents-acknowledge of trips). Transactional: two
// parents answering at once must both land.
my.post("/trips/:id/consent", async (req, res) => {
  const parsed = tripConsentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const child = await childrenCol.doc(parsed.data.childId).get();
  if (!child.exists || child.data()!.parentUid !== req.user!.uid) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  const by = req.user?.email ?? "parent";
  const ref = tripsCol.doc(req.params.id);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const t = snap.data()!;
    const attendees = (t.attendees as { childId?: string; consent?: string; consentAt?: string; consentBy?: string; n: string }[] | undefined) ?? [];
    const mine = attendees.find((a) => a.childId === parsed.data.childId);
    if (!mine) return null;
    mine.consent = parsed.data.decision;
    mine.consentAt = new Date().toISOString();
    mine.consentBy = by;
    const allAnswered = attendees.every((a) => (a.consent ?? "pending") !== "pending");
    const allGranted = attendees.every((a) => a.consent === "granted");
    tx.set(ref, { attendees, consentObtained: allGranted, updatedAt: mine.consentAt }, { merge: true });
    return { tenantId: String(t.tenantId), destination: String(t.destination ?? "the trip"), childName: mine.n, allAnswered };
  });
  if (!result) { res.status(404).json({ error: "That child isn't on this trip" }); return; }

  // Tell the team — and shout when the last answer lands.
  void notify({
    tenantId: result.tenantId,
    to: { kind: "tenant" },
    category: "trip",
    title: `${result.childName}: consent ${parsed.data.decision === "granted" ? "given ✓" : "DECLINED"} — ${result.destination}`,
    body: result.allAnswered ? "Every family has now responded." : "Waiting on the rest of the families.",
    href: "/company/trips",
    ref: req.params.id,
  }).catch(() => {});
  res.json({ ok: true, decision: parsed.data.decision });
});

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

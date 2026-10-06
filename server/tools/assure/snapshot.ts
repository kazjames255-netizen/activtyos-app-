// takeSnapshot(tenantId): a READ-ONLY picture of one tenant's listings/bookings/blocks/payments/wallet/emails, in the shape the invariants read.
// Safety: it refuses any tenant whose owner login does not end @activityos-test.com, so it can never be pointed at a real provider by mistake.
import { db, auth } from "../../src/firebase";
import { receivedOf, refundedGross } from "../../../features/bookings/helpers";
import { ageCapGroup } from "../../src/lib/childAge";
import { passCap } from "../../src/lib/passBooking";
import type { Snapshot, SnapBooking, SnapBlock, SnapPayment, SnapListing, SnapEmail } from "./types";

const TEST = /@activityos-test\.com$/i;
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Throws unless the tenant belongs to a throwaway test account. */
export async function assertTestTenant(tenantId: string): Promise<void> {
  const t = await db.collection("tenants").doc(tenantId).get();
  if (!t.exists) throw new Error(`assure: tenant ${tenantId} does not exist`);
  const uid = t.get("ownerUid") as string | undefined;
  if (!uid) throw new Error(`assure: tenant ${tenantId} has no owner, refusing`);
  let email = "";
  try { email = (await auth.getUser(uid)).email ?? ""; } catch { /* fall through to refusal */ }
  if (!TEST.test(email)) throw new Error(`assure: REFUSED tenant ${tenantId}: owner "${email || "unknown"}" is not an @activityos-test.com account`);
}

/** Classify an outgoing email from its subject (mailLog has no kind). */
export function emailKind(subject: string): string {
  const s = subject.toLowerCase();
  if (s.startsWith("booking confirmed")) return "booking-confirmed";
  if (s.startsWith("payment received")) return "payment-received";
  if (s.startsWith("a place has opened up")) return "offer";
  if (s.startsWith("you're on the waiting list")) return "waitlist-joined";
  if (s.startsWith("booking request received")) return "request-received";
  if (s.startsWith("refund update")) return "refund";
  if (s.startsWith("complete your booking")) return "complete-booking";
  if (s.startsWith("booking update")) return "booking-update";
  return "other";
}
/** The listing title an email is about: everything after the first " — ". */
export const emailListing = (subject: string): string => (subject.includes(" — ") ? subject.slice(subject.indexOf(" — ") + 3).trim() : "");

export async function takeSnapshot(tenantId: string): Promise<Snapshot> {
  await assertTestTenant(tenantId);
  const [bs, blks, pays, lsts, lib] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("blocks").where("tenantId", "==", tenantId).get(),
    db.collection("payments").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
  ]);
  const settings = ((lib.data()?.settings ?? {}) as Record<string, unknown>);
  const groups = ((settings.ratioGroups ?? []) as { id: string; ageFrom: number; ageTo: number }[]);

  const listings: SnapListing[] = lsts.docs.map((d) => {
    const x = d.data() as Record<string, any>;
    const ticketCaps: Record<string, number> = {};
    for (const [name, o] of Object.entries((x.ticketOverrides ?? {}) as Record<string, { capacity?: string }>)) {
      const c = passCap(o?.capacity);
      if (c !== null) ticketCaps[name] = c;
    }
    return {
      id: d.id, status: str(x.status) ?? "live", name: str(x.title) ?? str(x.name), ticketCaps,
      ageCaps: x.ageCapsOn ? ((x.ageCaps ?? {}) as Record<string, number>) : undefined,
      maxAttendees: Number(x.maxAttendees) || undefined, capacityScope: str(x.capacityScope),
      waitlistMode: str(x.waitlistMode), waitlist: x.waitlist === true, createdAt: str(x.createdAt),
      deliveryMode: str(x.deliveryMode), coverageMode: str(x.coverageArea?.mode), coveragePrefixes: Array.isArray(x.coverageArea?.postcodePrefixes) ? x.coverageArea.postcodePrefixes.map(String) : undefined,
      discounts: Array.isArray(x.discounts) ? x.discounts.map((r: any) => ({ kind: r.kind, method: r.method, enabled: r.enabled })) : [],
    };
  });
  const listingName = new Map(listings.map((l) => [l.id, l.name ?? ""]));

  const blocks: SnapBlock[] = blks.docs.map((d) => {
    const x = d.data() as Record<string, any>;
    const dates = ((x.sessions ?? []) as { date: string }[]).map((s) => s.date);
    return {
      id: d.id, listingId: str(x.listingId) ?? "", capacity: num(x.capacity), capacityScope: x.capacityScope === "day" ? "day" : "listing",
      counts: (x.dayCounts ?? {}) as Record<string, number>, dayCounts: (x.dayCounts ?? {}) as Record<string, number>,
      dates, bookedCount: num(x.bookedCount), startDate: str(x.startDate), endDate: str(x.endDate), open: x.open !== false,
    };
  });
  const blockIds = new Set(blocks.map((b) => b.id));
  const listingIds = new Set(listings.map((l) => l.id));

  const bookings: SnapBooking[] = bs.docs.map((d) => {
    const x = d.data() as Record<string, any>;
    const kids = Array.isArray(x.kids) ? x.kids.map((k: any) => ({ childId: k.childId, name: k.name, cancelled: k.cancelled === true, dates: k.dates ?? k.days, cancelledDays: k.cancelledDays })) : undefined;
    const kidsLive = kids ? kids.filter((k: any) => !k.cancelled).length : 1;
    const received = receivedOf(x as never);
    const refunded = refundedGross(x as never);
    const age = typeof x.age === "number" ? x.age : undefined;
    return {
      id: d.id, ref: str(x.ref) ?? d.id, listingId: str(x.listingId), blockId: str(x.blockId), tenantId, email: (str(x.email) ?? "").toLowerCase(),
      status: str(x.status) ?? "", pay: str(x.pay), amount: num(x.amount), received, refunded, walletApplied: num(x.walletApplied),
      promoted: /promoted from waitlist/i.test(String(x.note ?? "")), days: Array.isArray(x.days) ? x.days : [], seats: typeof x.seats === "number" ? x.seats : 1, kidsLive, pass: str(x.pass), method: str(x.method), createdAt: str(x.createdAt),
      discountOff: typeof x.discountOff === "number" ? x.discountOff : undefined, listPrice: typeof x.listPrice === "number" ? x.listPrice : undefined,
      addonsTotal: Array.isArray(x.addonLines) ? x.addonLines.reduce((s: number, l: any) => s + num(l.price), 0) : undefined,
      offerExpiresAt: str(x.offerExpiresAt), offeredAt: str(x.offeredAt), requeuedAt: str(x.requeuedAt),
      amountPaid: typeof x.amountPaid === "number" ? x.amountPaid : undefined, cardPaid: typeof x.cardPaid === "number" ? x.cardPaid : undefined,
      tfcAmount: typeof x.tfcAmount === "number" ? x.tfcAmount : undefined, receivedAfterCancel: num(x.receivedAfterCancel), amendFeesCharged: num(x.amendFeesCharged),
      hasPriceOverride: !!x.priceOverride,
      cancel: x.cancel ? { on: x.cancel.on, refund: x.cancel.refund, amount: x.cancel.amount, refundOnly: x.cancel.refundOnly === true } : null, declineReason: str(x.declineReason),
      kids, listingName: str(x.listing) ?? listingName.get(str(x.listingId) ?? ""), childKey: str(x.childId) ?? (str(x.child) ?? "").toLowerCase(),
      age, ageGroup: age !== undefined ? ageCapGroup({ age }, groups) : undefined, earlyBirdScope: str(x.earlyBirdScope), ticket: str(x.ticket),
      dateChangeStatus: x.dateChangeRequest?.status, dateChangeMoves: Array.isArray(x.dateChangeRequest?.moves) ? x.dateChangeRequest.moves.length : undefined,
      amendMovesApproved: typeof x.amendMovesApproved === "number" ? x.amendMovesApproved : undefined, origFirstDate: str(x.origFirstDate),
      paymentIntentId: str(x.paymentIntentId), tenantIdOnDoc: str(x.tenantId),
      serviceAddress: x.serviceAddress && typeof x.serviceAddress === "object" ? { address: str(x.serviceAddress.address), postcode: str(x.serviceAddress.postcode) } : undefined,
      blockMissing: !!x.blockId && !blockIds.has(String(x.blockId)), listingMissing: !!x.listingId && !listingIds.has(String(x.listingId)),
    };
  });

  const payments: SnapPayment[] = pays.docs.map((d) => {
    const x = d.data() as Record<string, any>;
    return { id: d.id, refs: Array.isArray(x.refs) ? x.refs : [], amount: num(x.amount), status: str(x.status) ?? "", type: str(x.type), kind: str(x.kind), createdAt: str(x.createdAt), paidAt: str(x.paidAt), email: (str(x.email) ?? "").toLowerCase() || undefined, paymentIntentId: str(x.paymentIntentId), method: str(x.method) };
  });

  // Wallet balance + ledger for the families on this tenant.
  const families = [...new Set(bookings.map((b) => b.email).filter(Boolean))];
  const wallet: Record<string, number> = {};
  const walletEntries: { email: string; delta: number; ref?: string }[] = [];
  const emails: SnapEmail[] = [];
  const oneByOne = async <T,>(list: string[], fn: (x: string) => Promise<T>) => { for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(fn)); };
  await oneByOne(families, async (email) => {
    const w = await db.collection("wallet").doc(`${tenantId}__${email}`).get();
    if (w.exists) wallet[email] = num(w.get("balance"));
    const es = await db.collection("walletEntries").where("tenantId", "==", tenantId).where("email", "==", email).get();
    for (const e of es.docs) walletEntries.push({ email, delta: num(e.get("delta")), ref: str(e.get("ref")) });
    const ml = await db.collection("mailLog").where("to", "==", email).get();
    for (const m of ml.docs) { const subject = str(m.get("subject")) ?? ""; emails.push({ to: email, subject, kind: emailKind(subject), at: str(m.get("at")) }); }
  });

  return { tenantId, takenAt: new Date().toISOString(), bookings, blocks, payments, listings, wallet, walletEntries, emailsSent: emails };
}

// CLI: tsx server/tools/assure/snapshot.ts <tenantId>  -> prints counts + any invariant violations (read-only).
if (process.argv[1] && /snapshot\.ts$/.test(process.argv[1])) {
  (async () => {
    const id = process.argv[2];
    if (!id) { console.error("usage: snapshot.ts <tenantId>"); process.exit(2); }
    const s = await takeSnapshot(id);
    console.log(JSON.stringify({ tenantId: s.tenantId, bookings: s.bookings.length, blocks: s.blocks.length, payments: s.payments.length, listings: s.listings.length, emails: s.emailsSent?.length ?? 0 }));
    process.exit(0);
  })().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}

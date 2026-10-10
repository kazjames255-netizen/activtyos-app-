// The money of a family RELEASING days of a multi-day pass: ONE calculation, used by the real release (inside its transaction) and by the preview the
// family sees before pressing the button (POST /api/my/bookings/:ref/release-preview). No money logic lives in the browser. Pure: no database.
import { refundFor, effectiveRefundDate, type CancellationPolicy } from "../../../lib/cancellation";
import { dayIso, kidActiveDays, money, paidSoFar as totalPaid, refundableSoFar, releaseCap } from "../../../features/bookings/helpers";
import { applyPartialCancel } from "../../../features/bookings/mutations";
import { walletShareFor } from "../../../features/bookings/refundSplit";
import type { Booking } from "../../../features/bookings/types";

const round2 = (n: number) => Math.round(n * 100) / 100;
const prettyDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export class ReleaseError extends Error { constructor(public status: number, message: string) { super(message); } }

/** A single-child booking has no `kids[]`, and the array `bookingKids` makes up on the fly dates itself from the SESSION LABELS ("Mon 27 Jul 2026").
 *  Partial cancellation works in ISO throughout, so materialise the child properly - from `days` - before touching anything. */
export function materialiseKids(b: Booking): NonNullable<Booking["kids"]> {
  if (b.kids?.length) return b.kids;
  b.kids = [{ name: b.child, ...(b.childId ? { childId: b.childId } : {}), ...(b.age != null ? { age: b.age } : {}), dates: [...(b.days ?? [])].sort() }];
  return b.kids;
}

export interface ReleasePreview {
  partPaid: boolean; resolution: "refund" | "wallet"; releasedCount: number;
  /** The booking's whole price (cash due + wallet spent on it) before and after the released days leave it. */
  priceBefore: number; priceAfter: number; drop: number;
  paid: number; refund: number; credit: number; owedAfter: number;
  /** Where the money goes: the part that goes back to the family's WALLET and the part that goes back the way they paid (card / bank / cash). A refund
   *  on a booking part-paid with wallet credit splits PROPORTIONALLY to what each source paid; wallet credit is wholly wallet. toWallet + toOriginal = refund + credit. */
  toWallet: number; toOriginal: number;
}
export interface ReleaseResult {
  value: number; fullValue: number; releasedCount: number; releasedDays: string[];
  settled: ReturnType<typeof applyPartialCancel>; heldBefore: unknown; preview: ReleasePreview;
}
type Policy = CancellationPolicy | { [k: string]: unknown };

const gross = (b: Pick<Booking, "amount" | "walletApplied" | "walletRelieved">) => round2((b.amount ?? 0) + Math.max(0, (b.walletApplied ?? 0) - (b.walletRelieved ?? 0)));

/** Validates the released days, works out the money, and applies the release to `b` (which the caller owns: the real release passes the booking it will
 *  save, the preview passes a copy it throws away). */
export function computeRelease(b: Booking, wanted: { childKey: string; days: string[] }[], resolution: "refund" | "wallet", policy: Policy, now: string, today: string): ReleaseResult {
  const kids = materialiseKids(b);
  let releasedCount = 0;
  const seen = new Set<string>();
  for (const w of wanted) {
    const kid = kids.find((k) => (k.childId ?? k.name) === w.childKey);
    if (!kid) throw new ReleaseError(400, `${w.childKey} isn't on this booking`);
    if (kid.cancelled) throw new ReleaseError(400, `${kid.name}'s place is already cancelled`);
    // The booking may keep a child's days as labels ("Mon 19 Oct 2026", after a provider cancel-day on a one-child booking) while the family sends ISO:
    // compare them all as ISO.
    const booked = new Set((kid.dates ?? []).map((d) => dayIso(d) ?? d));
    const gone = new Set((kid.cancelledDays ?? []).map((d) => dayIso(d) ?? d));
    for (const raw of w.days) {
      const d = dayIso(raw) ?? raw;
      if (!booked.has(d)) throw new ReleaseError(400, `${kid.name} isn't booked on ${prettyDay(d)}`);
      if (gone.has(d)) throw new ReleaseError(400, `${kid.name}'s place on ${prettyDay(d)} is already cancelled`);
      if (d < today) throw new ReleaseError(400, `${prettyDay(d)} has already passed`);
      const once = `${w.childKey}|${d}`;
      if (seen.has(once)) throw new ReleaseError(400, `${prettyDay(d)} is listed twice`);
      seen.add(once);
      releasedCount += 1;
    }
  }
  if (!releasedCount) throw new ReleaseError(400, "No days were selected");
  // Releasing everything that's left is just a cancellation - say so rather than leaving a booking with no days on it.
  const activeTotal = kids.reduce((n, k) => n + (k.cancelled ? 0 : kidActiveDays(k).length), 0);
  if (releasedCount >= activeTotal) throw new ReleaseError(400, "That's every day left — cancel the whole booking instead");

  const priceBefore = gross(b);
  const paid = totalPaid(b);
  // Pro-rata over every child-day BOOKED (the same denominator the parent's preview uses), against money actually received. A joint booking that's been
  // paid stores amountPaid 0, which valued every released day at £0 - use what was actually paid (incl. wallet credit).
  const bookedChildDays = kids.reduce((n, k) => n + (k.dates ?? []).length, 0) || 1;
  const paidSlot = round2(paid / bookedChildDays);
  // ...but never more than the family is still entitled to (releaseCap): paid / days counts an extra that was already refunded a second time.
  const cap = releaseCap(b, wanted.map((w) => ({ kid: kids.find((k) => (k.childId ?? k.name) === w.childKey)!, days: w.days })));
  const perSlotPaid = round2(Math.min(paidSlot, cap / Math.max(1, releasedCount)));
  // Refund runs each released day through the policy on ITS OWN date; wallet takes the full pro-rata value (the trade for keeping it in the business).
  const releasedDays = wanted.flatMap((w) => w.days);
  const pendingPrior = b.cancel?.refundOnly && b.cancel.refund === "pending" ? Math.max(0, b.cancel.amount ?? 0) : 0; // already promised, not yet sent
  let value = Math.min(Math.max(0, refundableSoFar(b) - pendingPrior),
    resolution === "wallet"
      ? round2(releasedCount * perSlotPaid)
      : round2(releasedDays.reduce((sum, d) => sum + (refundFor(policy as CancellationPolicy, effectiveRefundDate(b.dayOrigin?.[d], d), perSlotPaid, now, "parent")?.amount ?? 0), 0)));
  let fullValue = round2(releasedCount * perSlotPaid);

  const heldBefore = structuredClone({ status: b.status, seats: b.seats, days: b.days, kids: b.kids });
  const settled = applyPartialCancel(b, wanted);
  // A booking only PART paid: the released days leave what is owed (amount drops), and only money paid beyond the new price comes back - no policy cut,
  // the same for a refund and for wallet credit. (A booking paid in full keeps its amount; the value above stands.)
  if (settled.partPaid) { value = settled.overpaid; fullValue = settled.overpaid; }

  const priceAfter = gross(b);
  const preview: ReleasePreview = {
    partPaid: settled.partPaid, resolution, releasedCount, priceBefore, priceAfter, drop: round2(Math.max(0, priceBefore - priceAfter)),
    paid, refund: resolution === "refund" ? value : 0, credit: resolution === "wallet" ? value : 0, owedAfter: round2(Math.max(0, priceAfter - paid)),
    toWallet: 0, toOriginal: 0,
  };
  // The very split the provider's approval will make (settleApprovedRefund): the wallet's proportional share of the refund, read off the booking as it is after the release.
  preview.toWallet = resolution === "wallet" ? value : walletShareFor(b, value);
  preview.toOriginal = round2(value - preview.toWallet);
  return { value, fullValue, releasedCount, releasedDays, settled, heldBefore, preview };
}

export interface ReleaseLog { label: string; kind: string; vars: Record<string, string | number>; amount: number; on: string; by: string; source: string }
/** What the release writes on the booking: the refund-log line (structured, so it can be shown in any language) and the booking note (staff-safe: no
 *  amounts). Wallet credit is only ever mentioned when some was really given. */
export function releaseRecord(p: { resolution: "refund" | "wallet"; value: number; releasedCount: number; partPaid: boolean; drop: number; on?: string }): { log: ReleaseLog | null; note: string } {
  const label = p.releasedCount === 1 ? "1 day" : `${p.releasedCount} days`;
  const on = p.on ?? "";
  const reduced = p.value <= 0.004 && p.drop > 0.004;
  if (reduced) {
    return {
      log: { label: `${label} released — booking reduced`, kind: "reduced", vars: { n: p.releasedCount, amt: money(p.drop) }, amount: 0, on, by: "Booker", source: "Booking" },
      note: `${label} released — booking reduced by ${money(p.drop)}.`,
    };
  }
  if (p.resolution === "wallet") {
    if (p.value > 0.004) return { log: { label: `${label} released — wallet credit`, kind: "releasedWallet", vars: { n: p.releasedCount }, amount: p.value, on, by: "Booker", source: "Wallet" }, note: `${label} released to wallet credit.` };
    return { log: null, note: `${label} released.` };
  }
  return { log: null, note: `${label} released — ${p.value > 0 ? `${money(p.value)} refund requested` : "no refund due"}.` };
}

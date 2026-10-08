import type { Booking } from "./types";
import { labelWithAnswers, requestKeys } from "./addonRequests";
import { addonLineKey, parseAddonLabel } from "./addons";

// PURE rules for taking DAYS off a daily extra (a water bottle bought for 7 days) or the whole extra off a booking. Shared by an approved family
// request (server/src/lib/addonRequestsCore.ts) and by a cancelled day (features/bookings/mutations.ts), so the line, its text and its price
// always say the same thing: after one day goes, "Water bottle × 7 — £21.00" reads "Water bottle × 6 — £18.00".

const round2 = (n: number) => Math.round(n * 100) / 100;
export type BookingLine = NonNullable<Booking["addonLines"]>[number];

/** The flat text a line is also stored as on `booking.addons` ("label — £21.00"). */
export const addonString = (label: string, price: number) => `${label} — £${price.toFixed(2)}`;

/** Where the booking keeps the flat text of this line (-1 when it has none). */
export const addonStringIndex = (b: Pick<Booking, "addons">, line: Pick<BookingLine, "label" | "price">): number =>
  (b.addons ?? []).findIndex((s) => s === addonString(line.label, line.price) || s.startsWith(`${line.label} — `));

/** What `days` of a daily extra are worth: the line's price shared over its days (the whole price when every day goes, so no penny is lost). */
export function dayShare(line: Pick<BookingLine, "price" | "days">, days: string[]): number {
  const total = line.days?.length ?? 0;
  const n = (line.days ?? []).filter((d) => days.includes(d)).length;
  if (!total || !n) return 0;
  return n >= total ? round2(line.price) : round2((line.price * n) / total);
}

/**
 * Take `days` off a daily extra (or, with `days` null, the whole extra off the booking). Edits the line, its flat text and any pending request
 * that names it (the line's key follows its label). Returns the money that left the extra. Does NOT touch the booking's amount or any refund:
 * the caller decides what happens to the money.
 */
export function removeLineDays(b: Booking, line: BookingLine, days: string[] | null): { amount: number; left: number } {
  const idx = addonStringIndex(b, line);
  const oldKey = addonLineKey(line.child, line.label);
  const all = line.days ?? [];
  const gone = days === null ? all : all.filter((d) => days.includes(d));
  const kept = days === null ? [] : all.filter((d) => !days.includes(d));
  if (days !== null && !gone.length) return { amount: 0, left: all.length };
  const amount = days === null || !kept.length ? round2(line.price) : dayShare(line, gone);
  if (!kept.length) {
    b.addonLines = (b.addonLines ?? []).filter((l) => l !== line);
    if (idx >= 0) b.addons = (b.addons ?? []).filter((_, i) => i !== idx);
    return { amount, left: 0 };
  }
  const p = parseAddonLabel(line.label);
  line.label = labelWithAnswers(p.name, kept.length, true, line.answers?.length ? line.answers : p.answers);
  line.price = round2(line.price - amount);
  line.days = kept;
  if (line.qty != null) line.qty = kept.length;
  if (idx >= 0) b.addons[idx] = addonString(line.label, line.price);
  // A request still waiting on this extra keeps pointing at it under the new label.
  const newKey = addonLineKey(line.child, line.label);
  for (const r of b.addonRequests ?? []) {
    if (r.status !== "pending" || !requestKeys(r).includes(oldKey)) continue;
    if (r.key === oldKey) r.key = newKey;
    for (const t of r.targets ?? []) if (t.key === oldKey) t.key = newKey;
  }
  return { amount, left: kept.length };
}

const sameChild = (b: Pick<Booking, "kids">, lineChild: string, child: string): boolean => {
  const a = (lineChild ?? "").trim().toLowerCase(), c = (child ?? "").trim().toLowerCase();
  return a === c || (!a && (b.kids?.length ?? 0) <= 1);
};

/**
 * A day (or days) of a child's place was cancelled: their daily extras follow it. Returns the money that left those extras. A one-off extra and
 * a meal are not touched (they are not tied to a day the child gave up).
 */
export function followCancelledDays(b: Booking, child: string, days: string[]): number {
  let total = 0;
  for (const line of [...(b.addonLines ?? [])]) {
    if (!line.perDay || line.meal || !line.days?.length || !sameChild(b, line.child, child)) continue;
    total += removeLineDays(b, line, days.filter((d) => line.days.includes(d))).amount;
  }
  return round2(total);
}

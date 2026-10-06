// Small PURE booking rules, pulled out of routes/my.ts (behaviour unchanged) so they can be regression-tested without a database.
// Each one exists because a real bug was found in it: see tests/regression/.

export interface TicketOverride { capacity?: string; hidden?: boolean; ageFrom?: string; ageTo?: string }
export interface RangeListing { ageFrom?: string; ageTo?: string; ticketOverrides?: Record<string, TicketOverride> }

/** The age range that applies to a pass: the ticket's own Age from / Age to, falling back to the listing's range for a blank box. */
export function ageRangeFor(listing: RangeListing, pass?: string): { from: number; to: number } {
  const lf = parseInt(listing.ageFrom ?? "", 10), lt = parseInt(listing.ageTo ?? "", 10);
  const ov = pass ? listing.ticketOverrides?.[pass] : undefined;
  const f = parseInt(ov?.ageFrom ?? "", 10), t = parseInt(ov?.ageTo ?? "", 10);
  return { from: Number.isFinite(f) ? f : lf, to: Number.isFinite(t) ? t : lt };
}

/** Is this age outside the range for this pass? Age 0 is a real age (an infant); only an UNKNOWN age (undefined) is exempt. */
export function isOutOfRange(listing: RangeListing, age: number | undefined, pass?: string): boolean {
  const { from, to } = ageRangeFor(listing, pass);
  return typeof age === "number" && Number.isFinite(age) && age >= 0 && ((Number.isFinite(from) && age < from) || (Number.isFinite(to) && age > to));
}

/** A pass the provider HID on this listing is removed from it entirely; a direct API call must not get around the booking page. */
export function passHidden(listing: { ticketOverrides?: Record<string, TicketOverride> }, pass: string): boolean {
  return listing.ticketOverrides?.[pass]?.hidden === true;
}

/** Why an add-on cannot go on this child's line, or null. Only extras the listing offers, and each extra once per child line. */
export function addonRefusal(offeredIds: string[] | undefined, id: string, alreadyChosen: Set<string>, name: string, child: string): string | null {
  if (!(offeredIds ?? []).includes(id)) return `"${name}" isn't offered on this listing any more — remove it from your basket and try again`;
  if (alreadyChosen.has(id)) return `"${name}" was chosen twice for ${child}`;
  alreadyChosen.add(id);
  return null;
}

/** A child already QUEUED (Waitlisted) for a day cannot join that day's queue a second time: two entries could both be offered a place. */
export function isQueuedOn(status: string | undefined, days: string[] | undefined, day: string): boolean {
  return status === "Waitlisted" && (days ?? []).includes(day);
}

/** A card booking holds the place BEFORE the family pays: the "You're booked in" email waits for the card to succeed. */
export function cardUnpaid(method: unknown, amount: number | undefined, onBehalf: unknown): boolean {
  return /^card$/i.test(String(method)) && (amount ?? 0) > 0 && !onBehalf;
}

/** A booking for several days gets ONE session reminder, before its first booked day (a 30-day camp must not send 30 emails).
 *  `days` is the booking's own day list (undefined = every session of the block); `blockDates` are all the block's session dates. */
export function isFirstBookedSession(days: string[] | undefined, blockDates: string[], date: string): boolean {
  const mine = (days && days.length ? days : blockDates).filter(Boolean).slice().sort();
  return mine.length === 0 ? true : mine[0] === date;
}

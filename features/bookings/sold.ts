// Which bookings count as SOLD (booked revenue, attendee tallies, fees). One rule for Finance, its CSV export, the Dashboard, Income, head-office overview and
// split fees: a place that is only Waitlisted, or OFFERED off the waiting list but not accepted yet, has sold nothing (no seat held for good, no money due).
export const NOT_YET_SOLD = ["Waitlisted", "Offered"] as const;
export const isNotYetSold = (status: string): boolean => (NOT_YET_SOLD as readonly string[]).includes(status);
/** Dashboard rule: not cancelled / declined, and not waiting-list. */
export const countsTowardBooked = (b: { status: string }): boolean => b.status !== "Cancelled" && b.status !== "Declined" && !isNotYetSold(b.status);

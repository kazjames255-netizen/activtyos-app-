import type { Booking, BookingFilter, Kid } from "./types";

/** How an operator records a parent paying. One list, shared by the Take
 *  booking modal and the checkout on a listing's view page — two lists is how
 *  a booking ends up with a method the other screen doesn't recognise. The
 *  value is the label, because that is what the booking record stores. */
export const PAY_METHODS = ["Card", "Tax-Free Childcare", "HAF (funded £0)", "PayPal"] as const;

export const FILTER_TABS: [BookingFilter, string][] = [
  ["all", "All"],
  ["approval", "Approval needed"],
  ["confirmed", "Confirmed"],
  ["waitlisted", "Waitlisted"],
  ["unpaid", "Unpaid / invoiced"],
  ["cancelled", "Cancelled"],
  ["refunds", "Refunds"],
];

export function money(n: number): string {
  if (n > 0) return "£" + (Math.round(n * 100) / 100).toFixed(2);
  return n === 0 ? "£0.00" : "—";
}

export function matchesFilter(b: Booking, f: BookingFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "approval":
      return b.status === "Approval needed";
    case "confirmed":
      return b.status === "Confirmed";
    case "waitlisted":
      return b.status === "Waitlisted";
    case "unpaid":
      return b.pay === "Unpaid" || b.pay === "Invoice sent";
    case "cancelled":
      return b.status === "Cancelled" || b.status === "Declined";
    case "refunds":
      return !!(b.cancel && b.cancel.refund);
    default:
      return true;
  }
}

export function matchesSearch(b: Booking, q: string): boolean {
  const needle = q.toLowerCase().trim();
  if (!needle) return true;
  return (
    `${b.booker} ${b.child} ${b.ref} ${b.bid} ${b.email} ${b.listing}`
      .toLowerCase()
      .indexOf(needle) > -1
  );
}

// Badge palette taken from the legacy theme (.b-green/.b-amber/.b-blue/.b-red/.b-grey)
// so the React view sits consistently alongside the surrounding app.
type BadgeTone = { bg: string; fg: string };
const GREEN: BadgeTone = { bg: "var(--green-soft,#e7f8ee)", fg: "#0f7a44" };
const AMBER: BadgeTone = { bg: "#FCE9CE", fg: "#B45309" };
const BLUE: BadgeTone = { bg: "#e8f3fc", fg: "#1d6fb8" };
const RED: BadgeTone = { bg: "var(--red-soft,#fdebec)", fg: "#bb1620" };
const GREY: BadgeTone = { bg: "#eef0f6", fg: "#5b6478" };

export function statusTone(status: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    "Approval needed": AMBER,
    Confirmed: GREEN,
    Waitlisted: BLUE,
    Cancelled: RED,
    Declined: RED,
  };
  return map[status] || GREY;
}

export function payTone(pay: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    Paid: GREEN,
    Unpaid: AMBER,
    "Invoice sent": AMBER,
    Refunded: GREY,
    "Partially refunded": AMBER,
    Funded: BLUE,
  };
  return map[pay] || GREY;
}

export function payLabel(pay: string): string {
  return pay === "Funded" ? "Funded £0" : pay;
}

// Attendee helpers — a booking is either multi-kid (kids[]) or single child.
export function bookingKids(b: Booking): Kid[] {
  if (b.kids && b.kids.length) return b.kids;
  return [
    {
      name: b.child,
      age: b.age,
      dob: b.dob,
      dates: (b.sessions || []).map((s) => s.split(" · ")[0]),
    },
  ];
}

export const attendeeCount = (b: Booking) => bookingKids(b).length;
export const sessionCount = (b: Booking) => (b.sessions ? b.sessions.length : 0);

export const kidActiveDays = (k: Kid) => {
  const cd = k.cancelledDays || [];
  return (k.dates || []).filter((d) => cd.indexOf(d) < 0);
};

export const refundedTotal = (b: Booking) =>
  (b.refundLog || []).reduce((t, x) => t + (x.amount || 0), 0);

export function nowStr(): string {
  return (
    new Date().toLocaleDateString("en-GB") + ", " + new Date().toTimeString().slice(0, 5)
  );
}

// Alternate dates offered when moving a child's day (mirrors legacy pool).
export function altDates(k: Kid): string[] {
  const pool = ["Mon 4 Aug", "Tue 5 Aug", "Wed 6 Aug", "Thu 7 Aug", "Fri 8 Aug"];
  const have = k.dates || [];
  return pool.filter((d) => have.indexOf(d) < 0).slice(0, 4);
}

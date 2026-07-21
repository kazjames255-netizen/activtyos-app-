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

// ── Export ────────────────────────────────────────────────────────────────

/**
 * One CSV cell.
 *
 * Two jobs. Quote anything containing a comma, quote or newline (and double
 * up inner quotes) so the file parses; and neutralise a leading =, +, - or @,
 * which Excel and Sheets treat as the start of a formula. Bookings carry
 * parent-written text — notes, answers to your questions — so a field
 * beginning "=" is a spreadsheet running someone else's input.
 */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A column of anything exportable — bookings, families, whatever comes next. */
export type Col<T> = {
  key: string;
  label: string;
  group: string;
  get: (row: T) => unknown;
  /** Right-align in the PDF. */
  numeric?: boolean;
};

export type ExportColumn = Col<Booking>;

/**
 * Rows and chosen columns to a CSV. Escaping, the BOM and the line endings
 * live in one place so a second export screen can't get them subtly wrong.
 */
export function toCsv<T>(rows: T[], cols: Col<T>[]): string {
  const lines = [cols.map((c) => cell(c.label)).join(",")];
  for (const r of rows) lines.push(cols.map((c) => cell(c.get(r))).join(","));
  // CRLF and a BOM: without them Excel opens a UTF-8 CSV as mojibake and
  // treats "Priya's" as an encoding error rather than an apostrophe.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Every field a booking can be exported with, grouped for the picker. */
export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "ref", label: "Ref", group: "Booking", get: (b) => b.ref },
  { key: "bid", label: "Booking ID", group: "Booking", get: (b) => b.bid },
  { key: "status", label: "Status", group: "Booking", get: (b) => b.status },
  { key: "pay", label: "Payment", group: "Booking", get: (b) => payLabel(b.pay) },
  { key: "method", label: "Method", group: "Booking", get: (b) => b.method },
  { key: "amount", label: "Amount", group: "Booking", numeric: true,
    get: (b) => (typeof b.amount === "number" ? b.amount.toFixed(2) : "") },
  { key: "booker", label: "Parent", group: "Family", get: (b) => b.booker },
  { key: "email", label: "Email", group: "Family", get: (b) => b.email },
  { key: "phone", label: "Phone", group: "Family", get: (b) => b.phone },
  { key: "children", label: "Children", group: "Children",
    get: (b) => bookingKids(b).map((k) => k.name).filter(Boolean).join("; ") },
  { key: "ages", label: "Ages", group: "Children",
    get: (b) => bookingKids(b).map((k) => k.age ?? "").join("; ") },
  { key: "dobs", label: "Dates of birth", group: "Children",
    get: (b) => bookingKids(b).map((k) => k.dob ?? "").join("; ") },
  { key: "attendees", label: "Attendees", group: "Children", numeric: true, get: (b) => attendeeCount(b) },
  { key: "listing", label: "Listing", group: "Activity", get: (b) => b.listing },
  { key: "pass", label: "Pass", group: "Activity", get: (b) => b.pass },
  { key: "ticket", label: "Ticket", group: "Activity", get: (b) => b.ticket },
  { key: "dates", label: "Dates", group: "Activity", get: (b) => b.dates },
  { key: "firstDay", label: "First day", group: "Activity", get: (b) => sessionIsoDates(b)[0] ?? "" },
  { key: "lastDay", label: "Last day", group: "Activity",
    get: (b) => sessionIsoDates(b).slice(-1)[0] ?? "" },
  { key: "sessions", label: "Sessions", group: "Activity", get: (b) => (b.sessions ?? []).join("; ") },
  { key: "sessionCount", label: "Session count", group: "Activity", numeric: true, get: (b) => sessionCount(b) },
  { key: "addons", label: "Add-ons", group: "Extras", get: (b) => (b.addons ?? []).join("; ") },
  { key: "answers", label: "Answers", group: "Extras",
    get: (b) => (b.answers ?? []).map(([q, a]) => `${q}: ${a}`).join("; ") },
  { key: "note", label: "Note", group: "Extras", get: (b) => b.note },
  { key: "cancelOn", label: "Cancelled on", group: "Cancellation", get: (b) => b.cancel?.on ?? "" },
  { key: "cancelBy", label: "Cancelled by", group: "Cancellation", get: (b) => b.cancel?.by ?? "" },
  { key: "cancelMsg", label: "Cancellation reason", group: "Cancellation", get: (b) => b.cancel?.msg ?? "" },
  { key: "refund", label: "Refund", group: "Cancellation", get: (b) => b.cancel?.refund ?? "" },
];

/** Starting points, so nobody has to tick 27 boxes to get a register. */
export const EXPORT_PRESETS: { name: string; hint: string; keys: string[] }[] = [
  { name: "Everything", hint: "Every field", keys: EXPORT_COLUMNS.map((c) => c.key) },
  { name: "Register", hint: "Who's coming, and when",
    keys: ["children", "ages", "listing", "dates", "sessions", "booker", "phone", "status"] },
  { name: "Finance", hint: "What was charged and paid",
    keys: ["ref", "booker", "listing", "pass", "amount", "pay", "method", "refund", "dates"] },
  { name: "Contacts", hint: "For an email or SMS list",
    keys: ["booker", "email", "phone", "children", "listing"] },
];

export const columnsFor = (keys: string[]) =>
  EXPORT_COLUMNS.filter((c) => keys.includes(c.key));

/** The rows exactly as the screen has them — same order, chosen columns. */
export const bookingsToCsv = (rows: Booking[], keys?: string[]) =>
  toCsv(rows, keys ? columnsFor(keys) : EXPORT_COLUMNS);

/** "bookings-2026-07-19.csv" — sorts date-first in a downloads folder. */
export function csvFilename(prefix = "bookings", ext = "csv"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

/**
 * The ISO days a booking runs on, oldest first.
 *
 * Sessions are display strings ("Mon 20 Jul 2026 · 09:00 – 15:00"), so the
 * date has to be parsed back out of one — strictly, by pattern. `new Date()`
 * is far too willing: it reads "Week 1" as 1 January 2001, which would drop a
 * phantom booking into any date range covering that day. Anything not in the
 * expected shape is skipped rather than guessed at.
 */
export function sessionIsoDates(b: Booking): string[] {
  const out: string[] = [];
  for (const s of b.sessions ?? []) {
    const m = /^\w{3}\s+(\d{1,2})\s+(\w{3})\s+(\d{4})\b/.exec(s.split(" · ")[0].trim());
    if (!m) continue;
    const mon = MONTHS.indexOf(m[2].toLowerCase());
    if (mon < 0) continue;
    const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[1])));
    if (!Number.isNaN(d.getTime())) out.push(d.toISOString().slice(0, 10));
  }
  return out.sort();
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Newest first — the order a provider wants on landing, because the booking
 * that just came in is the one they haven't seen.
 *
 * By `createdAt` where there is one, falling back to the reference number:
 * refs increment per tenant, so a higher one was taken later. That fallback
 * is what makes existing bookings sort sensibly instead of jumping to the
 * bottom for want of a timestamp.
 */
export function byNewest(a: Booking, b: Booking): number {
  if (a.createdAt && b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  const num = (r: string) => parseInt(String(r).replace(/\D/g, ""), 10) || 0;
  return num(b.ref) - num(a.ref);
}

/** The day a booking was taken, or "" if it predates us recording it. */
export const bookedOn = (b: Booking) => (b.createdAt ?? "").slice(0, 10);

/** Today, yesterday, the last 7 days — as ISO bounds. */
export function rangeDays(key: "today" | "yesterday" | "week"): { from: string; to: string } {
  const d = new Date();
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const today = iso(d);
  if (key === "today") return { from: today, to: today };
  const y = new Date(d);
  y.setUTCDate(y.getUTCDate() - 1);
  if (key === "yesterday") return { from: iso(y), to: iso(y) };
  const w = new Date(d);
  w.setUTCDate(w.getUTCDate() - 6);
  return { from: iso(w), to: today };
}

/** Does any day of this booking fall inside the range? Blank ends are open. */
export function inDateRange(b: Booking, from: string, to: string): boolean {
  if (!from && !to) return true;
  const days = sessionIsoDates(b);
  if (!days.length) return false;
  return days.some((d) => (!from || d >= from) && (!to || d <= to));
}

/**
 * Does this booking include the given day?
 *
 * Sessions are stored as display strings ("Mon 20 Jul 2026 · 09:00 – 15:00"),
 * not ISO dates, so the day has to be formatted the same way to compare. That
 * is fragile — a change to sessionLabel on the server silently breaks this
 * filter — and the real fix is an ISO date on the session. Noted in the
 * handoff; until then, matching the format is the only option that works
 * against existing bookings.
 */
export function runsOn(b: Booking, iso: string): boolean {
  if (!iso) return true;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return true;
  const label = d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/,/g, "");
  return (b.sessions ?? []).some((s) => s.startsWith(label));
}

/** Palette for family initials. Deliberately not the status colours — a
 *  booking's colour must never be mistaken for its state. */
const AVATARS = ["#2f6bd8", "#e22295", "#6a4fd0", "#0ea5e9", "#f97316", "#0f7a44", "#8b5cf6"];

/** The same family gets the same colour every time, so a list of bookings is
 *  scannable by who's in it rather than by reading every name. */
export function avatarColour(name: string): string {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return AVATARS[h % AVATARS.length];
}

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
      return b.pay === "Unpaid" || b.pay === "Invoice sent" || b.pay === "Awaiting voucher payment";
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
    Offered: AMBER,
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
    // Distinct from Unpaid on purpose: nobody is being chased for this one
    // yet, they're waiting on a third party to send money.
    "Awaiting voucher payment": BLUE,
    Refunded: GREY,
    "Partially refunded": AMBER,
    "Partially paid": AMBER,
    Funded: BLUE,
  };
  return map[pay] || GREY;
}

export function payLabel(pay: string): string {
  if (pay === "Funded") return "Funded £0";
  // The full phrase is too long for a badge sitting in a row of them.
  if (pay === "Awaiting voucher payment") return "Awaiting voucher";
  return pay;
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

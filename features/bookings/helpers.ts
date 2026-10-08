import { dateLocale as dl, formatGBP } from "../../lib/i18n/format"; // relative: the API server imports this file too (no "@/" alias there)
import type { Booking, BookingFilter, Kid } from "./types";
import { csvCell } from "../../lib/csv"; // relative: the API server imports this file too

/** How an operator records a parent paying. One list, shared by the Take
 *  booking modal and the checkout on a listing's view page — two lists is how
 *  a booking ends up with a method the other screen doesn't recognise. The
 *  value is the label, because that is what the booking record stores. */
export const PAY_METHODS = ["Card", "Tax-Free Childcare", "HAF (funded £0)", "PayPal"] as const;

export const FILTER_TABS: [BookingFilter, string][] = [
  ["all", "All"],
  ["approval", "Booking approvals"],
  ["confirmed", "Confirmed"],
  ["waitlisted", "Waitlisted"],
  ["unpaid", "Unpaid / invoiced"],
  ["unreconciled", "Unreconciled"],
  ["cancelled", "Cancelled"],
  ["requests", "Requests"],
  ["refunds", "Refunds"],
];

/** A booking awaiting the operator's decision — a refund not yet approved, or a
 *  pending date-change request. Powers the "Requests" tab + the row badges. */
export function needsDecision(b: Booking): boolean {
  const refundReq = !!(b.cancel && ["full", "partial", "pending"].includes(b.cancel.refund ?? ""));
  const moveReq = b.dateChangeRequest?.status === "pending";
  // A family asking to change / cancel one extra also waits for the provider (features/bookings/addonRequests.ts).
  const addonReq = (b.addonRequests ?? []).some((r) => r.status === "pending");
  return refundReq || moveReq || addonReq;
}

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
  return csvCell(v); // the shared rule in lib/csv — every export uses it
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
  { name: "Contacts", hint: "For an email list",
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
 * A concise, CORRECT date label for what a booking actually attends — not
 * `b.dates`, which holds the block's whole run (e.g. "20 Jul – 11 Aug 2026")
 * and reads as a wildly wrong range for a single-day pass. Uses the real ISO
 * days (or the session strings). Single day → "Thu 6 Aug 2026"; several →
 * "Starts Thu 6 Aug 2026" (the full list is on the expanded card).
 */
export function bookingDateSummary(b: Booking, starts: (date: string) => string = (d) => `Starts ${d}`): string {
  const days = (b.days && b.days.length ? [...b.days] : sessionIsoDates(b)).sort();
  if (!days.length) return b.dates || "—";
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };
  return days.length > 1 ? starts(fmt(days[0])) : fmt(days[0]);
}

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

/** The EVENT-date quick ranges (when the child is actually in, not when the booking was taken): today, tomorrow, this week (Mon-Sun),
 *  next 7 days, next 30 days. Local calendar days, as ISO. */
export type EventRangeKey = "today" | "tomorrow" | "week" | "next7" | "next30";
export function eventRange(key: EventRangeKey, now: Date = new Date()): { from: string; to: string } {
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const add = (n: number) => { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n); return iso(x); };
  if (key === "today") return { from: add(0), to: add(0) };
  if (key === "tomorrow") return { from: add(1), to: add(1) };
  if (key === "next7") return { from: add(0), to: add(6) };
  if (key === "next30") return { from: add(0), to: add(29) };
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  return { from: add(-dow), to: add(6 - dow) };
}

/** A typed event date is only used once its year is sane (2020 .. 3 years ahead), so a half-typed year never filters or flickers. */
export function sensibleEventDate(iso: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  return y >= 2020 && y <= now.getFullYear() + 3 && !Number.isNaN(new Date(`${iso}T00:00:00Z`).getTime());
}

/** The active event-date window from the quick range / the "Between" boxes, or null when no event filter is set. */
export function eventWindow(key: EventRangeKey | "", from: string, to: string, now: Date = new Date()): { from: string; to: string } | null {
  if (key) return eventRange(key, now);
  const f = sensibleEventDate(from, now) ? from : "";
  const t = sensibleEventDate(to, now) ? to : "";
  if (!f && !t) return null;
  return { from: f, to: t };
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
    .toLocaleDateString(dl(), {
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
// Blue "house" family — no green/orange/pink — so avatars stay on-palette.
const AVATARS = ["#3f78d8", "#2f3fa8", "#6a4fd0", "#1f77c9", "#8a2fb0", "#1d3a8f", "#4b6bd0"];
const AVATAR_GRADS = [
  "linear-gradient(135deg,#4f8bf5,#16306e)",
  "linear-gradient(135deg,#6d84e8,#2f3fa8)",
  "linear-gradient(135deg,#8a7bf0,#4b3bc9)",
  "linear-gradient(135deg,#5bb3f0,#1f77c9)",
  "linear-gradient(135deg,#c46ee0,#8a2fb0)",
  "linear-gradient(135deg,#4f8bf5,#1d3a8f)",
  "linear-gradient(135deg,#7f97ec,#3140a0)",
];
function avatarHash(name: string): number {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h;
}

/** The same family gets the same colour every time, so a list of bookings is
 *  scannable by who's in it rather than by reading every name. */
export function avatarColour(name: string): string {
  return AVATARS[avatarHash(name) % AVATARS.length];
}
/** Gradient variant for the list rows (blue-house style). */
export function avatarGradient(name: string): string {
  return AVATAR_GRADS[avatarHash(name) % AVATAR_GRADS.length];
}

export function money(n: number): string {
  if (n > 0) return formatGBP(Math.round(n * 100) / 100);
  return n === 0 ? formatGBP(0) : "—";
}

/** Reconciled = the money is in and fully accounted for. Mirrors the ledger. */
/** Statuses where the child has no place yet — so no money is owed. A waitlisted
 *  booking sitting in "unreconciled" reads as debt you're chasing, when there's
 *  nothing to chase until it's confirmed. */
const NO_PLACE_YET = ["Waitlisted", "Offered", "Approval needed"];
/** Waitlisted / Offered: the price is stored but nothing is owed until accepted. */
export const waitingForPlace = (status: string) => status === "Waitlisted" || status === "Offered";

export function isUnreconciled(b: Booking): boolean {
  if (b.status === "Cancelled" || b.status === "Declined") return false;
  if (NO_PLACE_YET.includes(b.status)) return false;
  const isCard = /card/i.test(b.method ?? "") && !b.voucherScheme;
  if (isCard) return false;                                   // settles via Stripe
  const outstanding = Math.max(0, (b.amount ?? 0) - (b.amountPaid ?? 0));
  const settled = (b.pay === "Paid" || b.pay === "Funded") && outstanding <= 0;
  return !settled && ((b.amount ?? 0) > 0 || !!b.voucherScheme);
}

/** The payment route a booking is paying by, as a tidy bucket (same buckets as the Reconciliation page). */
export function payMethodCat(b: Booking): string {
  const m = (b.method ?? "").toLowerCase();
  if (/tax.?free|tfc/.test(m) || /tax.?free|\btfc\b/i.test(b.voucherScheme ?? "")) return "Tax-Free Childcare";
  if (b.voucherScheme || /voucher/.test(m)) return "Childcare vouchers";
  if (/cash/.test(m)) return "Cash";
  if (/bank|transfer/.test(m)) return "Bank transfer";
  if (/haf|funded/.test(m) || b.pay === "Funded") return "HAF / funded";
  if (/card/.test(m)) return "Card";
  return "Other";
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
      // A waitlisted/offered place owes nothing until it is accepted.
      if (!holdsPlace(b)) return false;
      return b.pay === "Unpaid" || b.pay === "Invoice sent" || b.pay === "Awaiting voucher payment";
    case "unreconciled":
      // Money that lands OFF-platform and hasn't been matched yet — vouchers,
      // Tax-Free Childcare, cash, bank transfer. Deliberately the same rule the
      // Reconciliation ledger uses (server/src/routes/reconciliation.ts): card
      // settles through Stripe so it never needs matching, and a cancelled
      // booking isn't owed. If those two ever disagree, an operator gets a
      // different answer to "what's outstanding" depending which page they open.
      return isUnreconciled(b);
    case "cancelled":
      return b.status === "Cancelled" || b.status === "Declined";
    case "requests":
      return needsDecision(b);
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
// Blue "house" palette — no green (the operator prefers the money-in blues).
const NAVY: BadgeTone = { bg: "#eaf0fc", fg: "#1d3a8f" };   // Confirmed
const INDIGO: BadgeTone = { bg: "#e8ecfb", fg: "#2f3fa8" }; // Paid
const VIOLET: BadgeTone = { bg: "#f6e9fb", fg: "#8a2fb0" }; // Waitlisted
const AMBER: BadgeTone = { bg: "#FCE9CE", fg: "#B45309" };
const BLUE: BadgeTone = { bg: "#e5f2fd", fg: "#1f77c9" };   // voucher / funded
const RED: BadgeTone = { bg: "var(--red-soft,#fdebec)", fg: "#bb1620" };
const GREY: BadgeTone = { bg: "#eef0f6", fg: "#5b6478" };

export function statusTone(status: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    "Approval needed": AMBER,
    Confirmed: NAVY,
    Waitlisted: VIOLET,
    Offered: AMBER,
    Cancelled: RED,
    Declined: RED,
  };
  return map[status] || GREY;
}

export function payTone(pay: string, status?: string): BadgeTone {
  if (status && waitingForPlace(status)) return GREY;
  const map: Record<string, BadgeTone> = {
    Paid: INDIGO,
    Unpaid: AMBER,
    "Invoice sent": AMBER,
    // Distinct from Unpaid on purpose: nobody is being chased for this one
    // yet, they're waiting on a third party to send money.
    "Awaiting voucher payment": BLUE,
    Refunded: GREY,
    "Refund pending": AMBER,
    "Partially refunded": AMBER,
    "Partially paid": AMBER,
    Funded: BLUE,
  };
  return map[pay] || GREY;
}

export function payLabel(pay: string): string {
  if (pay === "Funded") return "Funded £0";
  // The full phrase is too long for a badge sitting in a row of them.
  if (pay === "Awaiting voucher payment") return "Voucher pending";
  return pay;
}

/**
 * Pay label that keeps the voucher context after it's reconciled — a paid
 * voucher booking reads "Voucher paid", not a bare "Paid", so an operator can
 * still tell how the money came in.
 */
export function payLabelFor(b: { pay: string; status?: string; voucherScheme?: string; method?: string }): string {
  // Nothing is owed until a waitlisted place is offered and accepted.
  if (b.status && waitingForPlace(b.status)) return "Waiting list - nothing owed";
  // A cancelled / declined booking that never paid owes nothing: "Unpaid" read as money still due.
  if ((b.status === "Cancelled" || b.status === "Declined") && (b.pay === "Unpaid" || b.pay === "Invoice sent")) return b.status === "Declined" ? "Declined - nothing owed" : "Cancelled - nothing owed";
  // Every off-platform route shares one status, so the words come from the method.
  if (b.pay === "Awaiting voucher payment") return pendingPayWords(b).chip;
  const isVoucher = !!b.voucherScheme || (b.method ?? "").toLowerCase().includes("voucher");
  const isTfc = /tax.?free|tfc/i.test(b.method ?? "");
  if (isTfc) {
    // "TFC received" read as a state that ISN'T paid. Whatever the rail, a
    // settled booking has to say Paid first; the method is the qualifier.
    if (b.pay === "Paid") return "Paid · TFC";
    if (b.pay === "Refunded" || b.pay === "Partially refunded") return `${payLabel(b.pay)} via HMRC`;
    return payLabel(b.pay);
  }
  if (!isVoucher) return payLabel(b.pay);
  if (b.pay === "Paid") return "Paid · voucher";
  // A voucher refund goes back through the scheme, not a card — say so.
  if (b.pay === "Refunded" || b.pay === "Partially refunded") return `${payLabel(b.pay)} via voucher`;
  return payLabel(b.pay);
}

/** How the money came in (or will), for the Payment column's sub-line — the
 *  scheme name for a voucher, else a tidy method label. */
export function payMethodLabel(b: { voucherScheme?: string; method?: string }): string {
  if (b.voucherScheme) return b.voucherScheme;
  const m = (b.method ?? "").trim();
  if (!m) return "—";
  if (/voucher/i.test(m)) return "Voucher";
  if (/cash/i.test(m)) return "Cash";
  if (/bank|transfer/i.test(m)) return "Bank transfer";
  if (/tax.?free|tfc/i.test(m)) return "Tax-Free Childcare";
  if (/haf|funded/i.test(m)) return "Free / funded";
  if (/card/i.test(m)) return "Card";
  return m;
}

/**
 * The two labels an off-platform payment needs, derived from HOW it's being paid.
 *
 * `pay` is a single status — "Awaiting voucher payment" — used for every payment
 * that lands outside the platform, so the UI said "Voucher pending" and "Mark
 * voucher received" on a Tax-Free Childcare booking, a cash one and a bank
 * transfer alike. The status is shared; the words shouldn't be.
 */
export function pendingPayWords(b: { voucherScheme?: string; method?: string }): { chip: string; action: string } {
  const label = payMethodLabel(b);                       // "Edenred" / "Tax-Free Childcare" / "Cash" / …
  if (/tax.?free/i.test(label)) return { chip: "TFC pending", action: "Mark Tax-Free Childcare received" };
  if (/cash/i.test(label)) return { chip: "Cash pending", action: "Mark cash received" };
  if (/bank|transfer/i.test(label)) return { chip: "Transfer pending", action: "Mark transfer received" };
  if (label === "Voucher" || label === "—") return { chip: "Voucher pending", action: "Mark voucher received" };
  // A named scheme — say which, so a row of pending payments is scannable.
  return { chip: `${label} pending`, action: `Mark ${label} received` };
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

// Children still holding a place: a cancelled child no longer counts (a fully
// cancelled booking still shows everyone who was on it).
export const attendeeCount = (b: Booking) => {
  const kids = bookingKids(b);
  if (b.status === "Cancelled") return kids.length;
  return kids.filter((k) => !k.cancelled).length;
};
export const sessionCount = (b: Booking) => (b.sessions ? b.sessions.length : 0);

// A booked day is stored as ISO ("2026-10-19") or, on a booking whose kids[] was made up from its session labels (after a provider cancel-day on a
// one-child booking), as a label ("Mon 19 Oct 2026"): the two never compare equal as text, so days are always compared as ISO.
export const kidActiveDays = (k: Kid) => {
  const cd = (k.cancelledDays || []).map((d) => dayIso(d) ?? d);
  return (k.dates || []).filter((d) => cd.indexOf(dayIso(d) ?? d) < 0);
};

export const refundedTotal = (b: Booking) =>
  (b.refundLog || []).reduce((t, x) => t + (x.amount || 0), 0);

// —— Money-dashboard aggregation helpers ——————————————————————————————————
// These exist because the naive `isPaid ? amount : 0` / refundLog-only math
// understates real revenue: a refund flips `pay` to "Refunded" (so the whole
// booking's collected money vanished), partial payments were ignored, and
// whole-booking refunds (cancel.amount) were never counted. Use THESE in the
// Dashboard + Finance analytics, not `isPaid`/`refundedTotal` directly.

/** What actually came IN on this booking, independent of the current pay label
 *  (a refund flips it to "Refunded"/"Partially refunded"): the tracked split
 *  `amountPaid` when present, else the full `amount` for any paid/refunded
 *  state, else 0 (genuinely unpaid). */
export const receivedOf = (b: Booking) => {
  const paid = Number(b.amountPaid);
  // Store credit spent on a booking is money that came in too: `amount` is already net of it, and the wallet was
  // topped up earlier by a refund that Money in deducted — without this it is deducted once and never added back.
  const wallet = Math.max(0, Number(b.walletApplied) || 0);
  if (Number.isFinite(paid) && paid > 0) return paid + wallet;
  return b.pay === "Paid" || b.pay === "Funded" || b.pay === "Refund pending" || b.pay === "Refunded" || b.pay === "Partially refunded"
    ? (b.amount || 0) + wallet
    : wallet;
};

/** The CASH (card / bank / cash) that came in on this booking, WITHOUT store credit. `amount` is already net of store credit, so
 *  "what is still owed" must be `amount - cashReceivedOf`: using receivedOf (which adds the wallet back for the income screens)
 *  took the credit off twice and asked the card for £2.50 on a £7.50 balance (QA-C D1). */
export const cashReceivedOf = (b: Booking) => {
  const paid = Number(b.amountPaid);
  if (Number.isFinite(paid) && paid > 0) return paid;
  return b.pay === "Paid" || b.pay === "Funded" || b.pay === "Refund pending" || b.pay === "Refunded" || b.pay === "Partially refunded" ? (b.amount || 0) : 0;
};

/** Everything actually refunded on this booking: per-day/child refunds
 *  (`refundLog`) PLUS an APPROVED whole-booking refund (`cancel.amount`). A
 *  still-pending refund request is NOT counted — the money hasn't moved.
 *  (Unlike `refundedTotal`, which is refundLog-only and drives pay state.) */
export const refundedGross = (b: Booking) => {
  const log = (b.refundLog || []).reduce((t, x) => t + (x.amount || 0), 0);
  const c = b.cancel;
  // A cancellation whose refund hasn't been approved yet (full/partial/pending) has paid nothing back —
  // even on older bookings already stamped "Refunded" at cancel time.
  const awaiting = !!c && (c.refund === "full" || c.refund === "partial" || c.refund === "pending");
  const wholeRefunded = !!c && !awaiting && (b.pay === "Refunded" || b.pay === "Partially refunded" || c.refund === "approved");
  // Approving a cancellation refund writes a "Refund approved…" line into the
  // log, so the log ALREADY holds that money. Adding the cancellation amount
  // as well took it off twice and showed a booking that kept £10 as £0.
  const approvalLogged = (b.refundLog || []).some((x) => /^refund approved/i.test(x.label || "") && (x.amount || 0) > 0);
  // Never more than came in: a refund counted twice (or paid back in two places) must not show as more than was paid.
  const total = log + (wholeRefunded && !approvalLogged ? (c!.amount || 0) : 0);
  const cap = receivedOf(b);
  return cap > 0 ? Math.min(total, cap) : total;
};

/** Net revenue retained on this booking = money received − money refunded. */
export const collectedNet = (b: Booking) => Math.max(0, receivedOf(b) - refundedGross(b));

/** Money still owed on a live (non-cancelled) booking = price − received. */
export const owedOf = (b: Booking) => Math.max(0, (b.amount || 0) - cashReceivedOf(b));

/** Does this booking hold a place? Cancelled/declined don't, and nor does
 *  anything still waiting for one (NO_PLACE_YET) — nothing is owed on those. */
export const holdsPlace = (b: Pick<Booking, "status">) =>
  b.status !== "Cancelled" && b.status !== "Declined" && !NO_PLACE_YET.includes(b.status);

/**
 * THE "still owed" rule — what a family owes on this booking right now. One
 * rule for every money screen: the Dashboard's Outstanding card
 * (server/src/routes/dashboard.ts) and Finance's Owed / Debts
 * (features/money/FinanceAnalyticsApp.tsx) both sum this, so they can't
 * disagree (acceptance d19s7). Keyed on the money, not the pay label: a
 * waitlisted place owes nothing, and "Pay on the day" or a legacy placeholder
 * owes its balance just like "Unpaid" does.
 */
export const owedNow = (b: Booking) => (holdsPlace(b) ? owedOf(b) : 0);

/** A payment record that is money IN — a settled card payment or a recorded
 *  offline one. Refunds, failed and unfinished ("created") card attempts
 *  aren't. The Dashboard's "taken this week" and Finance's payment-date
 *  bucketing both use this. */
export const isMoneyIn = (p: { type?: string; status?: string }) =>
  p.type !== "refund" && (p.status === "recorded" || p.status === "succeeded");

export function nowStr(): string {
  // UK wall clock, not the machine's: the server runs in UTC, so this was an hour out all summer.
  const now = new Date();
  return (
    now.toLocaleDateString(dl(), { timeZone: "Europe/London" }) + ", " +
    now.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  );
}

/** The block's availability as GET /api/blocks returns it — feeds altDates. */
export interface BlockAvail {
  id: string;
  capacityScope?: "day" | "listing";
  sessions: { date: string; spotsLeft: number }[];
}

/** "2026-08-04" → "Tue 04 Aug 2026" — matches the server's session label
 * prefix, so it can be compared against legacy label-format kid dates. */
export const sessionDayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString(dl(), { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/,/g, "");

/** Real alternate dates for moving a child's day: the block's OTHER sessions,
 * skipping full days when capacity is per-day. Kid dates may be ISO (modern)
 * or label text (legacy) — both are matched. */
export function altDates(k: Kid, block?: BlockAvail | null): { iso: string; label: string }[] {
  if (!block) return [];
  const have = new Set([...(k.dates || []), ...(k.cancelledDays || [])]);
  return block.sessions
    .filter((s) => !have.has(s.date) && !have.has(sessionDayLabel(s.date)))
    .filter((s) => (block.capacityScope ?? "listing") !== "day" || s.spotsLeft > 0)
    .map((s) => ({ iso: s.date, label: sessionDayLabel(s.date) }));
}

/**
 * What the family has actually handed over for this booking: card/cash/voucher
 * money plus any wallet credit spent on it. Every refund is worked out from
 * THIS, not from `amount`:
 *  - a part-paid booking (£150 of £200) used to be quoted £0 back, because the
 *    refund only counted `amount` when pay was exactly "Paid";
 *  - `amount` is already net of wallet credit, so credit spent on a booking was
 *    never counted — and never came back when it was cancelled.
 * "Paid" takes the larger of amount/amountPaid: a joint sibling booking stores
 * amountPaid 0 even once it's been paid in full.
 */
export function paidSoFar(b: Pick<Booking, "pay" | "amount" | "amountPaid" | "walletApplied">): number {
  // "Refunded" / "Partially refunded" were paid before they were refunded —
  // the refund is taken off separately (refundableSoFar), not by the status.
  const settled = b.pay === "Paid" || b.pay === "Refund pending" || b.pay === "Refunded" || b.pay === "Partially refunded";
  const cash = settled ? Math.max(b.amount ?? 0, b.amountPaid ?? 0) : Math.max(0, b.amountPaid ?? 0);
  return Math.round((cash + Math.max(0, b.walletApplied ?? 0)) * 100) / 100;
}

/**
 * What can still be refunded: paid, minus every refund already given — the
 * refund log (released days, wallet credit, provider day/child cancels) and
 * the running total of approved cancellation refunds. Without this a family
 * could release a day for £40, then cancel the lot and be refunded the full
 * £200 again — £240 back on a £200 booking.
 */
export function refundableSoFar(b: Booking): number {
  // Approving a refund writes a "Refund approved" log line for money that refundedApproved ALSO totals — count it once.
  const logged = (b.refundLog || []).reduce((t, x) => t + (/^refund approved/i.test(x.label || "") ? 0 : x.amount || 0), 0);
  const given = logged + Math.max(0, b.refundedApproved ?? 0);
  return Math.round(Math.max(0, paidSoFar(b) - given) * 100) / 100;
}

/** A refund the provider has agreed to give but not yet sent: a cancellation
 *  whose refund is still waiting on "Mark refund sent" (cancel.refund full /
 *  partial / pending). The money has NOT moved, so it is not in refundedGross —
 *  Money in shows it as "Refund owed", never as already refunded. */
export const refundOwedOf = (b: Pick<Booking, "cancel" | "pay" | "amount" | "amountPaid" | "walletApplied" | "refundLog" | "refundedApproved">): number => {
  const c = b.cancel;
  if (!c || !(c.refund === "full" || c.refund === "partial" || c.refund === "pending")) return 0;
  return Math.round(Math.max(0, Math.min(c.amount ?? 0, refundableSoFar(b as Booking))) * 100) / 100;
};

/** What one child's place (or some of its days) is worth in money actually
 *  PAID: paid ÷ every booked child-day × the days given up. Paid, not the
 *  price: an unpaid booking has nothing to give back, and wallet credit spent
 *  on it counts. `days` omitted = all of that child's days still standing.
 *  Never more than the family is still entitled to (releaseCap): an extra that was already refunded is not paid back a second time. */
export function releaseValue(b: Booking, ki: number, days?: string[]): number {
  const kids = bookingKids(b);
  const k = kids[ki];
  if (!k) return 0;
  const booked = kids.reduce((n, x) => n + Math.max(1, (x.dates || []).length), 0) || 1;
  const n = days ? days.length : (k.dates || []).length ? kidActiveDays(k).length : 1;
  const prorata = Math.round((paidSoFar(b) / booked) * n * 100) / 100;
  return Math.min(prorata, releaseCap(b, [{ kid: k, days: days ?? kidActiveDays(k) }]));
}

const sameKid = (kids: Kid[], lineChild: string, k: Kid): boolean => {
  const a = (lineChild ?? "").trim().toLowerCase(), c = (k.name ?? "").trim().toLowerCase();
  return a === c || (!a && kids.length <= 1);
};

/**
 * The most that can go back when `releases` (a child's days) are given up, so that the TOTAL given back never passes what the family is entitled to on
 * what is left standing. Used on top of the pro-rata share, which on its own would hand back an extra a second time (paid ÷ days counts the T-shirt
 * and the water bottle that were already refunded, once as the extras refund and again inside the days).
 *
 *   money still held (paid - everything given or promised)  -  value of what REMAINS after the release
 *   value remaining = pass price per standing day x standing days left  +  the extras still wanted on the days left
 *
 * The pass price per day is what is held over the extras kept, shared over the days standing - or the price (amount over the extras) over every day
 * booked, whichever is smaller (days a policy kept the money for do not raise the next day's price). Extras already refunded are no longer on the
 * booking's lines, or are flagged refunded, so they count nowhere.
 */
export function releaseCap(b: Booking, releases: { kid: Kid; days: string[] }[]): number {
  const kids = bookingKids(b);
  const pendingPrior = b.cancel?.refundOnly && b.cancel.refund === "pending" ? Math.max(0, b.cancel.amount ?? 0) : 0;
  const held = Math.max(0, refundableSoFar(b) - pendingPrior);
  const lines = (b.addonLines ?? []).filter((l) => l.refunded !== true);
  const extrasHeld = lines.reduce((t, l) => t + (Number(l.price) || 0), 0);
  const standingBefore = kids.reduce((t, k) => t + (k.cancelled ? 0 : kidActiveDays(k).length), 0);
  const booked = kids.reduce((n, x) => n + Math.max(1, (x.dates || []).length), 0) || 1;
  if (standingBefore <= 0) return held;
  const gross = (b.amount ?? 0) + Math.max(0, (b.walletApplied ?? 0) - (b.walletRelieved ?? 0));
  const passPerDay = Math.min(Math.max(0, held - extrasHeld) / standingBefore, Math.max(0, gross - extrasHeld) / booked);

  const gone = new Map<Kid, Set<string>>();
  for (const r of releases) {
    const set = gone.get(r.kid) ?? new Set<string>();
    const active = new Set(kidActiveDays(r.kid).map((d) => dayIso(d) ?? d));
    for (const d of r.days) if (active.has(dayIso(d) ?? d)) set.add(dayIso(d) ?? d);
    gone.set(r.kid, set);
  }
  let releasedDays = 0;
  for (const set of gone.values()) releasedDays += set.size;
  const standingAfter = Math.max(0, standingBefore - releasedDays);

  let extrasAfter = 0;
  for (const l of lines) {
    const owner = kids.find((k) => sameKid(kids, l.child, k));
    const price = Number(l.price) || 0;
    if (!owner) { extrasAfter += price; continue; }
    if (owner.cancelled) continue; // kept by the provider with a place that was already given up: it is not worth anything to a day still to come
    const set = gone.get(owner);
    if (!set || !set.size) { extrasAfter += price; continue; }
    const active = kidActiveDays(owner).map((d) => dayIso(d) ?? d);
    if (active.every((d) => set.has(d))) continue; // the whole place goes, and its extras with it
    if (l.perDay && !l.meal && l.days?.length) {
      const kept = l.days.filter((d) => !set.has(dayIso(d) ?? d)).length;
      extrasAfter += (price * kept) / l.days.length;
    } else extrasAfter += price;
  }
  return Math.round(Math.max(0, held - (passPerDay * standingAfter + extrasAfter)) * 100) / 100;
}

/** A kid date (ISO, or the legacy "Mon 12 Oct 2026" label) as ISO, or undefined. */
export function dayIso(d: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return sessionIsoDates({ sessions: [d] } as Booking)[0];
}

/** A booking's phone as a real number, or "" — never the "—" placeholder that
 *  older bookings were stamped with (acceptance d10s8). Read phones through
 *  this so a placeholder can't win over the family's real number on file. */
export const realPhone = (p?: string | null): string => {
  const v = (p ?? "").trim();
  return /^[—–-]*$/.test(v) ? "" : v;
};

/** Translated form of pendingPayWords(b).action ("Mark cash received"). `w` is useWord() for a scheme name. */
export function pendingPayActionT(t: (k: string, v?: Record<string, string | number>) => string, w: (s: string) => string, b: { voucherScheme?: string; method?: string }): string {
  const label = payMethodLabel(b);
  if (/tax.?free/i.test(label)) return t("p7bkl.act_tfc");
  if (/cash/i.test(label)) return t("p7bkl.act_cash");
  if (/bank|transfer/i.test(label)) return t("p7bkl.act_transfer");
  if (label === "Voucher" || label === "—") return t("p7bkl.act_voucher");
  return t("p7bkl.act_named", { label: w(label) });
}

/** CN-006/009/011: which refund button the provider sees. Decided by how the booking was PAID first, then by the family's chosen destination. */
export function refundButtonKind(b: { voucherScheme?: string; method?: string; paymentIntentId?: string; cancel?: { refundTo?: string } | null }):
  "wallet" | "reimbursed" | "cash" | "stripe" | "bank" | "plain" {
  const m = (b.method ?? "").toLowerCase();
  const voucher = !!b.voucherScheme || /voucher|tax.?free|tfc|haf|childcare/.test(m);
  const dest = b.cancel?.refundTo;
  if (dest === "wallet") return "wallet";
  if (voucher) return "reimbursed";
  if (!b.paymentIntentId && /cash|bank|bacs|transfer|cheque|paypal|offline/.test(m)) return "cash";
  if (b.paymentIntentId) return "stripe";
  return dest === "card" ? "bank" : "plain";
}

type RefundCarrier = {
  cancel?: { refund?: string; refundVia?: string; refundTransfer?: string; amount?: number; refundCash?: number; refundRecordedAt?: string; refundedAt?: string } | null;
  refundEntries?: { id?: string; cash: number; via: string; status: string; approvedAt?: string }[];
  walletRefunded?: number; refundedApproved?: number; lastRefundSent?: { amount: number; at: string };
};

/** The offline refunds (bank transfer / cash / voucher) the provider has RECORDED but not confirmed as sent: one per approved refund, so a second
 *  refund can never hide the first. Older bookings kept only the single cancel record: that one counts while it is approved, offline and not sent. */
export function unsentRefunds(b: RefundCarrier): { cash: number; since: string }[] {
  if ((b.refundEntries ?? []).length) return (b.refundEntries ?? []).filter((e) => e.via === "offline" && e.status === "approved").map((e) => ({ cash: e.cash, since: e.approvedAt ?? "" }));
  const c = b.cancel;
  if (!c || c.refund !== "approved" || c.refundVia !== "offline" || c.refundTransfer === "sent") return [];
  const asked = c.refundCash != null ? c.refundCash : (b.refundedApproved && b.refundedApproved > 0 ? b.refundedApproved : (c.amount ?? 0)) - (b.walletRefunded ?? 0);
  return [{ cash: Math.max(0, asked), since: c.refundRecordedAt || c.refundedAt || "" }];
}

/** Is any recorded offline refund still waiting for the provider's transfer? Card and wallet refunds are never "awaiting" (Stripe sends the card refund at
 *  once, wallet credit is instant). An older offline refund with no `refundTransfer` counts as awaiting (its ledger row is "to-reimburse"). */
export function refundAwaitingTransfer(b: RefundCarrier): boolean {
  return unsentRefunds(b).length > 0;
}

/** The grey 'nothing left to do' note on a CANCELLED booking page: which catalogue key to show, or null while something is still waiting on the
 *  provider (a refund to approve, or an approved offline refund to send). It names who cancelled: the family (cancel.by "Booker") or the provider. */
export function cancelledBannerKey(b: RefundCarrier & { status?: string; cancel?: (RefundCarrier["cancel"] & { by?: string; refundOnly?: boolean }) | null }): string | null {
  if (b.status !== "Cancelled") return null;
  const r = b.cancel?.refund;
  if (refundAwaitingTransfer(b) || r === "full" || r === "partial" || r === "pending") return null;
  return b.cancel?.by === "Provider" ? "p7bd.cancelledByProviderNothingToDo" : "p7bd.cancelledNothingToDo";
}

/** The money the provider still has to send back: the cash part of every recorded refund not yet marked sent. When nothing is waiting (it was just
 *  sent) this is what the last confirmation sent, so the "has been sent" wording names the right amount. */
export function refundTransferAmount(b: RefundCarrier): number {
  const open = unsentRefunds(b);
  if (open.length) return Math.round(open.reduce((t, e) => t + Math.max(0, e.cash), 0) * 100) / 100;
  if (b.lastRefundSent) return Math.round(Math.max(0, b.lastRefundSent.amount) * 100) / 100;
  const c = b.cancel;
  if (c?.refundCash != null) return Math.round(Math.max(0, c.refundCash) * 100) / 100;
  const asked = b.refundedApproved && b.refundedApproved > 0 ? b.refundedApproved : (c?.amount ?? 0);
  return Math.round(Math.max(0, asked - (b.walletRefunded ?? 0)) * 100) / 100;
}

/** A booking's extras as readable lines. With several children on one booking each line says whose it is ("Camp T-shirt (T-shirt size: M) — £12.00 · for Ava"),
 *  because the plain `addons` strings carry no name. Older bookings (no structured lines) fall back to the strings. */
export function addonLinesFor(b: { addons?: string[]; addonLines?: { child: string; label: string; price: number }[]; kids?: unknown[] }): string[] {
  const lines = b.addonLines ?? [];
  const many = new Set(lines.map((l) => l.child.trim())).size > 1 || (b.kids?.length ?? 0) > 1;
  if (!lines.length || !many) return b.addons ?? [];
  return lines.map((l) => `${l.label} — £${l.price.toFixed(2)} · for ${l.child}`);
}


/** "12 High St, MK10 9NR · Kents Hill" - the home-visit address a provider reads: the street line if given, the postcode, and the area the app recognised. */
export function visitAddressLabel(sa?: { address?: string; postcode?: string; area?: string } | null): string {
  if (!sa) return "";
  const line = [sa.address, sa.postcode].map((x) => (x ?? "").trim()).filter(Boolean).join(", ");
  // The recognised area often repeats the town the family typed ("12 Corris Court, Milton Keynes, MK10 9NR · Broughton & Moulsoe, Milton Keynes"):
  // keep only the parts of the area that the address line does not already say.
  const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const have = norm(line);
  const area = (sa.area ?? "").split(",").map((x) => x.trim()).filter((part) => part && !have.includes(norm(part))).join(", ");
  return area ? `${line} · ${area}` : line;
}

/** A booking whose chosen way to pay is NOT the card (bank transfer, cash, voucher, Tax-Free Childcare): its pay button opens a CARD form, so it is
 *  labelled "Pay by card instead" and not a plain "Pay". One rule for My bookings and the Payments page. */
export const isNonCardMethod = (method: string | undefined | null): boolean => /bank|transfer|cash|voucher|tfc|tax[- ]?free/i.test(method ?? "");

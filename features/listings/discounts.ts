import { money } from "../bookings/helpers";

// ─────────────────────────────────────────────────────────────────────────
// Automatic discounts — the ONE implementation, shared verbatim by the
// listing builder (live preview while the operator types) and the server
// (server/src/routes/my.ts prices every parent booking with it). Keep this
// module pure: no React, no browser APIs, no Firebase.
//
// Three rule types. Multi-session is always applied after multi-person, and
// where rules conflict the booker gets the best price.
// ─────────────────────────────────────────────────────────────────────────

export type DiscountKind = "person" | "session" | "early";
export interface DiscountRule {
  id: string;
  kind: DiscountKind;
  name: string; // shown to bookers
  passNames: string[]; // which tickets it applies to; [] = all
  enabled: boolean;
  /** person: applies when attendees > this. session: when sessions > this. */
  moreThan: number;
  /** person only — who in the booking gets the discount. */
  appliesTo: "all" | "after1" | "second";
  method: "price" | "subtract" | "percent";
  value: number; // £ for price/subtract, % for percent
  /** early only — must book on or before this date. */
  beforeDate: string;
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export function emptyRule(kind: DiscountKind): DiscountRule {
  return {
    id: newId(),
    kind,
    name: "",
    passNames: [],
    enabled: true,
    moreThan: kind === "session" ? 3 : 1,
    appliesTo: "after1",
    method: kind === "session" ? "percent" : "subtract",
    value: 0,
    beforeDate: "",
  };
}

/** Plain-English summary shown to the operator and the booker. */
export function ruleSummary(r: DiscountRule): string {
  const amount = r.method === "percent" ? `${r.value}%` : money(r.value);
  const who = r.appliesTo === "all" ? "every attendee" : r.appliesTo === "second" ? "attendee 2 only" : "each attendee after the first";
  if (r.kind === "person")
    return r.method === "price"
      ? `More than ${r.moreThan} attendee${r.moreThan === 1 ? "" : "s"} — ${who} pays ${amount} per ticket`
      : `More than ${r.moreThan} attendee${r.moreThan === 1 ? "" : "s"} — ${amount} off for ${who}`;
  if (r.kind === "session") return `Book more than ${r.moreThan} sessions — ${amount} off`;
  return `Book by ${r.beforeDate || "the cut-off date"} — ${amount} off`;
}

export interface DiscountLine { name: string; amount: number; scope: string }
/**
 * Work out what comes off a basket. Returns each applied rule's saving.
 * Multi-person runs first, then multi-session on the reduced total, then
 * early bird; where several rules of a kind match, the best one wins.
 */
export function applyDiscounts(
  rules: DiscountRule[],
  items: { name: string; price: number; days: number }[],
  attendees: number,
  today = new Date().toISOString().slice(0, 10),
): { lines: DiscountLine[]; total: number } {
  const gross = items.reduce((s, i) => s + i.price, 0) * attendees;
  if (!items.length) return { lines: [], total: 0 };
  const live = rules.filter((r) => r.enabled);
  const covers = (r: DiscountRule, n: string) => r.passNames.length === 0 || r.passNames.includes(n);
  const scopeOf = (r: DiscountRule) => (r.passNames.length === 0 ? "All passes" : r.passNames.join(", "));
  const off = (r: DiscountRule, unit: number) =>
    r.method === "percent" ? (unit * r.value) / 100 : r.method === "subtract" ? Math.min(unit, r.value) : Math.max(0, unit - r.value);

  const lines: DiscountLine[] = [];
  let running = gross;

  // 1) Multi-person — priced per discounted attendee, per covered ticket.
  const person = live.filter((r) => r.kind === "person" && attendees > r.moreThan);
  let bestPerson: { r: DiscountRule; amount: number } | null = null;
  for (const r of person) {
    const heads = r.appliesTo === "all" ? attendees : r.appliesTo === "second" ? Math.min(1, attendees - 1) : attendees - 1;
    const amount = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + off(r, i.price), 0) * Math.max(0, heads);
    if (amount > 0 && (!bestPerson || amount > bestPerson.amount)) bestPerson = { r, amount };
  }
  if (bestPerson) {
    lines.push({ name: bestPerson.r.name || ruleSummary(bestPerson.r), amount: bestPerson.amount, scope: scopeOf(bestPerson.r) });
    running -= bestPerson.amount;
  }

  // A rule limited to certain tickets may only discount those tickets' share
  // of the basket — not the whole thing.
  const shareOf = (r: DiscountRule) => {
    if (r.passNames.length === 0) return 1;
    const covered = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + i.price, 0) * attendees;
    return gross > 0 ? covered / gross : 0;
  };

  // 2) Multi-session — on the already-reduced total, counting only the
  //    sessions on tickets this rule covers.
  const session = live.filter((r) => {
    if (r.kind !== "session") return false;
    const sessions = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + i.days, 0) * attendees;
    return sessions > r.moreThan;
  });
  let bestSession: { r: DiscountRule; amount: number } | null = null;
  for (const r of session) {
    const amount = off(r, running * shareOf(r));
    if (amount > 0 && (!bestSession || amount > bestSession.amount)) bestSession = { r, amount };
  }
  if (bestSession) {
    lines.push({ name: bestSession.r.name || ruleSummary(bestSession.r), amount: bestSession.amount, scope: scopeOf(bestSession.r) });
    running -= bestSession.amount;
  }

  // 3) Early bird.
  const early = live.filter((r) => r.kind === "early" && r.beforeDate && today <= r.beforeDate);
  let bestEarly: { r: DiscountRule; amount: number } | null = null;
  for (const r of early) {
    const amount = off(r, running * shareOf(r));
    if (amount > 0 && (!bestEarly || amount > bestEarly.amount)) bestEarly = { r, amount };
  }
  if (bestEarly) {
    lines.push({ name: bestEarly.r.name || ruleSummary(bestEarly.r), amount: bestEarly.amount, scope: scopeOf(bestEarly.r) });
    running -= bestEarly.amount;
  }

  return { lines, total: Math.max(0, Math.round(running * 100) / 100) };
}

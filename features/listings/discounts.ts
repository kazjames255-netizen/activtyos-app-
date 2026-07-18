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

export interface DiscountLine {
  name: string;
  amount: number;
  scope: string;
  /**
   * What this rule took off each item, index-aligned with `items`. Lets a
   * basket show the saving on the line that earned it, instead of only as a
   * lump at the bottom. Callers that don't need it can ignore it.
   */
  perItem?: number[];
}
/**
 * Work out what comes off a basket. Returns each applied rule's saving.
 * Multi-person runs first, then multi-session on the reduced total, then
 * early bird; where several rules of a kind match, the best one wins.
 */
export function applyDiscounts(
  rules: DiscountRule[],
  /**
   * One entry per thing being bought. `heads` is how many children are on it —
   * a multi-person rule only applies where children are on the SAME line,
   * because that's what a sibling discount is for. Omit it and every item is
   * assumed to carry `attendees`, which is the old behaviour.
   */
  items: { name: string; price: number; days: number; heads?: number }[],
  attendees: number,
  today = new Date().toISOString().slice(0, 10),
): { lines: DiscountLine[]; total: number } {
  const headsOf = (i: { heads?: number }) => Math.max(0, i.heads ?? attendees);
  const gross = items.reduce((s, i) => s + i.price * headsOf(i), 0);
  if (!items.length) return { lines: [], total: 0 };
  const live = rules.filter((r) => r.enabled);
  const covers = (r: DiscountRule, n: string) => r.passNames.length === 0 || r.passNames.includes(n);
  const scopeOf = (r: DiscountRule) => (r.passNames.length === 0 ? "All passes" : r.passNames.join(", "));
  const off = (r: DiscountRule, unit: number) =>
    r.method === "percent" ? (unit * r.value) / 100 : r.method === "subtract" ? Math.min(unit, r.value) : Math.max(0, unit - r.value);

  const lines: DiscountLine[] = [];
  let running = gross;

  // 1) Multi-person — priced per discounted attendee, per covered ticket.
  // Judged line by line: two children on the same week earn it, one child on
  // each of two weeks doesn't — they're never actually a pair.
  const discountedHeads = (r: DiscountRule, n: number) =>
    Math.max(0, r.appliesTo === "all" ? n : r.appliesTo === "second" ? Math.min(1, n - 1) : n - 1);
  const person = live.filter((r) => r.kind === "person");
  let bestPerson: { r: DiscountRule; amount: number; perItem: number[] } | null = null;
  for (const r of person) {
    const perItem = items.map((i) =>
      covers(r, i.name) && headsOf(i) > r.moreThan ? off(r, i.price) * discountedHeads(r, headsOf(i)) : 0,
    );
    const amount = perItem.reduce((s, n) => s + n, 0);
    if (amount > 0 && (!bestPerson || amount > bestPerson.amount)) bestPerson = { r, amount, perItem };
  }
  if (bestPerson) {
    lines.push({ name: bestPerson.r.name || ruleSummary(bestPerson.r), amount: bestPerson.amount, scope: scopeOf(bestPerson.r), perItem: bestPerson.perItem });
    running -= bestPerson.amount;
  }

  // A rule limited to certain tickets may only discount those tickets' share
  // of the basket — not the whole thing.
  const shareOf = (r: DiscountRule) => {
    if (r.passNames.length === 0) return 1;
    const covered = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + i.price * headsOf(i), 0);
    return gross > 0 ? covered / gross : 0;
  };

  // These rules come off the whole (reduced) total, so their saving is split
  // across the items they cover, by each item's share of that gross.
  const spread = (r: DiscountRule, amount: number) => {
    const weights = items.map((i) => (covers(r, i.name) ? i.price * headsOf(i) : 0));
    const sum = weights.reduce((s, n) => s + n, 0);
    return weights.map((w) => (sum > 0 ? Math.round(((amount * w) / sum) * 100) / 100 : 0));
  };

  // 2) Multi-session — on the already-reduced total, counting only the
  //    sessions on tickets this rule covers.
  const session = live.filter((r) => {
    if (r.kind !== "session") return false;
    const sessions = items.filter((i) => covers(r, i.name)).reduce((s, i) => s + i.days * headsOf(i), 0);
    return sessions > r.moreThan;
  });
  let bestSession: { r: DiscountRule; amount: number } | null = null;
  for (const r of session) {
    const amount = off(r, running * shareOf(r));
    if (amount > 0 && (!bestSession || amount > bestSession.amount)) bestSession = { r, amount };
  }
  if (bestSession) {
    lines.push({ name: bestSession.r.name || ruleSummary(bestSession.r), amount: bestSession.amount, scope: scopeOf(bestSession.r), perItem: spread(bestSession.r, bestSession.amount) });
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
    lines.push({ name: bestEarly.r.name || ruleSummary(bestEarly.r), amount: bestEarly.amount, scope: scopeOf(bestEarly.r), perItem: spread(bestEarly.r, bestEarly.amount) });
    running -= bestEarly.amount;
  }

  return { lines, total: Math.max(0, Math.round(running * 100) / 100) };
}

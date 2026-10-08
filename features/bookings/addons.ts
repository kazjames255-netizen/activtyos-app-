// Add-ons (extras) bought on a booking, as STRUCTURED lines: who each is for, what, which choice (size / colour), how many, the price, and the days.
// One pure module used by the provider booking page, the bookings list, the kit-to-prepare view, the emails and the family's screens, so every place
// reads an extra the same way. Newer bookings carry structured fields on `addonLines`; older ones only have the label text ("T-shirt × 1 (size: m)")
// and, before that, the flat `addons` strings ("T-shirt (size: m) — £10.00"): both are parsed here, in one place.

export interface AddonLineIn {
  child: string;
  label: string;
  price: number;
  days?: string[];
  perDay?: boolean;
  meal?: boolean;
  /** Structured fields written by newer bookings (optional: parsed from `label` when absent). */
  name?: string;
  answers?: { label: string; value: string }[];
  qty?: number;
}

export interface BookingAddonSource {
  addons?: string[];
  addonLines?: AddonLineIn[];
  child?: string;
  /** The children; a cancelled child / cancelled day removes that child's extras from the day (see kidOf). */
  kids?: { name: string; cancelled?: boolean; cancelledDays?: string[] }[];
  days?: string[];
}

export interface AddonLine {
  /** Whose extra it is. */
  child: string;
  /** The item: "T-shirt". */
  name: string;
  /** What they chose, as "size: M" ("" when nothing was chosen). */
  choice: string;
  /** Just the chosen values, as "M" or "red / large" (for grouping and short labels). */
  choiceValue: string;
  qty: number;
  price: number;
  /** ISO days it is for ([] when the booking did not say). */
  days: string[];
  perDay: boolean;
  meal: boolean;
  /** The text the booking stored ("T-shirt × 1 (size: M)"). */
  label: string;
}

const priceOfString = (s: string): number => {
  const m = /£\s*([\d,]+(?:\.\d+)?)\s*$/.exec(s.trim());
  return m ? Number(m[1].replace(/,/g, "")) : 0;
};

/** "tshirty × 2 (size: m, colour: red)" -> { name:"tshirty", qty:2, answers:[{size,m},{colour,red}] }. Also strips a leading meal emoji and a trailing " · Mon 5 Oct" meal date. */
export function parseAddonLabel(label: string): { name: string; qty: number; answers: { label: string; value: string }[]; meal: boolean } {
  let s = (label ?? "").trim();
  const meal = s.startsWith("🍽");
  if (meal) s = s.replace(/^🍽\s*/, "");
  s = s.replace(/\s+—\s+£\s*[\d,.]+\s*$/, "");
  const answers: { label: string; value: string }[] = [];
  const tail = /\s*\(([^()]*)\)\s*$/.exec(s);
  if (tail && tail[1].includes(":")) {
    for (const part of tail[1].split(",")) {
      const i = part.indexOf(":");
      if (i > 0) answers.push({ label: part.slice(0, i).trim(), value: part.slice(i + 1).trim() });
    }
    s = s.slice(0, tail.index).trim();
  }
  let qty = 1;
  const q = /\s+×\s*(\d+)\s*$/.exec(s);
  if (q) { qty = Math.max(1, Number(q[1])); s = s.slice(0, q.index).trim(); }
  if (meal) s = s.replace(/\s+·\s+.*$/, "").trim();
  return { name: s, qty, answers, meal };
}

const choiceOf = (answers: { label: string; value: string }[]) => ({
  choice: answers.map((a) => `${a.label}: ${a.value}`).join(", "),
  choiceValue: answers.map((a) => a.value).join(" / "),
});

const upperFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Every extra on a booking as structured lines (meals included, flagged `meal`). */
export function bookingAddonLines(b: BookingAddonSource): AddonLine[] {
  const lines = b.addonLines ?? [];
  const only = (b.kids?.length ?? 0) <= 1 ? (b.child ?? b.kids?.[0]?.name ?? "") : "";
  if (lines.length) {
    return lines.map((l) => {
      const p = parseAddonLabel(l.label);
      const answers = l.answers ?? p.answers;
      const c = choiceOf(answers);
      return {
        child: (l.child ?? "").trim() || only,
        name: upperFirst(l.name ?? p.name),
        choice: c.choice,
        choiceValue: c.choiceValue,
        qty: l.qty ?? p.qty,
        price: Number(l.price) || 0,
        days: l.days ?? [],
        perDay: !!l.perDay,
        meal: l.meal ?? p.meal,
        label: l.label,
      };
    });
  }
  // Very old bookings: only the flat strings, no child, no days.
  return (b.addons ?? []).map((a) => {
    const p = parseAddonLabel(a);
    const c = choiceOf(p.answers);
    return { child: only, name: upperFirst(p.name), choice: c.choice, choiceValue: c.choiceValue, qty: p.qty, price: priceOfString(a), days: [], perDay: false, meal: p.meal, label: a.replace(/\s+—\s+£\s*[\d,.]+\s*$/, "") };
  });
}

/** "T-shirt (M)" / "Water bottle (red)" / "Hoodie" - the short form used in emails and chips. */
export function addonShort(l: Pick<AddonLine, "name" | "choiceValue" | "qty" | "meal" | "perDay">): string {
  const base = l.choiceValue ? `${l.name} (${l.choiceValue})` : l.name;
  return l.qty > 1 && !l.meal && !l.perDay ? `${base} × ${l.qty}` : base;
}

/** The generic icon for "an extra" (covers a T-shirt, a bottle, a lunch, anything). Used wherever an extra is flagged. */
export const ADDON_ICON = "🎁";

/** How many extras a booking carries (the number on the list chip). */
export function addonCount(b: BookingAddonSource): number {
  return bookingAddonLines(b).length;
}

/** The extras grouped by child, keeping the booking's order: [{child, lines}]. */
export function addonsByChild(b: BookingAddonSource): { child: string; lines: AddonLine[] }[] {
  const out: { child: string; lines: AddonLine[] }[] = [];
  for (const l of bookingAddonLines(b)) {
    const hit = out.find((g) => g.child.trim().toLowerCase() === l.child.trim().toLowerCase());
    if (hit) hit.lines.push(l);
    else out.push({ child: l.child, lines: [l] });
  }
  return out;
}

/** The tick-box key of one child's one item on one day (stable, so a tick survives a reload and is idempotent). */
export function kitKey(ref: string, child: string, name: string, choiceValue: string, date: string): string {
  const k = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [k(ref), k(child) || "child", k(name), k(choiceValue) || "none", date].join("__");
}

/** Which bookings show in Add-on orders and on the register: ones that hold (or are waiting for) a place. Cancelled, declined, waitlisted and offered never do. */
export const addonBookingShows = (b: { status: string }): boolean => b.status === "Confirmed" || b.status === "Approval needed";

export type AddonFlag = "not-paid" | "awaiting-approval";
const NOT_PAID = new Set(["Unpaid", "Invoice sent", "Awaiting voucher payment"]);
/** The label a shown booking carries: waiting for the provider's approval, or confirmed but not paid yet. Paid / funded ones carry none. */
export function addonFlag(b: { status: string; pay?: string }): AddonFlag | undefined {
  if (b.status === "Approval needed") return "awaiting-approval";
  if (b.status === "Confirmed" && NOT_PAID.has(b.pay ?? "")) return "not-paid";
  return undefined;
}

export interface KitBooking extends BookingAddonSource {
  ref: string;
  status: string;
  /** Payment state ("Unpaid", "Paid"...): an unpaid booking still shows in Add-on orders, labelled "Not paid yet". */
  pay?: string;
  /** Who booked (for the 'Message' buttons; the server only sends email to roles that may message families). */
  booker?: string;
  email?: string;
  days?: string[];
  /** A family's requests to change / cancel an extra (features/bookings/addonRequests.ts): a PENDING one shows a small marker on that child's item. */
  addonRequests?: { key: string; kind: "change" | "cancel"; status: string }[];
}

export interface KitChild { key: string; ref: string; child: string; qty: number; booker?: string; email?: string; /** A request to change / cancel this item is waiting for the provider. */ pending?: "change" | "cancel"; /** The booking is not paid yet / still waits for the provider's approval: the screens label it. */ flag?: AddonFlag }
export interface KitGroup { id: string; name: string; choiceValue: string; choice: string; meal: boolean; total: number; children: KitChild[] }

/** Does this extra need preparing on `date`? A per-day extra (a lunch, a daily snack) on each of its days; a one-off extra (a T-shirt) on the FIRST day it is for. */
export function addonOnDay(l: AddonLine, date: string, bookingDays?: string[], kid?: KidState): boolean {
  return addonDaysIn(l, bookingDays, date, date, kid).includes(date);
}

/** What the booking says about one child's cancelled place / cancelled days (so their extras are not prepared for a day they no longer attend). */
export interface KidState { cancelled?: boolean; cancelledDays?: string[] }
export function kidOf(b: BookingAddonSource, child: string): KidState | undefined {
  const k = (b.kids ?? []).find((x) => x.name.trim().toLowerCase() === (child ?? "").trim().toLowerCase());
  return k ? { cancelled: k.cancelled, cancelledDays: k.cancelledDays } : undefined;
}

/** Everything to prepare on `date`, grouped by item and choice ("T-shirt · size M: sally, paul"), with plain counts. NO money. */
export function kitForDay(bookings: KitBooking[], date: string, opts: { name?: string } = {}): KitGroup[] {
  const groups = new Map<string, KitGroup>();
  const only = (opts.name ?? "").trim().toLowerCase();
  for (const b of bookings) {
    if (!addonBookingShows(b)) continue;
    const flag = addonFlag(b);
    for (const l of bookingAddonLines(b)) {
      if (!addonOnDay(l, date, b.days, kidOf(b, l.child))) continue;
      if (only && l.name.trim().toLowerCase() !== only) continue;
      const id = `${l.name.toLowerCase()}|${l.choiceValue.toLowerCase()}`;
      const g = groups.get(id) ?? { id, name: l.name, choiceValue: l.choiceValue, choice: l.choice, meal: l.meal, total: 0, children: [] };
      // A per-day extra is one item on each of its days (its stored qty is the number of days); a one-off extra is its own quantity.
      const qty = l.perDay || l.meal ? 1 : l.qty;
      g.total += qty;
      const req = (b.addonRequests ?? []).find((r) => r.status === "pending" && r.key === addonLineKey(l.child, l.label));
      g.children.push({ key: kitKey(b.ref, l.child, l.name, l.choiceValue, date), ref: b.ref, child: l.child, qty, ...(b.booker ? { booker: b.booker } : {}), ...(b.email ? { email: b.email } : {}), ...(req ? { pending: req.kind } : {}), ...(flag ? { flag } : {}) });
      groups.set(id, g);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, children: g.children.sort((a, c) => a.child.localeCompare(c.child)) }))
    .sort((a, b) => Number(a.meal) - Number(b.meal) || a.name.localeCompare(b.name) || a.choiceValue.localeCompare(b.choiceValue));
}

/** One readable sentence per extra for a family-facing list or a receipt: "sally james: T-shirt (M) — £10.00" (no name when the booking has one child and no name was stored). */
export function addonSentences(b: BookingAddonSource, withPrice = true): string[] {
  // One sentence per child and extra even when the family's checkout was split over several references (a week that crosses a Monday).
  return mergeAddonLines(bookingAddonLines(b)).map((l) => {
    const who = l.child ? `${l.child}: ` : "";
    const days = (l.perDay || l.meal) && l.days.length > 1 ? ` × ${l.days.length} days` : "";
    return `${who}${addonShort(l)}${days}${withPrice ? ` — £${l.price.toFixed(2)}` : ""}`;
  });
}

/** The same child's same extra, found on SEVERAL references of one checkout (a 7-day water bottle over a Monday is 1 + 6 days on two bookings): one line,
 *  the days joined, the price summed. Everything else is left exactly as it is. */
export function mergeAddonLines(lines: AddonLine[]): AddonLine[] {
  const out: AddonLine[] = [];
  const at = new Map<string, number>();
  for (const l of lines) {
    if (!l.perDay || l.meal) { out.push(l); continue; }
    const k = [l.child.trim().toLowerCase(), l.name.toLowerCase(), l.choiceValue.toLowerCase()].join("|");
    const i = at.get(k);
    if (i === undefined) { at.set(k, out.length); out.push({ ...l, days: [...l.days] }); continue; }
    const m = out[i];
    m.days = [...new Set([...m.days, ...l.days])].sort();
    m.price = Math.round((m.price + l.price) * 100) / 100;
    m.qty = m.days.length || m.qty + l.qty;
    m.label = `${m.name} × ${m.qty}`;
  }
  return out;
}

const dayName = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const nextIso = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
/** "Sun 18 Oct" for one day; "Sun 18 Oct – Sat 24 Oct" for an unbroken run; otherwise the days listed. */
export function daysPhrase(days: string[]): string {
  const d = [...new Set(days)].sort();
  if (!d.length) return "";
  if (d.length === 1) return dayName(d[0]);
  return d.every((x, i) => i === 0 || x === nextIso(d[i - 1])) ? `${dayName(d[0])} – ${dayName(d[d.length - 1])}` : d.map(dayName).join(", ");
}

/** An extra WITH its days, for the provider's new-booking email: "Water bottle (Blue) × 7 days (Sun 18 Oct – Sat 24 Oct)", "T-shirt (M) on Sun 18 Oct". */
export function addonWithDays(l: AddonLine, bookingDays?: string[], kid?: KidState): string {
  if (l.meal) return addonShort(l);
  const days = addonDaysIn(l, bookingDays, "0000-01-01", FAR, kid);
  if (!days.length) return addonShort(l);
  const base = addonShort({ ...l, perDay: true }); // the name and choice only; the days follow
  if (l.perDay) return days.length === 1 ? `${base} on ${dayName(days[0])}` : `${base} × ${days.length} days (${daysPhrase(days)})`;
  return `${addonShort(l)} on ${dayName(days[0])}`;
}

/** How many units of an extra were bought: a per-day extra counts its days, anything else its quantity. Used by Finance Insights. */
export function addonUnits(l: AddonLine, bookingDays?: string[]): number {
  if (l.perDay && !l.meal) {
    const held = bookingDays?.length ? l.days.filter((d) => bookingDays.includes(d)) : l.days;
    return (held.length ? held : l.days).length || l.qty;
  }
  return l.qty;
}

/** Move a day on the extras of one child (or every child when `child` is omitted): the date-change rewrite for BOTH kinds of extra. A per-day extra
 *  follows its day; a one-off extra keeps its list of days too, because its first day is the earliest of them (see addonDaysIn). */
export function moveAddonDays(lines: { child: string; days?: string[] }[] | undefined, child: string | undefined, from: string, to: string): void {
  for (const l of lines ?? []) {
    if (child !== undefined && l.child.trim() !== child.trim()) continue;
    if (!l.days?.includes(from)) continue;
    l.days = [...new Set(l.days.map((d) => (d === from ? to : d)))].sort();
  }
}

/** Is one STORED line (as the booking holds it) due on `date`? The register's rule: the same one Add-on orders uses. A line that says nothing about days
 *  (an old booking) is shown, because there is nothing to judge it by. */
export function addonLineOnDay(raw: AddonLineIn, bookingDays: string[] | undefined, date: string, kid?: KidState): boolean {
  if (!raw.days?.length && !bookingDays?.length) return true;
  return addonOnDay(bookingAddonLines({ addonLines: [raw] })[0], date, bookingDays, kid);
}

/** Stable key for one extra on one booking: the child and the label as stored. A family buys each extra once per child, so it is unique. Used by
 *  the change / cancel REQUESTS (features/bookings/addonRequests.ts) to point at a line. */
export const addonLineKey = (child: string, label: string): string => `${(child ?? "").trim().toLowerCase()}|${(label ?? "").trim()}`;

// ─────────────────────────────────────────────────────────────────────────
// ADD-ON ORDERS over many days: the strip of "days with orders", the month tally, the dashboard's next-7-days card, the sidebar rule
// and the evening-before reminder. All pure: the routes (routes/kit.ts) and sweeps feed in bookings, the screens draw the answers.
// Quantities only (never money): money lives on the Money screens and the Dashboard.
// ─────────────────────────────────────────────────────────────────────────

const FAR = "9999-12-31";

/** The ISO days (inside [from, to]) on which one extra has to be prepared. A PER-DAY extra (a lunch, a daily snack, or anything bought for
 *  every day of a week/multi-day booking) is needed on EVERY one of its days; a ONE-OFF extra (a T-shirt) once, on the first day it is for. */
export function addonDaysIn(l: AddonLine, bookingDays: string[] | undefined, from: string, to: string, kid?: KidState): string[] {
  if (kid?.cancelled) return [];
  const gone = new Set(kid?.cancelledDays ?? []);
  // A cancelled day drops out first, so a one-off extra moves to the child's first day they STILL attend.
  // A line can carry more days than its booking holds (a weekly checkout used to stamp the whole run on EACH of the two references): only the days
  // the booking really holds count. If none of them is held (an old or odd record) the line's own days stand.
  const held = bookingDays?.length && l.days.length ? l.days.filter((d) => bookingDays.includes(d)) : [];
  const days = (held.length ? held : l.days.length ? l.days : bookingDays ?? []).filter((d) => !gone.has(d)).sort();
  if (!days.length) return [];
  const on = l.perDay || l.meal ? days : [days[0]];
  return [...new Set(on)].filter((d) => d >= from && d <= to);
}

export interface KitDayTally { items: number; byName: Record<string, number> }
export interface KitTally { days: Record<string, KitDayTally>; names: string[] }

/** Items to prepare per day in [from, to]: a count per day and per add-on name, plus the add-on names seen (for the name filter). */
export function kitTally(bookings: KitBooking[], from: string, to: string, opts: { name?: string } = {}): KitTally {
  const days: Record<string, KitDayTally> = {};
  const names = new Map<string, string>();
  const only = (opts.name ?? "").trim().toLowerCase();
  for (const b of bookings) {
    if (!addonBookingShows(b)) continue;
    for (const l of bookingAddonLines(b)) {
      const k = l.name.trim().toLowerCase();
      const shown = names.get(k) ?? l.name;
      const dates = addonDaysIn(l, b.days, from, to, kidOf(b, l.child));
      if (dates.length) names.set(k, shown);
      if (only && k !== only) continue;
      const qty = l.perDay || l.meal ? 1 : l.qty;
      for (const d of dates) {
        const day = days[d] ?? (days[d] = { items: 0, byName: {} });
        day.items += qty;
        day.byName[shown] = (day.byName[shown] ?? 0) + qty;
      }
    }
  }
  return { days, names: [...names.values()].sort((a, c) => a.localeCompare(c)) };
}

/** The days that actually have orders, soonest first: [{date, items}]. */
export function daysWithOrders(t: KitTally): { date: string; items: number }[] {
  return Object.entries(t.days).filter(([, v]) => v.items > 0).map(([date, v]) => ({ date, items: v.items })).sort((a, c) => a.date.localeCompare(c.date));
}

/** The previous (-1) or next (1) date in `dates` after/before `current` (null when there is none). `dates` is the sorted list of days with orders. */
export function nextDayWith(dates: string[], current: string, dir: 1 | -1): string | null {
  const sorted = [...dates].sort();
  if (dir === 1) return sorted.find((d) => d > current) ?? null;
  for (let i = sorted.length - 1; i >= 0; i--) if (sorted[i] < current) return sorted[i];
  return null;
}

/** The dashboard card: today + the next 6 days, each with its item count and per-add-on counts (biggest first), plus the week total. */
export function sevenDaySummary(t: KitTally, today: string): { rows: { date: string; items: number; byName: { name: string; count: number }[] }[]; total: number } {
  const rows: { date: string; items: number; byName: { name: string; count: number }[] }[] = [];
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const v = t.days[date];
    const byName = v ? Object.entries(v.byName).map(([name, count]) => ({ name, count })).sort((a, c) => c.count - a.count || a.name.localeCompare(c.name)) : [];
    rows.push({ date, items: v?.items ?? 0, byName });
    total += v?.items ?? 0;
  }
  return { rows, total };
}

/** A month as weeks (Monday first): 7 cells per week, an ISO date or null for the padding days. */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= count; d++) cells.push(new Date(Date.UTC(year, month0, d)).toISOString().slice(0, 10));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** First and last ISO day of a month. */
export function monthRange(year: number, month0: number): { from: string; to: string } {
  return { from: new Date(Date.UTC(year, month0, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(year, month0 + 1, 0)).toISOString().slice(0, 10) };
}

/** The sidebar / dashboard rule: does this provider have LIVE add-on orders? Any Confirmed (non-cancelled, non-waitlisted) booking with an extra
 *  that still has a day to prepare today or later. */
export function hasLiveAddonOrders(bookings: KitBooking[], today: string): boolean {
  for (const b of bookings) {
    if (!addonBookingShows(b)) continue;
    for (const l of bookingAddonLines(b)) if (addonDaysIn(l, b.days, today, FAR, kidOf(b, l.child)).length) return true;
  }
  return false;
}

/** The evening-before reminder: how many items on `date` are NOT ticked yet, and per add-on name. `ticked` is the set of kit keys already ticked. */
export function kitUnticked(bookings: KitBooking[], date: string, ticked: Set<string>): { items: number; byName: Record<string, number> } {
  const byName: Record<string, number> = {};
  let items = 0;
  for (const g of kitForDay(bookings, date)) for (const c of g.children) {
    if (ticked.has(c.key)) continue;
    items += c.qty;
    byName[g.name] = (byName[g.name] ?? 0) + c.qty;
  }
  return { items, byName };
}

/** One reminder per provider per day: the scheduler's once-only key. */
export const kitReminderKey = (tenantId: string, date: string): string => `kitdaybefore_${tenantId}_${date}`;

/** "T-shirt ×3 · Water bottle ×2" (biggest first) for a bell body. */
export function kitNamesSentence(byName: Record<string, number>): string {
  return Object.entries(byName).sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0])).map(([n, c]) => `${n} ×${c}`).join(" · ");
}

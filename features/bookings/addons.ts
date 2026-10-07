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
  kids?: { name: string }[];
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

export interface KitBooking extends BookingAddonSource {
  ref: string;
  status: string;
  days?: string[];
  /** A family's requests to change / cancel an extra (features/bookings/addonRequests.ts): a PENDING one shows a small marker on that child's item. */
  addonRequests?: { key: string; kind: "change" | "cancel"; status: string }[];
}

export interface KitChild { key: string; ref: string; child: string; qty: number; /** A request to change / cancel this item is waiting for the provider. */ pending?: "change" | "cancel" }
export interface KitGroup { id: string; name: string; choiceValue: string; choice: string; meal: boolean; total: number; children: KitChild[] }

/** Does this extra need preparing on `date`? A per-day extra (a lunch, a daily snack) on each of its days; a one-off extra (a T-shirt) on the FIRST day it is for. */
export function addonOnDay(l: AddonLine, date: string, bookingDays?: string[]): boolean {
  const days = (l.days.length ? l.days : bookingDays ?? []).slice().sort();
  if (!days.length) return false;
  return l.perDay || l.meal ? days.includes(date) : days[0] === date;
}

/** Everything to prepare on `date`, grouped by item and choice ("T-shirt · size M: sally, paul"), with plain counts. NO money. */
export function kitForDay(bookings: KitBooking[], date: string): KitGroup[] {
  const groups = new Map<string, KitGroup>();
  for (const b of bookings) {
    if (b.status !== "Confirmed") continue;
    for (const l of bookingAddonLines(b)) {
      if (!addonOnDay(l, date, b.days)) continue;
      const id = `${l.name.toLowerCase()}|${l.choiceValue.toLowerCase()}`;
      const g = groups.get(id) ?? { id, name: l.name, choiceValue: l.choiceValue, choice: l.choice, meal: l.meal, total: 0, children: [] };
      // A per-day extra is one item on each of its days (its stored qty is the number of days); a one-off extra is its own quantity.
      const qty = l.perDay || l.meal ? 1 : l.qty;
      g.total += qty;
      const req = (b.addonRequests ?? []).find((r) => r.status === "pending" && r.key === addonLineKey(l.child, l.label));
      g.children.push({ key: kitKey(b.ref, l.child, l.name, l.choiceValue, date), ref: b.ref, child: l.child, qty, ...(req ? { pending: req.kind } : {}) });
      groups.set(id, g);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, children: g.children.sort((a, c) => a.child.localeCompare(c.child)) }))
    .sort((a, b) => Number(a.meal) - Number(b.meal) || a.name.localeCompare(b.name) || a.choiceValue.localeCompare(b.choiceValue));
}

/** One readable sentence per extra for a family-facing list or a receipt: "sally james: T-shirt (M) — £10.00" (no name when the booking has one child and no name was stored). */
export function addonSentences(b: BookingAddonSource, withPrice = true): string[] {
  return bookingAddonLines(b).map((l) => {
    const who = l.child ? `${l.child}: ` : "";
    const days = (l.perDay || l.meal) && l.days.length > 1 ? ` × ${l.days.length} days` : "";
    return `${who}${addonShort(l)}${days}${withPrice ? ` — £${l.price.toFixed(2)}` : ""}`;
  });
}

/** Stable key for one extra on one booking: the child and the label as stored. A family buys each extra once per child, so it is unique. Used by
 *  the change / cancel REQUESTS (features/bookings/addonRequests.ts) to point at a line. */
export const addonLineKey = (child: string, label: string): string => `${(child ?? "").trim().toLowerCase()}|${(label ?? "").trim()}`;

import type { Booking } from "../bookings/types";
import { toGender, type Gender } from "../../lib/childGender";

// The Insights "Gender split": how many CHILDREN (each counted once for the period, however many bookings) are boys, girls, non-binary / other,
// or prefer not to say, plus how many have nothing recorded. Gender is read from the child's own record (joined by child id, else by name);
// it is NEVER guessed from a name.

export type KidSex = { id?: string | null; childId?: string | null; name?: string | null; sex?: unknown };
export type GenderSplit = { boy: number; girl: number; other: number; na: number; unknown: number; known: number; total: number };

/** The children on a booking, with their id when the booking carries one. */
export function learnersOf(b: Pick<Booking, "kids" | "child" | "childId">): { name: string; id: string }[] {
  const kids = (b.kids ?? []) as { name?: string; childId?: string }[];
  if (kids.length) return kids.filter((k) => k.name).map((k) => ({ name: String(k.name), id: String(k.childId ?? "") }));
  return b.child ? [{ name: String(b.child), id: String((b as { childId?: string }).childId ?? "") }] : [];
}

/** Lookup tables from the customers' child entries (which carry `sex` once the family recorded it). */
export function sexIndex(kids: KidSex[]): { byId: Map<string, Gender>; byName: Map<string, Gender> } {
  const byId = new Map<string, Gender>(), byName = new Map<string, Gender>();
  for (const k of kids) {
    const g = toGender(k.sex);
    if (!g) continue;
    const id = String(k.childId ?? k.id ?? "");
    if (id) byId.set(id, g);
    const n = String(k.name ?? "").trim().toLowerCase();
    if (n && !byName.has(n)) byName.set(n, g);
  }
  return { byId, byName };
}

/** `bookings` are the ones already inside the period (and not cancelled). Each child counts once. */
export function genderSplit(bookings: Pick<Booking, "kids" | "child" | "childId">[], kids: KidSex[]): GenderSplit {
  const { byId, byName } = sexIndex(kids);
  const out: GenderSplit = { boy: 0, girl: 0, other: 0, na: 0, unknown: 0, known: 0, total: 0 };
  const all = bookings.flatMap((b) => learnersOf(b));
  const idLearners = new Map<string, string>(); // child id -> name
  for (const l of all) if (l.id && !idLearners.has(l.id)) idLearners.set(l.id, l.name.trim().toLowerCase());
  const namesWithId = new Set(idLearners.values());
  const nameOnly = new Set<string>();
  const add = (g: Gender | "") => { out.total++; if (g) out[g]++; else out.unknown++; };
  // children the booking identifies by id: one each
  for (const [id, nameKey] of idLearners) add(byId.get(id) || byName.get(nameKey) || "");
  // children known by name only: one per name, unless that name is already counted through an id
  for (const l of all) {
    const nameKey = l.name.trim().toLowerCase();
    if (l.id || !nameKey || namesWithId.has(nameKey) || nameOnly.has(nameKey)) continue;
    nameOnly.add(nameKey);
    add(byName.get(nameKey) || "");
  }
  out.known = out.boy + out.girl + out.other + out.na;
  return out;
}

// ── Small-cell suppression (privacy) ──────────────────────────────────────────────────────────────────────────────────────────
// A provider with a handful of children could identify one from "1 girl" (and from "known 41, boys 40" by subtraction). So the display
// never shows a count of 1-4 (it shows "<5"), and never shows what would let a hidden number be worked out:
//   1. primary: any of boy / girl / other / na between 1 and 4 is hidden (0 is not identifying and stays 0);
//   2. complement: if exactly ONE cell was hidden, the smallest other non-zero cell is hidden too (so it cannot be got back as total - rest);
//   3. while anything is hidden the aggregates (known, total) and the boys:girls ratio are withheld, so no sum or share gives it away.
export const SMALL_CELL = 5;
export type SplitCell = "boy" | "girl" | "other" | "na";
export type ShownSplit = {
  /** null = suppressed (render "<5"). */
  cells: Record<SplitCell, number | null>;
  known: number | null;
  total: number | null;
  /** "60:40" boys:girls, or null when it would disclose or there is nothing to show. */
  ratio: string | null;
  suppressed: SplitCell[];
};
export function suppressSplit(s: GenderSplit, min = SMALL_CELL): ShownSplit {
  const keys: SplitCell[] = ["boy", "girl", "other", "na"];
  const hidden = new Set<SplitCell>(keys.filter((k) => s[k] > 0 && s[k] < min));
  if (hidden.size === 1) {
    const rest = keys.filter((k) => !hidden.has(k) && s[k] > 0).sort((a, b) => s[a] - s[b]);
    if (rest.length) hidden.add(rest[0]);
  }
  const cells = Object.fromEntries(keys.map((k) => [k, hidden.has(k) ? null : s[k]])) as Record<SplitCell, number | null>;
  const any = hidden.size > 0;
  const bg = s.boy + s.girl;
  const ratio = any || !bg ? null : `${Math.round((s.boy / bg) * 100)}:${Math.round((s.girl / bg) * 100)}`;
  return { cells, known: any ? null : s.known, total: any ? null : s.total, ratio, suppressed: keys.filter((k) => hidden.has(k)) };
}

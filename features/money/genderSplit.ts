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

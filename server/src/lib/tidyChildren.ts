// One place that decides what a customer's `children` list may look like:
// a joined entry ("Bella James, Ava James") is split into its children, and the same child never appears twice
// (matched by childId first, then by case-insensitive name + dob). Used by every path that writes
// customers/*.children and by the Families read.
export type KidEntry = { name?: string | null; childId?: string | null; id?: string | null; dob?: string | null; age?: number | null; [k: string]: unknown };

const JOINED = /,|&|\band\b/i;
const SPLIT = /\s*(?:,|&|\band\b)\s*/i;

export function splitChildNames(joined: string | undefined | null): string[] {
  return (joined ?? "").split(SPLIT).map((n) => n.trim()).filter(Boolean);
}

const idOf = (k: KidEntry) => String(k.childId ?? k.id ?? "").trim();
const nameKey = (k: KidEntry) => String(k.name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const dobOf = (k: KidEntry) => String(k.dob ?? "").trim();

/** `idNames` (optional): childId -> that child's real name, so a joined entry that carried one child's id keeps it on the matching part. */
export function tidyChildren<T extends KidEntry>(kids: T[] | undefined | null, idNames?: Map<string, string>): T[] {
  const all = (kids ?? []).filter((k) => k && typeof k === "object");
  const whole = all.filter((k) => !JOINED.test(String(k.name ?? "")));
  const joined = all.filter((k) => JOINED.test(String(k.name ?? "")));
  // Split parts carry no id/dob/age of their own (those belonged to one child, not the group).
  const parts: T[] = joined.flatMap((k) =>
    splitChildNames(String(k.name ?? "")).map((n) => {
      const p: KidEntry = { ...k, name: n };
      const keepId = idOf(k) && idNames?.get(idOf(k))?.trim().toLowerCase() === n.toLowerCase() ? idOf(k) : "";
      delete p.childId; delete p.id; delete p.dob; delete p.age;
      if (keepId) p.childId = keepId;
      return p as T;
    }),
  );
  const out: T[] = [];
  for (const k of [...whole, ...parts]) {
    const name = nameKey(k);
    if (!name) continue;
    const id = idOf(k);
    const dob = dobOf(k);
    const hit = out.find((o) => {
      const oid = idOf(o);
      if (id && oid) return id === oid;
      if (nameKey(o) !== name) return false;
      const odob = dobOf(o);
      return !dob || !odob || dob === odob;
    });
    if (!hit) { out.push({ ...k, name: String(k.name).trim() }); continue; }
    // Same child: keep the first, fill any detail it lacks.
    for (const f of ["childId", "id", "dob", "age", "sendPlanId", "sendPlanName"] as const) {
      const have = hit[f];
      if ((have === undefined || have === null || have === "") && k[f] !== undefined && k[f] !== null && k[f] !== "") (hit as Record<string, unknown>)[f] = k[f];
    }
  }
  return out;
}

// A child's gender, as the family chose to record it (optional). Stored on the child record as `sex`:
// "boy" | "girl" | "other" (non-binary or other) | "na" (prefer not to say). Never inferred from a name.
// Pure helpers: shared by the customers list (server) and, via features/money/genderSplit.ts, the analytics.

export type Gender = "boy" | "girl" | "other" | "na";

/** Any stored spelling ("Boy", "girl", "Prefer not to say") -> the canonical value, or "" when unset/unknown. */
export function toGender(v: unknown): Gender | "" {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "";
  if (s === "boy" || s === "male" || s === "m") return "boy";
  if (s === "girl" || s === "female" || s === "f") return "girl";
  if (s === "other" || s.startsWith("non-binary") || s.startsWith("non binary") || s === "nonbinary") return "other";
  if (s === "na" || s === "n/a" || s.startsWith("prefer not")) return "na";
  return "";
}

type Kid = { name?: string | null; childId?: string | null; id?: string | null; sex?: unknown; [k: string]: unknown };
type KidRecord = { id: string; name?: string | null; sex?: unknown };

/**
 * Copy the gender a family recorded on a child record onto the matching child entry of a customer record.
 * The customer record's own children come from bookings (names only), so without this the gender never reached the
 * Families list or the analytics. Match by child id first, then by name; never overwrite a gender already there.
 * `records` must already be limited to children booked with THIS provider.
 */
export function attachGender<T extends Kid>(children: T[] | undefined | null, records: KidRecord[]): T[] {
  const byId = new Map<string, Gender>();
  const byName = new Map<string, Gender>();
  for (const r of records) {
    const g = toGender(r.sex);
    if (!g) continue;
    byId.set(r.id, g);
    const n = String(r.name ?? "").trim().toLowerCase();
    if (n && !byName.has(n)) byName.set(n, g);
  }
  return (children ?? []).map((k) => {
    if (toGender(k.sex)) return k;
    const id = String(k.childId ?? k.id ?? "");
    const g = (id && byId.get(id)) || byName.get(String(k.name ?? "").trim().toLowerCase());
    return g ? { ...k, sex: g } : k;
  });
}

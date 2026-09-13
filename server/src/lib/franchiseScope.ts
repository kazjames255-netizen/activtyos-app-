import { db } from "../firebase";
import type { AuthContext } from "../middleware/role";

// Franchise data isolation helpers. A franchise (role "franchise", scoped by
// franchiseId within a company tenant) must only see its OWN data. A record
// belongs to a franchise when the record's franchiseId matches, OR when it hangs
// off a LISTING that the franchise owns (listing.franchiseId) — the same
// ownership rule split-fees uses, so operational + money reads agree.
//
// SAFETY: callers apply these ONLY when auth.role === "franchise". The company /
// freelancer / platform code paths stay untouched, so the existing product can't
// regress — only the franchise view is narrowed.

/** The set of listing ids owned by this franchise within its tenant. */
export async function franchiseListingIds(tenantId: string, franchiseId: string): Promise<Set<string>> {
  const snap = await db.collection("listings").where("tenantId", "==", tenantId).get();
  return new Set(snap.docs.filter((d) => (d.data() as { franchiseId?: string | null }).franchiseId === franchiseId).map((d) => d.id));
}

/** True when the caller is a franchise (so the caller should narrow its reads). */
export function isFranchise(auth: AuthContext): auth is AuthContext & { franchiseId: string } {
  // A franchise's own STAFF are scoped to it too — they carry its franchiseId
  // (copied from the invite on accept), and must not read head office's or a
  // sibling franchise's children, bookings or families.
  return (auth.role === "franchise" || auth.role === "staff") && !!auth.franchiseId;
}

/** A record with an explicit franchiseId belongs to the franchise iff they match. */
export function ownedByFranchise(rec: { franchiseId?: string | null }, franchiseId: string): boolean {
  return (rec.franchiseId ?? null) === franchiseId;
}

/** The set of CHILD ids this franchise looks after (any child booked on its
 *  listings). Used to scope safeguarding records (incidents / medication /
 *  moments) to the franchise's own children — SHOWING every record for those
 *  children whoever logged it, never hiding one. Head office sees all. */
export async function franchiseChildIds(tenantId: string, franchiseId: string): Promise<Set<string>> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("franchiseId", "==", franchiseId).get();
  const out = new Set<string>();
  for (const d of snap.docs) {
    const b = d.data() as { childId?: string; kids?: { childId?: string }[] };
    if (b.childId) out.add(b.childId);
    for (const k of b.kids ?? []) if (k.childId) out.add(k.childId);
  }
  return out;
}

/** The set of family emails this franchise deals with (anyone booked on its
 *  listings). Used to scope messaging / email audiences to the franchise's own
 *  families rather than the whole company. Emails are lower-cased. */
export async function franchiseFamilyEmails(tenantId: string, franchiseId: string): Promise<Set<string>> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("franchiseId", "==", franchiseId).get();
  const out = new Set<string>();
  for (const d of snap.docs) {
    const e = (d.data() as { email?: string }).email;
    if (e) out.add(e.toLowerCase());
  }
  return out;
}

/** Narrow already-tenant-scoped records to a HEAD OFFICE's chosen network via a
 *  ?franchiseId= query. Only a company (HO) narrows: "__ho__" = head-office own
 *  (records with no franchiseId), a franchiseId = that franchise, absent/empty =
 *  the whole tenant (all franchises). Franchise/freelancer callers already scope
 *  their own rows, so this is a no-op for them. */
export function applyHoNetFilter<T extends { franchiseId?: string | null }>(
  rows: T[],
  role: string,
  franchiseIdQuery: unknown,
): T[] {
  if (role !== "company") return rows;
  const q = typeof franchiseIdQuery === "string" ? franchiseIdQuery.trim() : "";
  if (!q) return rows;
  if (q === "__ho__") return rows.filter((r) => !r.franchiseId);
  return rows.filter((r) => (r.franchiseId ?? null) === q);
}

/** email (lower-cased) → the franchiseId whose listings that family has booked.
 *  Used by Head office to tag each conversation with the network it belongs to.
 *  A family booked across several franchises maps to whichever booking is seen
 *  last; families with only head-office (no-franchiseId) bookings are absent. */
export async function familyFranchiseMap(tenantId: string): Promise<Map<string, string>> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const out = new Map<string, string>();
  for (const d of snap.docs) {
    const b = d.data() as { email?: string; franchiseId?: string | null };
    if (b.email && b.franchiseId) out.set(b.email.toLowerCase(), b.franchiseId);
  }
  return out;
}

/** A franchise's own people: the accounts carrying its franchiseId (the
 *  franchise owner and the staff who joined through its invites) plus the names
 *  on its own rota. Used where a record carries only a person's name or email —
 *  certificates, availability requests — to tell whose it is. */
export async function franchiseTeam(tenantId: string, franchiseId: string): Promise<{ emails: Set<string>; names: Set<string> }> {
  const [users, rota] = await Promise.all([
    db.collection("users").where("tenantId", "==", tenantId).where("franchiseId", "==", franchiseId).get(),
    db.collection("rotas").doc(`${tenantId}__fr__${franchiseId}`).get(),
  ]);
  const emails = new Set<string>();
  const names = new Set<string>();
  for (const u of users.docs) {
    const e = String(u.get("email") ?? "").trim().toLowerCase();
    const n = String(u.get("name") ?? "").trim().toLowerCase();
    if (e) emails.add(e);
    if (n) names.add(n);
  }
  for (const s of ((rota.get("staff") as { name?: string }[] | undefined) ?? [])) {
    const n = String(s.name ?? "").trim().toLowerCase();
    if (n) names.add(n);
  }
  return { emails, names };
}

/** The franchiseId to stamp on a record the caller creates: head office
 *  (company) records carry null; a franchise (or its staff) stamps its own. */
export function franchiseStamp(auth: { role: string; franchiseId: string | null }): string | null {
  return auth.role === "company" ? null : auth.franchiseId ?? null;
}

/** Whether the caller may see a tenant-scoped operational record (inventory,
 *  suppliers, timetables, menus, bundles, blocks, discounts...). Head office /
 *  freelancer / platform see everything in the tenant. A franchise sees records
 *  stamped with its franchiseId, plus unstamped legacy records its own team
 *  created. Pass `team` (franchiseTeam) when checking many rows. */
export async function visibleToFranchise(
  auth: { role: string; tenantId: string | null; franchiseId: string | null },
  rec: { franchiseId?: string | null; createdBy?: string | null },
  team?: { emails: Set<string> },
): Promise<boolean> {
  if (!isFranchise(auth as AuthContext)) return true;
  if (rec.franchiseId !== undefined && rec.franchiseId !== null) return rec.franchiseId === auth.franchiseId;
  const t = team ?? (await franchiseTeam(auth.tenantId!, auth.franchiseId!));
  const by = String(rec.createdBy ?? "").trim().toLowerCase();
  return !!by && t.emails.has(by);
}

/** Narrow a list of tenant-scoped rows to what the caller may see (see
 *  visibleToFranchise), then apply head office's optional ?franchiseId= filter. */
export async function scopeRows<T extends { franchiseId?: string | null; createdBy?: string | null }>(
  auth: { role: string; tenantId: string | null; franchiseId: string | null },
  rows: T[],
  franchiseIdQuery?: unknown,
): Promise<T[]> {
  if (!isFranchise(auth as AuthContext)) return applyHoNetFilter(rows, auth.role, franchiseIdQuery);
  const team = await franchiseTeam(auth.tenantId!, auth.franchiseId!);
  const out: T[] = [];
  for (const r of rows) if (await visibleToFranchise(auth, r, team)) out.push(r);
  return out;
}

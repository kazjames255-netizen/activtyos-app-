import type { Firestore, Query, QuerySnapshot } from "firebase-admin/firestore";

// Stored email addresses are not all lower case: an operator who typed
// "Pa@Example.com" when booking on a family's behalf left that exact string on
// the booking, its payments, the thread and the wallet. Firestore equality is
// case-sensitive and cannot be asked to ignore case, and scanning a collection
// to compare lower-cased copies would cost a read per row in the collection.
// So: (1) new rows are written lower-case (normEmail, used at the write paths),
// and (2) old rows are found with ONE `in` query over a bounded set of the
// spellings people actually type (below) - reads cost only the rows returned.
// Not covered by design: arbitrary alternating case ("pA@eXample.com").

export const normEmail = (e: unknown): string => String(e ?? "").trim().toLowerCase();

const up1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The lower-case form first, then every common mixed-case spelling of the same address (at most 16, within Firestore's `in` limit of 30). */
export function emailVariants(email: unknown): string[] {
  const e = normEmail(email);
  const at = e.lastIndexOf("@");
  if (at < 1) return e ? [e] : [];
  const local = e.slice(0, at), domain = e.slice(at + 1);
  const titleLocal = local.split(/([._+-])/).map(up1).join("");
  const titleDomain = domain.split(".").map(up1).join(".");
  const locals = [...new Set([local, up1(local), titleLocal, local.toUpperCase()])];
  const domains = [...new Set([domain, up1(domain), titleDomain, domain.toUpperCase()])];
  return [...new Set(locals.flatMap((l) => domains.map((d) => `${l}@${d}`)))];
}

/** All docs of `col` whose `field` is this address in any of the common spellings: one query. */
export function whereEmail(db: Firestore, col: string, field: string, email: unknown): Promise<QuerySnapshot> {
  return withEmail(db.collection(col), field, email);
}

/** Same, for a query that already has other filters (one `in` per query). */
export function withEmail(q: Query, field: string, email: unknown): Promise<QuerySnapshot> {
  const v = emailVariants(email);
  return (v.length === 1 ? q.where(field, "==", v[0]) : q.where(field, "in", v)).get();
}

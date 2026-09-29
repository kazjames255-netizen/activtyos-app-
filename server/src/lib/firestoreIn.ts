import type { CollectionReference, Query, QueryDocumentSnapshot } from "firebase-admin/firestore";

// Firestore caps `in` / `array-contains-any` at a handful of values per query.
// Slicing the value list to fit silently drops records (a parent with more
// than 10 child profiles lost accidents, medication and moments for the rest),
// so run one query per chunk instead and merge the results, de-duplicated by
// doc id — an array-contains-any doc can match values in two different chunks.
const CHUNK = 10;

export async function whereInChunks(
  base: CollectionReference | Query,
  field: string,
  op: "in" | "array-contains-any",
  values: readonly string[],
): Promise<QueryDocumentSnapshot[]> {
  const unique = [...new Set(values)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));
  const snaps = await Promise.all(chunks.map((c) => base.where(field, op, c).get()));
  const seen = new Map<string, QueryDocumentSnapshot>();
  for (const s of snaps) for (const d of s.docs) seen.set(d.id, d);
  return [...seen.values()];
}

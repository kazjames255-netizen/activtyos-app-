// Pure (no Firebase) head-office network scope: the ?franchiseId= selector on the head-office screens.
// "__ho__" = head office's own locations (no franchiseId), a franchise id = that franchise, absent / empty = the whole tenant (all franchises).
// Only a company (head office) narrows; franchise / freelancer / platform callers are returned unchanged (they already scope their own rows).

/** Narrow already-tenant-scoped records to a HEAD OFFICE's chosen network via a ?franchiseId= query. */
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

/** The same scope for BLOCKS (they carry no franchiseId of their own: their listing does). `owner` maps listingId -> the listing's franchiseId
 *  (null = head office's own). */
export function blocksInHoNet<T extends { listingId: string }>(
  blocks: T[],
  owner: Map<string, string | null>,
  role: string,
  franchiseIdQuery: unknown,
): T[] {
  if (role !== "company") return blocks;
  const q = typeof franchiseIdQuery === "string" ? franchiseIdQuery.trim() : "";
  if (!q) return blocks;
  return blocks.filter((b) => {
    const f = owner.get(b.listingId) ?? null;
    return q === "__ho__" ? f === null && owner.has(b.listingId) : f === q;
  });
}

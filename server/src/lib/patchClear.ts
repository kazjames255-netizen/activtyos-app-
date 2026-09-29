import { FieldValue } from "firebase-admin/firestore";

/** PUT bodies use "omitted = leave alone", so an edit form can never blank an optional field by
 *  leaving it out. Instead the client sends an explicit `null` for a field it wants removed.
 *  This pulls those nulls out of the body (so the zod schema never sees them) and returns the
 *  keys to delete; apply them with `applyClears(patch, clear)` once the rest has validated. */
export function splitClears(body: unknown, clearable: readonly string[]): { body: Record<string, unknown>; clear: string[] } {
  const b: Record<string, unknown> = { ...((body && typeof body === "object" ? body : {}) as Record<string, unknown>) };
  const clear = clearable.filter((k) => b[k] === null);
  clear.forEach((k) => delete b[k]);
  return { body: b, clear };
}
export function applyClears(patch: Record<string, unknown>, clear: string[]): void {
  for (const k of clear) patch[k] = FieldValue.delete();
}

// PURE UI rules (extracted from components, behaviour unchanged) so they can be regression-tested. See tests/regression/.

/** Fields a copy of a listing must NOT carry over: ids, ownership and everything the server computes. The server drops what it owns anyway. */
export const LISTING_COPY_DROP = ["id", "tenantId", "tenantName", "franchiseId", "blocks", "bundle", "library", "createdAt", "updatedAt", "offers", "bestOfferPercent", "acceptsTFC", "acceptsVouchers", "timings", "location", "season", "categories", "spotsLeft"] as const;

/** The body for "Duplicate listing". A listing with a saved wizard draft copies that draft; an OLDER listing (no `title`) copies every field it
 *  has (venue, add-ons, capacity, ages...) instead of just the name and passes, so the copy is a true copy. Always an unpublished draft. */
export function duplicateBody(l: Record<string, unknown>, draft: Record<string, unknown> | null, copyName: string): Record<string, unknown> {
  if (draft) return { ...draft, id: undefined, title: copyName, name: copyName, status: "draft", archived: false, passes: l.passes };
  const legacy = { ...l };
  for (const k of LISTING_COPY_DROP) delete legacy[k];
  return { ...legacy, name: copyName, passes: l.passes, status: "draft", archived: false };
}

/** The initials badge on a booking card: up to three children as "A & B & C"; four or more as two initials and "+N" (a long badge squeezed the
 *  names column to one letter per line). */
export function kidInitials(names: string[]): string {
  const n = names.filter(Boolean);
  if (!n.length) return "?";
  const ini = (x: string) => (x || "?").charAt(0).toUpperCase();
  return n.length > 3 ? `${n.slice(0, 2).map(ini).join(" & ")} +${n.length - 2}` : n.map(ini).join(" & ");
}

/** A child's collection password is REQUIRED whenever the provider has the collection check on (a child is never handed over without one). */
export const collectionOk = (collectionCheck: string | undefined, password: string): boolean => collectionCheck === "off" || password.trim().length > 0;

// PURE rules about what a listing response may contain, and which providers a parent sees in Browse (extracted from routes/listings.ts,
// behaviour unchanged). Each exists because of a real bug: see tests/regression/.

/** A home-visit provider's base postcode is usually their own home. Parents never need it (the server checks the distance), so it never leaves the server
 *  in a response to anyone but the owning provider. The postcode areas they cover and the radius are kept: those are the service area, not an address.
 *  An online listing's own session link (Zoom etc.) is handed only to booked families, from 10 minutes before the start: never in a public listing. */
export function withoutBaseAddress<T extends { coverageArea?: unknown }>(l: T): T {
  const out = { ...l } as T & { ownLink?: string };
  delete out.ownLink;
  const c = out.coverageArea as { basePostcode?: string } | null | undefined;
  if (!c || typeof c !== "object" || !("basePostcode" in c)) return out;
  const { basePostcode: _hidden, ...rest } = c;
  return { ...out, coverageArea: rest };
}

/** Editing any of these on a listing can free places: in automatic waitlist mode the families waiting must then be offered them. */
export const CAPACITY_FIELDS = ["maxAttendees", "capacityScope", "ticketOverrides", "ageCaps", "ageCapsOn", "waitlistMode"] as const;
export const touchesCapacity = (data: Record<string, unknown>): boolean => CAPACITY_FIELDS.some((f) => f in data);

/** The provider a parent picked at sign-up is THEIR provider from day one: its listings show in Browse before a first booking,
 *  even when that provider has not joined the wider marketplace. Mutates and returns the set. */
export function withHomeTenant(allowed: Set<string>, home: string | undefined | null): Set<string> {
  if (home) allowed.add(home);
  return allowed;
}

/** What a PARENT sees of a home-visit listing, given whether their saved postcode is inside the provider's coverage area.
 *  `covered` is true / false when we KNOW, and null when we do not (no saved postcode, or the postcode could not be located): unknown never hides a listing,
 *  because checkout asks for the postcode and refuses an uncovered one.
 *   - a venue listing is unaffected;
 *   - a home-visit-only listing outside the area is hidden altogether;
 *   - a "both" listing outside the area stays (the venue still works) but the home-visit option is switched off. */
export function homeVisitVisibility(deliveryMode: string | undefined | null, covered: boolean | null): "show" | "hide" | "venue-only" {
  if (deliveryMode !== "home-visit" && deliveryMode !== "both") return "show";
  if (covered !== false) return "show";
  return deliveryMode === "home-visit" ? "hide" : "venue-only";
}

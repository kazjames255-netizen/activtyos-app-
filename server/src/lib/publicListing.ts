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
 *   - a "both" listing is hidden too: booking one always needs the family's postcode inside the area (there is no separate venue-only booking
 *     path), so showing it outside the area would only end in a refusal at checkout. */
export function homeVisitVisibility(deliveryMode: string | undefined | null, covered: boolean | null): "show" | "hide" | "venue-only" {
  if (deliveryMode !== "home-visit" && deliveryMode !== "both") return "show";
  if (covered !== false) return "show";
  return "hide";
}

/** Should the DIRECT LINK (GET /api/listings/:id, the /book page, QR, quick book) answer "not found" for this family?
 *  Yes when the listing is hidden from them by area. One exception: a family that ALREADY has a booking on it keeps being able to open it
 *  (their own booking details read the listing), even if they have since moved. The answer is the same 404 as a missing listing: it never says why. */
export function directLinkHiddenByArea(deliveryMode: string | undefined | null, covered: boolean | null, hasBooking: boolean): boolean {
  return homeVisitVisibility(deliveryMode, covered) === "hide" && !hasBooking;
}

/** The body of the direct-link 404 for a family outside a home-visit listing's area. Same status and message as a missing listing, plus a machine
 *  `code` so the /book page can show a friendly "doesn't cover your area" screen instead of "not found". It carries ONLY the provider's public name
 *  and id, and the family's OWN postcode district (e.g. "MK10"): never the base postcode, the radius or the coverage list. */
export function outOfAreaBody(providerName: string | undefined | null, tenantId: string | undefined | null, familyPostcode: string): {
  error: string; code: "out_of_area"; provider: { name: string; tenantId?: string }; district: string;
} {
  const compact = (familyPostcode ?? "").toUpperCase().replace(/\s+/g, "");
  const district = compact.length > 3 ? compact.slice(0, -3) : compact;
  return { error: "Listing not found", code: "out_of_area", provider: { name: providerName || "", ...(tenantId ? { tenantId } : {}) }, district };
}

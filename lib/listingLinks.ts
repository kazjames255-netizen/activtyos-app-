// The two shareable links for a listing. Pure (no window / network) so it can be unit-tested and reused by the Link chooser, the QR code and
// the sign-in round trip.
//  · "storefront"  /book/<id>          the full listing page (photos, details, dates, staff) with the booking underneath
//  · "quick"       /book/<id>?quick=1  straight to the booking form (dates, children, pay), no sales page
// Both are public and browsable signed out, but a signed-out visitor gets the sign-in / create-account popup first (BookPage).

export type ListingLinkKind = "storefront" | "quick";

/** The path (and query) of a listing link. `id` is encoded; `embed` keeps the provider-website embed flag through a round trip. */
export function listingLinkPath(id: string, kind: ListingLinkKind = "storefront", opts?: { embed?: boolean }): string {
  const q = new URLSearchParams();
  if (kind === "quick") q.set("quick", "1");
  if (opts?.embed) q.set("embed", "1");
  const s = q.toString();
  return `/book/${encodeURIComponent(id)}${s ? `?${s}` : ""}`;
}

/** The full URL on `origin` (trailing slashes stripped; never localhost-guessing: the caller passes window.location.origin). */
export function listingLinkUrl(origin: string, id: string, kind: ListingLinkKind = "storefront", opts?: { embed?: boolean }): string {
  return `${(origin ?? "").replace(/\/+$/, "")}${listingLinkPath(id, kind, opts)}`;
}

/** Which kind a query string represents (?quick=1 is the quick-book link). */
export function listingLinkKindOf(search: { get(name: string): string | null }): ListingLinkKind {
  return search.get("quick") === "1" ? "quick" : "storefront";
}

// Pure listing-visibility rules (extracted from routes/listings.ts, behaviour unchanged).

type Vis = { title?: unknown; name?: unknown; status?: unknown; visibility?: unknown; archived?: unknown };

/** In the public browse feed / storefront: a real title, live, public, not archived. Hidden = unlisted (link only). */
export function isBrowsable(l: Vis): boolean {
  const title = ((l.title as string) ?? (l.name as string) ?? "").trim();
  return !!title && (l.status ?? "live") === "live" && (l.visibility ?? "public") === "public" && !l.archived;
}

/** GET /api/listings/:id (the direct /book link): hidden listings are still served; drafts/non-live and archived only to their owner. */
export function directLinkVisible(l: Vis, own: boolean): boolean {
  return !(((l.status ?? "live") !== "live" || l.archived) && !own);
}

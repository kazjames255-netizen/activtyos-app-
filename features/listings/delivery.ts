// How a listing is DELIVERED, in one place, so every screen says it the same way: online, at the family's home, at a venue, or home OR venue.
// Online is a venue whose kind is "online" (there is no separate delivery mode for it); home visits are deliveryMode "home-visit" / "both".

export type Delivery = "online" | "home" | "both" | "venue";

export function deliveryOf(l: { deliveryMode?: string | null; venueKind?: string | null }): Delivery {
  if (l.deliveryMode === "home-visit") return "home";
  if (l.deliveryMode === "both") return "both";
  if (l.venueKind === "online") return "online";
  return "venue";
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** The delivery badge text, or null for an ordinary venue listing (those keep showing the venue itself).
 *  `audience`: a parent reads "At your home"; the provider reads "Home visits". */
export function deliveryLabel(t: T, l: { deliveryMode?: string | null; venueKind?: string | null }, venueName: string | null | undefined, audience: "parent" | "provider"): string | null {
  const d = deliveryOf(l);
  if (d === "online") return t("p8lst.dlvOnline");
  if (d === "home") return t(audience === "parent" ? "p8lst.dlvHomeParent" : "p8lst.dlvHomeProv");
  if (d === "both") return venueName ? t(audience === "parent" ? "p8lst.dlvBothParent" : "p8lst.dlvBothProv", { venue: venueName }) : t(audience === "parent" ? "p8lst.dlvHomeParent" : "p8lst.dlvHomeProv");
  return null;
}

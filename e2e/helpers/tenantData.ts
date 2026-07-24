import { apiFetch, apiPost, fbSignIn } from "./accounts";
import type { TestAccount } from "./env";

// Arrange-side helper: provisions a bookable live listing for an operator
// account through the same API the UI uses (never Firestore directly). The
// UI tests then exercise the browse → book → operator-sees journey on top.

// Local date parts — toISOString() is UTC and walks a BST midnight back a day.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface ProvisionedListing {
  id: string;
  title: string;
  tenantId: string;
  runFrom: string;
  runTo: string;
}

// Venue + marketplace opt-in live in the tenant library. PUT replaces each
// top-level key wholesale, so merge with what's stored (settings holds the
// providerName seeded at signup). Returns the venue id.
export async function ensureVenue(operator: TestAccount, marketplaceListed = true): Promise<string> {
  const s = await fbSignIn(operator.email);
  const lib =
    ((await apiFetch<Record<string, unknown> | null>("/api/library", s.idToken)) as {
      venues?: unknown[];
      settings?: Record<string, unknown>;
    } | null) ?? {};
  const venueId = "e2e-venue";
  const venues = (lib.venues ?? []) as { id: string }[];
  await apiFetch("/api/library", s.idToken, {
    method: "PUT",
    body: JSON.stringify({
      venues: venues.some((v) => v.id === venueId)
        ? venues
        : [...venues, { id: venueId, name: "E2E Sports Hall", address: "1 Test Way", city: "Northampton" }],
      settings: { ...(lib.settings ?? {}), marketplaceListed },
    }),
  });
  return venueId;
}

export async function provisionLiveListing(
  operator: TestAccount,
  opts: {
    title: string;
    price?: number;
    marketplaceListed?: boolean;
    maxAttendees?: number;
    waitlist?: boolean;
  },
): Promise<ProvisionedListing> {
  const s = await fbSignIn(operator.email);
  const venueId = await ensureVenue(operator, opts.marketplaceListed ?? true);

  // A bookable listing needs a real block BUNDLE (periods + passes with
  // server-resolved pricing) — inline `passes` alone leave the customer
  // booking widget dead ("Pick a block in Tickets & pricing…").
  const period = await apiPost<{ id: string }>("/api/periods", s.idToken, {
    title: "Full day",
    start: "09:00",
    finish: "15:30",
  });
  const pass = await apiPost<{ id: string }>("/api/passes", s.idToken, { name: "Day pass", days: 1 });
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", s.idToken, {
    name: `E2E Block ${opts.title}`,
    periodIds: [period.id],
    passIds: [pass.id],
    priced: true,
    masterPrice: opts.price ?? 0,
    calcOn: true,
  });

  // Runs Mon–Fri starting next week for two weeks — always future-dated.
  const start = new Date();
  start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); // next Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 11); // into the second week (Mon..Fri)

  const listing = await apiPost<{ id: string; tenantId: string }>("/api/listings", s.idToken, {
    title: opts.title,
    venueId,
    runFrom: iso(start),
    runTo: iso(end),
    blockMode: "weekly",
    days: [1, 2, 3, 4, 5],
    maxAttendees: String(opts.maxAttendees ?? 16),
    capacityScope: "day",
    ...(opts.waitlist ? { waitlist: true, waitlistMode: "manual" as const } : {}),
    showSpaces: true,
    ageFrom: "5",
    ageTo: "12",
    blockId: bundle.id,
    passes: [{ name: "Day pass", price: opts.price ?? 0, days: 1 }],
    bookingType: "auto", // the wizard's default — omitting it books as "Approval needed"
    status: "live",
    visibility: "public",
  });
  // "Send to listings": snapshots the bundle's resolved pass prices onto the
  // listing, exactly like the Blocks builder does.
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, s.idToken, {
    method: "PUT",
    body: JSON.stringify({ listingIds: [listing.id] }),
  });
  return { id: listing.id, title: opts.title, tenantId: listing.tenantId, runFrom: iso(start), runTo: iso(end) };
}

/**
 * Book a child onto a provisioned listing through the parent checkout API —
 * the arrange step for lifecycle tests (cancel, waitlist, registers) so they
 * don't re-walk the UI booking journey the booking spec already covers.
 */
export async function bookViaApi(
  parent: TestAccount,
  listing: ProvisionedListing,
  opts: { child: string; dates?: string[] },
): Promise<{ ref: string; status: string }> {
  const s = await fbSignIn(parent.email);
  const doc = await apiFetch<{ blocks: { id: string }[] }>(`/api/listings/${listing.id}`, s.idToken);
  if (!doc.blocks?.length) throw new Error(`listing ${listing.id} has no dated blocks`);
  const res = await apiPost<{ bookings: { ref: string; status: string }[] }>("/api/my/bookings", s.idToken, {
    listingId: listing.id,
    blockId: doc.blocks[0].id,
    method: "card",
    items: [{ pass: "Day pass", child: opts.child, age: 8, dates: opts.dates ?? [listing.runFrom] }],
  });
  return res.bookings[0];
}
